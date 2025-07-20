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
    // Get curated images based on account strategy
    const images = await this.getCuratedImages(account.username, strategy, 5);
    
    if (images.length < 5) {
      throw new Error(`Not enough suitable images found for ${account.username}. Found ${images.length}, need 5.`);
    }

    // Generate caption and hashtags
    const content = await this.generatePostContent(images, strategy, postNumber);
    
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

    // Save to database
    await this.saveGeneratedPost(post);
    
    this.logger.info(`✅ Post ${postNumber} generated: ${content.theme} (${images.length} images)`);
    return post;
  }

  /**
   * Get curated images based on account strategy
   */
  async getCuratedImages(username, strategy, count = 5) {
    this.logger.info(`🔍 Curating ${count} images for ${username}...`);
    
    // Build query based on account strategy
    let query = this.db.client
      .from('images')
      .select('id, image_path, aesthetic, colors, season, occasion, username, post_id, additional')
      .not('aesthetic', 'is', null); // Use direct aesthetic field instead of analysis

    // Apply aesthetic filters if specified
    if (strategy.content_strategy?.aestheticFocus?.length > 0) {
      const aesthetics = strategy.content_strategy.aestheticFocus.filter(a => a && a.trim() !== '');
      if (aesthetics.length > 0) {
        // Use direct aesthetic field matching
        const aestheticConditions = aesthetics.map(a => `aesthetic.ilike.%${a}%`).join(',');
        query = query.or(aestheticConditions);
      }
    }

    // Apply color preferences if specified
    if (strategy.content_strategy?.colorPalette?.length > 0) {
      const colors = strategy.content_strategy.colorPalette.filter(c => c && c.trim() !== '');
      if (colors.length > 0) {
        // Use direct colors field matching (array field)
        const colorConditions = colors.map(c => `colors.cs.{${c}}`).join(',');
        query = query.or(colorConditions);
      }
    }

    // Get recent, high-quality images
    query = query
      .order('created_at', { ascending: false })
      .limit(count * 3); // Get more than needed for filtering

    const { data: images, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch images: ${error.message}`);
    }

    this.logger.info(`📊 Found ${images?.length || 0} potential images for curation`);

    // Process and score images
    const scoredImages = images.map(img => {
      return {
        ...img,
        score: this.scoreImageForAccount(img, strategy)
      };
    }).sort((a, b) => b.score - a.score);

    this.logger.info(`🎯 Scored ${scoredImages.length} images, top score: ${scoredImages[0]?.score || 0}`);

    // Return top images, ensuring variety
    return this.selectVariedImages(scoredImages, count);
  }

  /**
   * Score an image based on how well it fits the account strategy
   */
  scoreImageForAccount(image, strategy) {
    let score = 0;

    // Base score
    score += 10;

    // Aesthetic matching
    if (strategy.content_strategy?.aestheticFocus?.length > 0) {
      const aesthetics = strategy.content_strategy.aestheticFocus.filter(a => a && a.trim() !== '');
      if (aesthetics.length > 0 && image.aesthetic) {
        if (aesthetics.some(a => image.aesthetic.toLowerCase().includes(a.toLowerCase()))) {
          score += 20;
        }
      }
    }

    // Color matching
    if (strategy.content_strategy?.colorPalette?.length > 0) {
      const colors = strategy.content_strategy.colorPalette.filter(c => c && c.trim() !== '');
      if (colors.length > 0 && image.colors && Array.isArray(image.colors)) {
        if (colors.some(c => image.colors.some(imgColor => imgColor.toLowerCase().includes(c.toLowerCase())))) {
          score += 15;
        }
      }
    }

    // Season relevance (current season gets bonus)
    const currentMonth = new Date().getMonth();
    const currentSeason = this.getCurrentSeason(currentMonth);
    if (image.season && image.season.toLowerCase().includes(currentSeason.toLowerCase())) {
      score += 10;
    }

    // Additional traits matching
    if (image.additional && Array.isArray(image.additional)) {
      const additionalTraits = image.additional.map(trait => trait.toLowerCase());
      if (strategy.content_strategy?.aestheticFocus) {
        const aesthetics = strategy.content_strategy.aestheticFocus.filter(a => a && a.trim() !== '');
        if (aesthetics.some(aesthetic => additionalTraits.some(trait => trait.includes(aesthetic.toLowerCase())))) {
          score += 5;
        }
      }
    }

    return score;
  }

  /**
   * Select varied images to avoid repetition
   */
  selectVariedImages(scoredImages, count) {
    const selected = [];
    const usedAesthetics = new Set();
    const usedAccounts = new Set();

    for (const image of scoredImages) {
      if (selected.length >= count) break;

      // Avoid too many from same aesthetic or account
      const aesthetic = image.aesthetic?.toLowerCase() || 'unknown';
      const account = image.username;

      if (usedAesthetics.has(aesthetic) && usedAesthetics.size < 3) continue;
      if (usedAccounts.has(account) && usedAccounts.size < 2) continue;

      selected.push(image);
      usedAesthetics.add(aesthetic);
      usedAccounts.add(account);
    }

    // Fill remaining slots if needed
    while (selected.length < count && selected.length < scoredImages.length) {
      for (const image of scoredImages) {
        if (selected.length >= count) break;
        if (!selected.find(s => s.id === image.id)) {
          selected.push(image);
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

    const prompt = `Create engaging TikTok content for post ${postNumber} featuring these fashion elements:

AESTHETICS: ${aesthetics.join(', ')}
COLORS: ${colors.join(', ')}
SEASONS: ${seasons.join(', ')}

ACCOUNT STRATEGY:
- Target Audience: ${JSON.stringify(strategy.target_audience)}
- Content Focus: ${JSON.stringify(strategy.content_strategy)}
- Performance Goals: ${JSON.stringify(strategy.performance_goals)}

Create a post that will perform well on TikTok. Return JSON with:
- theme: A catchy theme/concept for the post
- caption: Engaging caption (2-3 sentences, no hashtags)
- hashtags: Array of 8-12 relevant hashtags (mix of trending and niche)
- primaryAesthetic: The main aesthetic this post focuses on

Make it authentic, engaging, and optimized for the target audience.`;

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
   * Save generated post to database
   */
  async saveGeneratedPost(post) {
    const { error } = await this.db.client
      .from('generated_posts')
      .insert({
        account_username: post.accountUsername,
        generation_id: `daily_${Date.now()}_${post.postNumber}`,
        image_paths: post.images.map(img => img.imagePath),
        caption: post.caption,
        hashtags: post.hashtags,
        created_at: post.generatedAt
      });

    if (error) {
      throw new Error(`Failed to save post: ${error.message}`);
    }
  }

  /**
   * Get current season based on month
   */
  getCurrentSeason(month) {
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }
} 