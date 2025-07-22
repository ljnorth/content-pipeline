import { SupabaseClient } from '../database/supabase-client.js';
import { Logger } from '../utils/logger.js';
import OpenAI from 'openai';

export class ContentGenerator {
  constructor() {
    this.logger = new Logger();
    this.db = new SupabaseClient();
    this.openai = new OpenAI();
  }

  /**
   * Generate 3 posts with 5 images each for all active accounts
   */
  async generateDailyContent(accountUsernames = null) {
    this.logger.info('🎨 Starting daily content generation...');
    
    try {
      // Get active accounts to generate for
      const accounts = accountUsernames || await this.getActiveAccounts();
      
      if (accounts.length === 0) {
        this.logger.info('ℹ️ No active accounts found for content generation');
        return { success: true, message: 'No active accounts' };
      }

      const results = [];

      for (const account of accounts) {
        this.logger.info(`🎯 Generating content for account: ${account.username}`);
        
        try {
          const accountResults = await this.generateContentForAccount(account);
          results.push({
            account: account.username,
            success: true,
            posts: accountResults
          });
        } catch (error) {
          this.logger.error(`❌ Failed to generate content for ${account.username}: ${error.message}`);
          results.push({
            account: account.username,
            success: false,
            error: error.message
          });
        }
      }

      this.logger.info('🎉 Daily content generation complete!');
      return { success: true, results };

    } catch (error) {
      this.logger.error(`❌ Content generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate 3 posts for a specific account
   */
  async generateContentForAccount(account) {
    const posts = [];
    
    // Get account's content strategy and preferences
    const strategy = await this.getAccountStrategy(account.username);
    
    // Generate 3 different posts
    for (let i = 1; i <= 3; i++) {
      this.logger.info(`📝 Generating post ${i}/3 for ${account.username}`);
      
      const post = await this.generateSinglePost(account, strategy, i);
      posts.push(post);
      
      // Small delay between posts to vary content
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return posts;
  }

  /**
   * Generate a single post with 5 images
   */
  async generateSinglePost(account, strategy, postNumber) {
    this.logger.info(`🎯 Starting single post generation for ${account.username}, post ${postNumber}`);
    
    try {
      // Get curated images based on account strategy
      this.logger.info(`🔍 Getting curated images for ${account.username}...`);
      const images = await this.getCuratedImages(account.username, strategy, 5);
      
      this.logger.info(`📊 Retrieved ${images.length} curated images`);
      
      if (images.length < 5) {
        const errorMsg = `Not enough suitable images found for ${account.username}. Found ${images.length}, need 5.`;
        this.logger.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }

      this.logger.info(`🤖 Generating content with AI for ${images.length} images...`);
      
      // Generate caption and hashtags
      const content = await this.generatePostContent(images, strategy, postNumber);
      
      this.logger.info(`✅ AI content generated successfully - Theme: ${content.theme}`);
      
      // Create post object
      const post = {
        accountUsername: account.username,
        postNumber,
        images: images.map(img => ({
          id: img.id,
          imagePath: img.image_path,
          aesthetic: img.aesthetic,
          colors: img.colors,
          season: img.season
        })),
        caption: content.caption,
        hashtags: content.hashtags,
        strategy: {
          theme: content.theme,
          aesthetic: content.primaryAesthetic,
          targetAudience: strategy.target_audience
        },
        generatedAt: new Date().toISOString()
      };

      this.logger.info(`💾 Saving generated post to database...`);
      
      // Save to database
      await this.saveGeneratedPost(post);
      
      this.logger.info(`✅ Post ${postNumber} generated: ${content.theme} (${images.length} images)`);
      return post;
      
    } catch (error) {
      this.logger.error(`❌ Failed to generate single post for ${account.username}: ${error.message}`);
      this.logger.error(`❌ Stack trace: ${error.stack}`);
      throw error; // Re-throw to be caught by the calling function
    }
  }

  /**
   * Get curated images based on account strategy with deduplication rules
   */
  async getCuratedImages(username, strategy, count = 5) {
    this.logger.info(`🔍 Curating ${count} images for ${username} with deduplication rules...`);
    
    try {
      // Get recently used images for this account (within last 6 posts)
      this.logger.info(`📋 Checking for recently used images...`);
      const recentlyUsedImages = await this.getRecentlyUsedImages(username);
      this.logger.info(`🚫 Found ${recentlyUsedImages.length} recently used images to exclude`);
      
      // Build query based on account strategy
      this.logger.info(`🗄️ Building database query for images...`);
      let query = this.db.client
        .from('images')
        .select('id, image_path, aesthetic, colors, season, occasion, username, post_id, additional')
        .not('image_path', 'is', null); // Ensure we have valid image paths

      // Exclude recently used images
      if (recentlyUsedImages.length > 0) {
        query = query.not('id', 'in', recentlyUsedImages);
        this.logger.info(`🚫 Excluding ${recentlyUsedImages.length} recently used images`);
      }

      // Apply aesthetic filters if specified AND there are aesthetics available
      if (strategy.content_strategy?.aestheticFocus?.length > 0) {
        const aesthetics = strategy.content_strategy.aestheticFocus.filter(a => a && a.trim() !== '');
        if (aesthetics.length > 0) {
          this.logger.info(`🎨 Applying aesthetic filters: ${aesthetics.join(', ')}`);
          // Use direct aesthetic field matching - but don't require it to be non-null
          const aestheticConditions = aesthetics.map(a => `aesthetic.ilike.%${a}%`).join(',');
          query = query.or(`aesthetic.is.null,${aestheticConditions}`);
        }
      }

      // Apply color preferences if specified AND there are colors available
      if (strategy.content_strategy?.colorPalette?.length > 0) {
        const colors = strategy.content_strategy.colorPalette.filter(c => c && c.trim() !== '');
        if (colors.length > 0) {
          this.logger.info(`🌈 Applying color filters: ${colors.join(', ')}`);
          // Use direct colors field matching (array field) - but don't require it to be non-null
          const colorConditions = colors.map(c => `colors.cs.{${c}}`).join(',');
          query = query.or(`colors.is.null,${colorConditions}`);
        }
      }

      // Get recent, high-quality images
      query = query
        .order('created_at', { ascending: false })
        .limit(count * 5); // Get more than needed for filtering

      this.logger.info(`🔍 Executing database query...`);
      const { data: images, error } = await query;
      
      if (error) {
        this.logger.error(`❌ Database query failed: ${error.message}`);
        throw new Error(`Failed to fetch images: ${error.message}`);
      }

      this.logger.info(`📊 Found ${images?.length || 0} potential images for curation`);

      // If we don't have enough images, try a fallback query without filters
      if (!images || images.length < count) {
        this.logger.warn(`⚠️ Not enough images found with strategy filters (${images?.length || 0}/${count}). Trying fallback query...`);
        
        let fallbackQuery = this.db.client
          .from('images')
          .select('id, image_path, aesthetic, colors, season, occasion, username, post_id, additional')
          .not('image_path', 'is', null);
        
        // Still exclude recently used images
        if (recentlyUsedImages.length > 0) {
          fallbackQuery = fallbackQuery.not('id', 'in', recentlyUsedImages);
        }
        
        fallbackQuery = fallbackQuery
          .order('created_at', { ascending: false })
          .limit(count * 5);
        
        this.logger.info(`🔍 Executing fallback database query...`);
        const { data: fallbackImages, error: fallbackError } = await fallbackQuery;
        
        if (fallbackError) {
          this.logger.error(`❌ Fallback query failed: ${fallbackError.message}`);
          throw new Error(`Fallback query failed: ${fallbackError.message}`);
        }
        
        if (!fallbackImages || fallbackImages.length === 0) {
          const errorMsg = `No images available in database. Please run the content pipeline to scrape and analyze images first.`;
          this.logger.error(`❌ ${errorMsg}`);
          throw new Error(errorMsg);
        }
        
        this.logger.info(`📊 Fallback query found ${fallbackImages.length} images`);
        
        // Use fallback images
        const finalImages = fallbackImages || [];
        
        // Process and score images
        this.logger.info(`🎯 Scoring fallback images...`);
        const scoredImages = finalImages.map(img => {
          return {
            ...img,
            score: this.scoreImageForAccount(img, strategy)
          };
        }).sort((a, b) => b.score - a.score);

        this.logger.info(`🎯 Using fallback: Scored ${scoredImages.length} images, top score: ${scoredImages[0]?.score || 0}`);

        // Return top images, ensuring variety and no duplicates within the post
        const selectedImages = this.selectVariedImages(scoredImages, count);
        this.logger.info(`✅ Selected ${selectedImages.length} varied images from fallback`);
        return selectedImages;
      }

      // Process and score images normally
      this.logger.info(`🎯 Scoring filtered images...`);
      const scoredImages = images.map(img => {
        return {
          ...img,
          score: this.scoreImageForAccount(img, strategy)
        };
      }).sort((a, b) => b.score - a.score);

      this.logger.info(`🎯 Scored ${scoredImages.length} images, top score: ${scoredImages[0]?.score || 0}`);

      // Return top images, ensuring variety and no duplicates within the post
      const selectedImages = this.selectVariedImages(scoredImages, count);
      this.logger.info(`✅ Selected ${selectedImages.length} varied images`);
      return selectedImages;
      
    } catch (error) {
      this.logger.error(`❌ Error in getCuratedImages: ${error.message}`);
      this.logger.error(`❌ Stack trace: ${error.stack}`);
      throw error;
    }
  }

  /**
   * Get recently used images for an account (within last 6 posts worth)
   */
  async getRecentlyUsedImages(username) {
    try {
      // Get the last 6 generations for this account
      // Handle both old schema (image_paths) and new schema (images)
      const { data: recentGenerations, error: genError } = await this.db.client
        .from('generated_posts')
        .select('images, image_paths')
        .eq('account_username', username)
        .order('created_at', { ascending: false })
        .limit(6);

      if (genError) {
        this.logger.error(`Error fetching recent generations: ${genError.message}`);
        return [];
      }

      // Extract all image IDs from recent posts
      const usedImageIds = new Set();
      recentGenerations?.forEach(generation => {
        // Try new schema first (images column with full objects)
        if (generation.images && Array.isArray(generation.images)) {
          generation.images.forEach(img => {
            if (img.id) usedImageIds.add(img.id);
          });
        }
        // Fallback to old schema (image_paths column with just paths)
        else if (generation.image_paths && Array.isArray(generation.image_paths)) {
          // For image_paths, we can't get IDs directly, so this is less effective
          // but still prevents some duplication
          generation.image_paths.forEach(path => {
            // Try to extract a unique identifier from the path if possible
            const pathId = path.split('/').pop()?.split('.')[0];
            if (pathId) usedImageIds.add(pathId);
          });
        }
      });

      return Array.from(usedImageIds);
    } catch (error) {
      this.logger.error(`Error getting recently used images: ${error.message}`);
      return [];
    }
  }

  /**
   * Score an image based on how well it fits the account strategy
   */
  scoreImageForAccount(image, strategy) {
    let score = 0;

    // Base score for having a valid image
    score += 10;

    // Aesthetic matching (with fallback if aesthetic is null)
    if (strategy.content_strategy?.aestheticFocus?.length > 0) {
      const aesthetics = strategy.content_strategy.aestheticFocus.filter(a => a && a.trim() !== '');
      if (aesthetics.length > 0 && image.aesthetic) {
        if (aesthetics.some(a => image.aesthetic.toLowerCase().includes(a.toLowerCase()))) {
          score += 20;
        }
      } else if (!image.aesthetic) {
        // Give a small score for images without aesthetic data (they're still usable)
        score += 5;
      }
    }

    // Color matching (with fallback if colors is null)
    if (strategy.content_strategy?.colorPalette?.length > 0) {
      const colors = strategy.content_strategy.colorPalette.filter(c => c && c.trim() !== '');
      if (colors.length > 0 && image.colors && Array.isArray(image.colors)) {
        if (colors.some(c => image.colors.some(imgColor => imgColor.toLowerCase().includes(c.toLowerCase())))) {
          score += 15;
        }
      } else if (!image.colors || !Array.isArray(image.colors)) {
        // Give a small score for images without color data
        score += 3;
      }
    }

    // Season relevance (current season gets bonus)
    const currentMonth = new Date().getMonth();
    const currentSeason = this.getCurrentSeason(currentMonth);
    if (image.season && image.season.toLowerCase().includes(currentSeason.toLowerCase())) {
      score += 10;
    } else if (!image.season) {
      // Give a small score for images without season data
      score += 2;
    }

    // Additional traits matching (with fallback)
    if (image.additional && Array.isArray(image.additional)) {
      const additionalTraits = image.additional.map(trait => trait.toLowerCase());
      if (strategy.content_strategy?.aestheticFocus) {
        const aesthetics = strategy.content_strategy.aestheticFocus.filter(a => a && a.trim() !== '');
        if (aesthetics.some(aesthetic => additionalTraits.some(trait => trait.includes(aesthetic.toLowerCase())))) {
          score += 5;
        }
      }
    }

    // Bonus for recent images (more likely to be current trends)
    if (image.created_at) {
      const imageDate = new Date(image.created_at);
      const now = new Date();
      const daysDiff = (now - imageDate) / (1000 * 60 * 60 * 24);
      
      if (daysDiff < 30) {
        score += 5; // Recent images get bonus
      } else if (daysDiff < 90) {
        score += 2; // Somewhat recent images get smaller bonus
      }
    }

    return score;
  }

  /**
   * Select varied images to avoid repetition - RULE: Never use same image twice in one post
   */
  selectVariedImages(scoredImages, count) {
    const selected = [];
    const usedImageIds = new Set();
    const usedAesthetics = new Set();
    const usedAccounts = new Set();

    for (const image of scoredImages) {
      if (selected.length >= count) break;

      // RULE 1: Never use the same image twice in one post
      if (usedImageIds.has(image.id)) continue;

      // Avoid too many from same aesthetic or account for variety
      const aesthetic = image.aesthetic?.toLowerCase() || 'unknown';
      const account = image.username;

      if (usedAesthetics.has(aesthetic) && usedAesthetics.size < 3) continue;
      if (usedAccounts.has(account) && usedAccounts.size < 2) continue;

      selected.push(image);
      usedImageIds.add(image.id);
      usedAesthetics.add(aesthetic);
      usedAccounts.add(account);
    }

    // Fill remaining slots if needed (still respecting no-duplicate rule)
    while (selected.length < count && selected.length < scoredImages.length) {
      for (const image of scoredImages) {
        if (selected.length >= count) break;
        if (!usedImageIds.has(image.id)) {
          selected.push(image);
          usedImageIds.add(image.id);
        }
      }
    }

    return selected;
  }

  /**
   * Generate caption and hashtags using AI
   */
  async generatePostContent(images, strategy, postNumber) {
    const aesthetics = [...new Set(images.map(img => img.aesthetic).filter(Boolean))];
    const colors = [...new Set(images.map(img => img.colors).filter(Boolean))];
    const seasons = [...new Set(images.map(img => img.season).filter(Boolean))];

    const prompt = `Create TikTok content for post ${postNumber} featuring these fashion elements:

AESTHETICS: ${aesthetics.join(', ')}
COLORS: ${colors.join(', ')}
SEASONS: ${seasons.join(', ')}

ACCOUNT STRATEGY:
- Target Audience: ${JSON.stringify(strategy.target_audience)}
- Content Focus: ${JSON.stringify(strategy.content_strategy)}
- Performance Goals: ${JSON.stringify(strategy.performance_goals)}

Instructions:
- Write a very short, simple caption (1-2 sentences, very basic, easy to read, with 1-2 emojis that match the theme)
- At the end of the caption, add all hashtags as one block (not as a separate list)
- Hashtags must match the theme and ALWAYS include: #pinterest #aestheticmoodboard #fashionmoodboard
- Make sure both caption and hashtags are appropriate for the theme and target audience

Return JSON with:
- theme: A catchy theme/concept for the post
- caption: Short, simple caption (1-2 sentences, 1-2 emojis, with all hashtags at the end as one block)
- primaryAesthetic: The main aesthetic this post focuses on

Be authentic, fun, and keep it very simple for TikTok teens.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 300
    });

    return JSON.parse(response.choices[0].message.content);
  }

