import { Logger } from '../utils/logger.js';
import { SupabaseClient } from '../database/supabase-client.js';
import OpenAI from 'openai';

export class PerformanceBasedContentGenerator {
  constructor() {
    this.logger = new Logger();
    this.db = new SupabaseClient();
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.totalCost = 0;
  }

  /**
   * Generate content using performance-based themes
   * This is like using your "recipe book" of successful content patterns
   */
  async generateContentWithThemes(accountUsername, options = {}) {
    const {
      postCount = 3,
      imageCount = 5,
      useTopThemes = true,
      preferredThemes = [],
      minConfidence = 'medium'
    } = options;

    this.logger.info(`🎯 Generating performance-based content for @${accountUsername}`);
    this.logger.info(`📋 Settings: ${postCount} posts, ${imageCount} images each, min confidence: ${minConfidence}`);

    try {
      // Step 1: Get account profile for targeting
      const accountProfile = await this.getAccountProfile(accountUsername);
      
      // Step 2: Get recommended themes for this account
      const recommendedThemes = await this.getRecommendedThemes(
        accountProfile,
        preferredThemes,
        minConfidence
      );

      if (recommendedThemes.length === 0) {
        throw new Error(`No suitable themes found for @${accountUsername}. Try running theme discovery first or lowering the confidence threshold.`);
      }

      this.logger.info(`✨ Found ${recommendedThemes.length} recommended themes for @${accountUsername}`);

      // Step 3: Generate posts using the recommended themes
      const generatedPosts = [];
      
      for (let i = 0; i < postCount; i++) {
        // Select a theme for this post (rotate through available themes)
        const selectedTheme = recommendedThemes[i % recommendedThemes.length];
        
        this.logger.info(`📝 Generating post ${i + 1}/${postCount} using theme: "${selectedTheme.theme_name}"`);
        
        const post = await this.generateSinglePostWithTheme(
          accountUsername,
          selectedTheme,
          accountProfile,
          imageCount,
          i + 1
        );
        
        generatedPosts.push(post);
        
        // Update theme usage
        await this.updateThemeUsage(selectedTheme.theme_name);
      }

      // Step 4: Save generation record
      const generationRecord = {
        id: `perf_gen_${Date.now()}_${accountUsername}`,
        accountUsername,
        generationType: 'performance_based',
        posts: generatedPosts,
        themesUsed: generatedPosts.map(p => p.theme),
        totalCost: this.totalCost,
        generatedAt: new Date().toISOString()
      };

      await this.saveGenerationRecord(generationRecord);

      this.logger.info(`🎉 Performance-based content generation complete!`);
      this.logger.info(`   📝 Posts generated: ${generatedPosts.length}`);
      this.logger.info(`   🎨 Themes used: ${[...new Set(generatedPosts.map(p => p.theme))].join(', ')}`);
      this.logger.info(`   💰 Total cost: $${this.totalCost.toFixed(4)}`);

      return {
        success: true,
        generation: generationRecord,
        posts: generatedPosts,
        summary: {
          postsGenerated: generatedPosts.length,
          themesUsed: [...new Set(generatedPosts.map(p => p.theme))],
          totalCost: this.totalCost
        }
      };

    } catch (error) {
      this.logger.error(`❌ Performance-based content generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get recommended themes for an account based on their profile and preferences
   */
  async getRecommendedThemes(accountProfile, preferredThemes = [], minConfidence = 'medium') {
    this.logger.info(`🔍 Getting recommended themes for account...`);

    try {
      let query = this.db.client
        .from('discovered_themes')
        .select('*')
        .eq('is_active', true);

      // Filter by confidence level
      if (minConfidence === 'high') {
        query = query.eq('confidence_level', 'high');
      } else if (minConfidence === 'medium') {
        query = query.in('confidence_level', ['medium', 'high']);
      }
      // 'low' includes all confidence levels

      // Filter by preferred themes if specified
      if (preferredThemes.length > 0) {
        query = query.in('theme_name', preferredThemes);
      }

      const { data: themes, error } = await query
        .order('performance_score', { ascending: false })
        .limit(10);

      if (error) {
        throw new Error(`Failed to fetch themes: ${error.message}`);
      }

      if (!themes || themes.length === 0) {
        this.logger.warn('⚠️ No themes found matching criteria');
        return [];
      }

      // Score themes based on account compatibility
      const scoredThemes = themes.map(theme => {
        let compatibilityScore = theme.performance_score; // Base score
        
        // Bonus for matching account aesthetic
        if (accountProfile?.content_strategy?.aestheticFocus?.includes(theme.aesthetic)) {
          compatibilityScore += 20;
        }
        
        // Bonus for current season (if we can determine it)
        const currentMonth = new Date().getMonth();
        const currentSeason = this.getCurrentSeason(currentMonth);
        if (theme.season === currentSeason || theme.season === 'any') {
          compatibilityScore += 10;
        }
        
        return {
          ...theme,
          compatibility_score: compatibilityScore
        };
      });

      // Sort by compatibility score
      scoredThemes.sort((a, b) => b.compatibility_score - a.compatibility_score);

      this.logger.info(`📊 Scored ${scoredThemes.length} themes for compatibility`);
      return scoredThemes;

    } catch (error) {
      this.logger.error(`❌ Failed to get recommended themes: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate a single post using a specific theme
   */
  async generateSinglePostWithTheme(accountUsername, theme, accountProfile, imageCount, postNumber) {
    this.logger.info(`🎨 Generating post with theme: "${theme.theme_name}"`);

    try {
      // Step 1: Find images that match the theme's pattern
      const matchingImages = await this.findImagesForTheme(theme, accountUsername, imageCount);
      
      if (matchingImages.length < imageCount) {
        this.logger.warn(`⚠️ Only found ${matchingImages.length} images for theme "${theme.theme_name}", needed ${imageCount}`);
        if (matchingImages.length === 0) {
          throw new Error(`No images found matching theme "${theme.theme_name}"`);
        }
      }

      // Step 2: Generate caption and hashtags using the theme's strategy
      const content = await this.generateThemeBasedContent(
        theme,
        matchingImages,
        accountProfile,
        postNumber
      );

      // Step 3: Create post object
      const post = {
        accountUsername,
        postNumber,
        theme: theme.theme_name,
        themeDescription: theme.description,
        images: matchingImages.map(img => ({
          id: img.id,
          imagePath: img.image_path,
          aesthetic: img.aesthetic,
          colors: img.colors,
          season: img.season
        })),
        caption: content.caption,
        hashtags: content.hashtags,
        strategy: {
          themeUsed: theme.theme_name,
          expectedPerformance: theme.performance_score,
          confidenceLevel: theme.confidence_level,
          targetAudience: theme.target_audience
        },
        generatedAt: new Date().toISOString()
      };

      this.logger.info(`✅ Generated post "${theme.theme_name}" with ${matchingImages.length} images`);
      return post;

    } catch (error) {
      this.logger.error(`❌ Failed to generate post with theme "${theme.theme_name}": ${error.message}`);
      throw error;
    }
  }

  /**
   * Find images that match a theme's pattern
   */
  async findImagesForTheme(theme, accountUsername, imageCount) {
    this.logger.info(`🔍 Finding images matching theme pattern...`);

    try {
      let query = this.db.client
        .from('images')
        .select('*')
        .not('aesthetic', 'is', null); // Only get analyzed images

      // Filter by theme's aesthetic
      if (theme.aesthetic && theme.aesthetic !== 'unknown') {
        query = query.eq('aesthetic', theme.aesthetic);
      }

      // Filter by theme's season
      if (theme.season && theme.season !== 'any') {
        query = query.eq('season', theme.season);
      }

      // Filter by theme's occasion
      if (theme.occasion && theme.occasion !== 'casual') {
        query = query.eq('occasion', theme.occasion);
      }

      // Filter by theme's colors (if any)
      if (theme.colors && theme.colors.length > 0) {
        // Use overlap operator to find images with any of the theme colors
        query = query.overlaps('colors', theme.colors);
      }

      // Get recently used images to avoid duplicates
      const recentlyUsed = await this.getRecentlyUsedImages(accountUsername);
      if (recentlyUsed.length > 0) {
        query = query.not('id', 'in', `(${recentlyUsed.join(',')})`);
      }

      const { data: images, error } = await query
        .limit(imageCount * 2) // Get extra images in case some are filtered out
        .order('id', { ascending: false }); // Get newer images first

      if (error) {
        throw new Error(`Failed to fetch images: ${error.message}`);
      }

      // Shuffle and take the requested count
      const shuffledImages = images?.sort(() => 0.5 - Math.random()) || [];
      return shuffledImages.slice(0, imageCount);

    } catch (error) {
      this.logger.error(`❌ Failed to find images for theme: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate caption and hashtags based on theme strategy
   */
  async generateThemeBasedContent(theme, images, accountProfile, postNumber) {
    this.logger.info(`🤖 Generating content using theme strategy...`);

    try {
      const prompt = `Create TikTok content using this high-performing theme:

THEME: "${theme.theme_name}"
DESCRIPTION: ${theme.description}
TARGET AUDIENCE: ${theme.target_audience}
CONTENT DIRECTION: ${theme.content_direction}
PERFORMANCE SCORE: ${theme.performance_score}/100
CONFIDENCE: ${theme.confidence_level}

SUGGESTED KEYWORDS: ${theme.keywords?.join(', ') || 'N/A'}
SUGGESTED HASHTAGS: ${theme.hashtags?.join(', ') || 'N/A'}

ACCOUNT PROFILE:
- Target Audience: ${JSON.stringify(accountProfile?.target_audience || {})}
- Content Strategy: ${JSON.stringify(accountProfile?.content_strategy || {})}

IMAGES SELECTED:
${images.map((img, i) => `${i + 1}. Aesthetic: ${img.aesthetic}, Colors: ${img.colors?.join(', ') || 'N/A'}, Season: ${img.season}`).join('\n')}

Instructions:
- Create content that follows this proven theme pattern
- Use the suggested keywords and hashtags as inspiration
- Write a simple, engaging caption (1-2 sentences + emojis)
- Include hashtags at the end of the caption
- Make it authentic and match the target audience
- Remember this theme has a ${theme.performance_score}/100 performance score

Return JSON:
{
  "caption": "Caption with hashtags at the end",
  "primary_message": "Main message of the post",
  "engagement_hooks": ["hook1", "hook2"],
  "expected_performance": "high/medium/low based on theme data"
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 400,
        temperature: 0.4
      });

      // Track costs
      this.totalCost += (response.usage.prompt_tokens * 0.000150 / 1000) + 
                       (response.usage.completion_tokens * 0.000600 / 1000);

      const content = JSON.parse(response.choices[0].message.content);
      
      // Extract hashtags from caption if they're included
      const hashtags = this.extractHashtags(content.caption);
      
      return {
        caption: content.caption,
        hashtags: hashtags,
        primaryMessage: content.primary_message,
        engagementHooks: content.engagement_hooks,
        expectedPerformance: content.expected_performance
      };

    } catch (error) {
      this.logger.error(`❌ Failed to generate theme-based content: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper functions
   */

  async getAccountProfile(accountUsername) {
    try {
      const { data: profile, error } = await this.db.client
        .from('account_profiles')
        .select('*')
        .eq('username', accountUsername)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is OK
        this.logger.warn(`⚠️ Could not fetch account profile: ${error.message}`);
      }

      return profile || null;
    } catch (error) {
      this.logger.warn(`⚠️ Error fetching account profile: ${error.message}`);
      return null;
    }
  }

  async getRecentlyUsedImages(accountUsername, days = 30) {
    try {
      const { data: recentUsage, error } = await this.db.client
        .from('image_usage')
        .select('image_id')
        .eq('account_username', accountUsername)
        .gte('used_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

      if (error) {
        this.logger.warn(`⚠️ Could not fetch recent image usage: ${error.message}`);
        return [];
      }

      return recentUsage?.map(u => u.image_id) || [];
    } catch (error) {
      this.logger.warn(`⚠️ Error fetching recent image usage: ${error.message}`);
      return [];
    }
  }

  async updateThemeUsage(themeName) {
    try {
      const { error } = await this.db.client
        .from('discovered_themes')
        .update({
          times_used_for_generation: this.db.client.raw('times_used_for_generation + 1'),
          last_used_at: new Date().toISOString()
        })
        .eq('theme_name', themeName);

      if (error) {
        this.logger.warn(`⚠️ Could not update theme usage: ${error.message}`);
      }
    } catch (error) {
      this.logger.warn(`⚠️ Error updating theme usage: ${error.message}`);
    }
  }

  async saveGenerationRecord(generationRecord) {
    try {
      const { error } = await this.db.client
        .from('saved_generations')
        .insert({
          generation_id: generationRecord.id,
          name: `Performance-based generation for @${generationRecord.accountUsername}`,
          account_username: generationRecord.accountUsername,
          generation_type: 'performance_based',
          generation_params: {
            themes_used: generationRecord.themesUsed,
            generation_type: generationRecord.generationType
          },
          image_data: generationRecord.posts.map(p => ({
            theme: p.theme,
            images: p.images,
            strategy: p.strategy
          })),
          image_count: generationRecord.posts.reduce((sum, p) => sum + p.images.length, 0)
        });

      if (error) {
        this.logger.warn(`⚠️ Could not save generation record: ${error.message}`);
      } else {
        this.logger.info(`💾 Saved generation record: ${generationRecord.id}`);
      }
    } catch (error) {
      this.logger.warn(`⚠️ Error saving generation record: ${error.message}`);
    }
  }

  getCurrentSeason(month) {
    // Northern hemisphere seasons
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  extractHashtags(text) {
    const hashtagRegex = /#[\w\d_]+/g;
    const matches = text.match(hashtagRegex);
    return matches || [];
  }
} 