  /**
   * Get account strategy from database
   */
  async getAccountStrategy(username) {
    const { data: profile, error } = await this.db.client
      .from('account_profiles')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !profile) {
      // Return default strategy if no profile exists
      return {
        target_audience: { age: "18-35", interests: ["fashion"] },
        content_strategy: { aestheticFocus: ["trendy", "casual"], colorPalette: ["neutral", "trending"] },
        performance_goals: { primaryMetric: "likes", targetRate: 0.05 }
      };
    }

    return profile;
  }

  /**
   * Get active accounts for content generation
   */
  async getActiveAccounts() {
    const { data: accounts, error } = await this.db.client
      .from('account_profiles')
      .select('username, display_name, content_strategy, target_audience, performance_goals')
      .eq('is_active', true)
      .eq('account_type', 'owned');

    if (error) {
      this.logger.error(`Failed to fetch accounts: ${error.message}`);
      return [];
    }

    return accounts || [];
  }

  /**
   * Save generated post to database and track image usage
   */
  async saveGeneratedPost(post) {
    const generationId = `daily_${Date.now()}_${post.postNumber}`;
    
    try {
      // Prepare the basic post data that should always work
      const basePostData = {
        account_username: post.accountUsername,
        generation_id: generationId,
        post_number: post.postNumber,
        image_paths: post.images.map(img => img.imagePath),
        caption: post.caption,
        hashtags: post.hashtags,
        status: 'generated',
        platform: 'pending',
        created_at: post.generatedAt
      };

      // Try to save with the images column first
      let saveError = null;
      try {
        const { error } = await this.db.client
          .from('generated_posts')
          .insert({
            ...basePostData,
            images: post.images // Try to include full image data
          });
        
        saveError = error;
      } catch (err) {
        saveError = err;
      }

      // If that failed due to the images column, try without it
      if (saveError && (
        saveError.message.includes('images') || 
        saveError.message.includes('column') ||
        saveError.message.includes('schema cache')
      )) {
        this.logger.warn('⚠️ Images column issue detected, saving without full image data');
        
        const { error: retryError } = await this.db.client
          .from('generated_posts')
          .insert(basePostData);
        
        if (retryError) {
          throw new Error(`Failed to save post (retry): ${retryError.message}`);
        }
      } else if (saveError) {
        throw new Error(`Failed to save post: ${saveError.message}`);
      }

      this.logger.info(`💾 Saved generated post ${generationId} to database`);

      // Track image usage for the 6-post cooldown rule (optional, don't fail if this breaks)
      try {
        await this.trackImageUsage(post.accountUsername, generationId, post.images, post.postNumber);
      } catch (trackingError) {
        this.logger.warn(`⚠️ Image usage tracking failed: ${trackingError.message}`);
        // Don't fail the whole operation if tracking fails
      }
      
    } catch (error) {
      this.logger.error(`❌ Error saving generated post: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get current season based on month
   */
  getCurrentSeason(month) {
    if (month >= 11 || month <= 1) {
      return 'winter';
    } else if (month >= 2 && month <= 4) {
      return 'spring';
    } else if (month >= 5 && month <= 7) {
      return 'summer';
    } else {
      return 'autumn';
    }
  }

  /**
   * Track image usage for cooldown enforcement - RULE: 6 post cooldown before reuse
   */
  async trackImageUsage(accountUsername, generationId, images, postNumber) {
    try {
      // Check if image_usage table exists, if not skip tracking for now
      const usageRecords = images.map(img => ({
        image_id: img.id,
        account_username: accountUsername,
        generation_id: generationId,
        post_number: postNumber,
        used_at: new Date().toISOString()
      }));

      // Try to insert usage records
      const { error } = await this.db.client
        .from('image_usage')
        .insert(usageRecords);

      if (error && !error.message.includes('relation "image_usage" does not exist')) {
        this.logger.error(`Failed to track image usage: ${error.message}`);
      } else if (!error) {
        this.logger.info(`✅ Tracked usage of ${images.length} images for ${accountUsername}`);
      }
    } catch (error) {
      // Don't fail the whole generation if tracking fails
      this.logger.error(`Image usage tracking error: ${error.message}`);
    }
  }
} 