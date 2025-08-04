import { Logger } from '../utils/logger.js';
import { SupabaseClient } from '../database/supabase-client.js';
import OpenAI from 'openai';

export class ThemeDiscoveryAnalyzer {
  constructor() {
    this.logger = new Logger();
    this.db = new SupabaseClient();
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.totalCost = 0;
    this.processedCount = 0;
    this.themesDiscovered = 0;
  }

  /**
   * STEP 1: Identify high-performing posts (engagement > 5%)
   * Think of this as finding your "greatest hits" - the posts that got lots of likes/views
   */
  async identifyHighPerformingPosts(minEngagementRate = 0.05) {
    this.logger.info(`🔍 Finding high-performing posts with engagement > ${(minEngagementRate * 100).toFixed(1)}%`);
    
    try {
      // Get posts with high engagement rates
      const { data: highPerformingPosts, error } = await this.db.client
        .from('posts')
        .select(`
          post_id,
          username,
          engagement_rate,
          like_count,
          view_count,
          comment_count,
          save_count,
          created_at
        `)
        .gt('engagement_rate', minEngagementRate)
        .order('engagement_rate', { ascending: false })
        .limit(500); // Get top 500 high-performing posts

      if (error) {
        throw new Error(`Failed to fetch high-performing posts: ${error.message}`);
      }

      if (!highPerformingPosts || highPerformingPosts.length === 0) {
        this.logger.warn(`⚠️ No posts found with engagement > ${(minEngagementRate * 100).toFixed(1)}%`);
        return [];
      }

      this.logger.info(`✅ Found ${highPerformingPosts.length} high-performing posts`);
      
      // Get images for these posts
      const postIds = highPerformingPosts.map(p => p.post_id);
      const { data: images, error: imagesError } = await this.db.client
        .from('images')
        .select(`
          id,
          post_id,
          username,
          image_path,
          aesthetic,
          colors,
          season,
          occasion,
          additional
        `)
        .in('post_id', postIds)
        .not('aesthetic', 'is', null); // Only get images with AI analysis

      if (imagesError) {
        throw new Error(`Failed to fetch images: ${imagesError.message}`);
      }

      // Combine post performance data with image data
      const enrichedData = images?.map(image => {
        const post = highPerformingPosts.find(p => p.post_id === image.post_id);
        return {
          ...image,
          engagement_rate: post?.engagement_rate || 0,
          like_count: post?.like_count || 0,
          view_count: post?.view_count || 0,
          performance_score: this.calculatePerformanceScore(post)
        };
      }) || [];

      this.logger.info(`📊 Enriched ${enrichedData.length} images with performance data`);
      return enrichedData;

    } catch (error) {
      this.logger.error(`❌ Failed to identify high-performing posts: ${error.message}`);
      throw error;
    }
  }

  /**
   * STEP 2: Group posts by common patterns (aesthetic + season + occasion)
   * Think of this as sorting your greatest hits into categories like "Summer Streetwear" or "Fall Date Night"
   */
  async groupByCommonPatterns(highPerformingImages) {
    this.logger.info(`🔄 Grouping ${highPerformingImages.length} high-performing images by patterns`);
    
    const patterns = {};
    
    for (const image of highPerformingImages) {
      // Create a pattern key combining aesthetic, season, and occasion
      const aesthetic = image.aesthetic || 'unknown';
      const season = image.season || 'any';
      const occasion = image.occasion || 'casual';
      
      const patternKey = `${aesthetic}_${season}_${occasion}`;
      
      if (!patterns[patternKey]) {
        patterns[patternKey] = {
          pattern: {
            aesthetic,
            season,
            occasion,
            colors: []
          },
          images: [],
          totalEngagement: 0,
          avgEngagement: 0,
          postCount: 0
        };
      }
      
      patterns[patternKey].images.push(image);
      patterns[patternKey].totalEngagement += image.engagement_rate || 0;
      patterns[patternKey].postCount++;
      
      // Collect unique colors
      if (image.colors && Array.isArray(image.colors)) {
        image.colors.forEach(color => {
          if (!patterns[patternKey].pattern.colors.includes(color)) {
            patterns[patternKey].pattern.colors.push(color);
          }
        });
      }
    }
    
    // Calculate average engagement for each pattern
    Object.keys(patterns).forEach(key => {
      const pattern = patterns[key];
      pattern.avgEngagement = pattern.totalEngagement / pattern.postCount;
    });
    
    // Convert to array and sort by performance
    const sortedPatterns = Object.values(patterns)
      .filter(p => p.postCount >= 3) // Only keep patterns with at least 3 posts
      .sort((a, b) => b.avgEngagement - a.avgEngagement);
    
    this.logger.info(`📈 Found ${sortedPatterns.length} high-performing patterns`);
    return sortedPatterns;
  }

  /**
   * STEP 3: Extract theme keywords and hashtags using AI
   * Think of this as having AI look at your successful posts and say "I see the pattern - this is 'Cozy Fall Vibes'"
   */
  async extractThemeKeywords(patterns) {
    this.logger.info(`🤖 Using AI to extract theme keywords from ${patterns.length} patterns`);
    
    const discoveredThemes = [];
    
    for (const pattern of patterns.slice(0, 20)) { // Process top 20 patterns
      try {
        const prompt = `Analyze this high-performing fashion content pattern and create a theme:

PATTERN DATA:
- Aesthetic: ${pattern.pattern.aesthetic}
- Season: ${pattern.pattern.season}
- Occasion: ${pattern.pattern.occasion}
- Colors: ${pattern.pattern.colors.join(', ')}
- Posts in pattern: ${pattern.postCount}
- Average engagement: ${(pattern.avgEngagement * 100).toFixed(2)}%

Create a catchy theme name and suggest content strategy. Return JSON:
{
  "theme_name": "Short, catchy theme name (e.g., 'Cozy Fall Vibes', 'Summer Streetwear')",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"],
  "description": "Brief description of this theme",
  "target_audience": "Who this appeals to",
  "content_direction": "What type of content to create for this theme"
}`;

        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          max_tokens: 300,
          temperature: 0.3
        });

        const themeData = JSON.parse(response.choices[0].message.content);
        
        // Track costs
        this.totalCost += (response.usage.prompt_tokens * 0.000150 / 1000) + 
                         (response.usage.completion_tokens * 0.000600 / 1000);
        this.processedCount++;

        const discoveredTheme = {
          ...themeData,
          pattern: pattern.pattern,
          performance_metrics: {
            avg_engagement: pattern.avgEngagement,
            post_count: pattern.postCount,
            total_engagement: pattern.totalEngagement
          },
          sample_images: pattern.images.slice(0, 5), // Keep top 5 sample images
          discovered_at: new Date().toISOString()
        };

        discoveredThemes.push(discoveredTheme);
        this.themesDiscovered++;

        this.logger.info(`✨ Discovered theme: "${themeData.theme_name}" (${pattern.postCount} posts, ${(pattern.avgEngagement * 100).toFixed(2)}% avg engagement)`);

      } catch (error) {
        this.logger.error(`❌ Failed to extract theme for pattern: ${error.message}`);
        continue;
      }
    }

    this.logger.info(`🎉 Theme discovery complete: ${this.themesDiscovered} themes discovered, $${this.totalCost.toFixed(4)} spent`);
    return discoveredThemes;
  }

  /**
   * STEP 4: Calculate performance metrics for themes
   * Think of this as giving each theme a "report card" showing how well it performs
   */
  calculateThemePerformanceMetrics(themes) {
    this.logger.info(`📊 Calculating performance metrics for ${themes.length} themes`);
    
    return themes.map(theme => {
      const metrics = theme.performance_metrics;
      
      // Calculate performance score (0-100)
      const performanceScore = Math.min(100, metrics.avg_engagement * 1000);
      
      // Determine confidence level
      let confidence = 'low';
      if (metrics.post_count >= 10 && metrics.avg_engagement >= 0.08) {
        confidence = 'high';
      } else if (metrics.post_count >= 5 && metrics.avg_engagement >= 0.05) {
        confidence = 'medium';
      }
      
      return {
        ...theme,
        performance_metrics: {
          ...metrics,
          performance_score: performanceScore,
          confidence_level: confidence,
          recommended_for_generation: confidence !== 'low'
        }
      };
    });
  }

  /**
   * STEP 5: Store discovered themes in database
   * Think of this as saving your "recipe book" so the system can use it later
   */
  async storeDiscoveredThemes(themes) {
    this.logger.info(`💾 Storing ${themes.length} discovered themes in database`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const theme of themes) {
      try {
        const { error } = await this.db.client
          .from('discovered_themes')
          .upsert({
            theme_name: theme.theme_name,
            keywords: theme.keywords,
            hashtags: theme.hashtags,
            description: theme.description,
            target_audience: theme.target_audience,
            content_direction: theme.content_direction,
            aesthetic: theme.pattern.aesthetic,
            season: theme.pattern.season,
            occasion: theme.pattern.occasion,
            colors: theme.pattern.colors,
            avg_engagement_rate: theme.performance_metrics.avg_engagement,
            post_count: theme.performance_metrics.post_count,
            performance_score: theme.performance_metrics.performance_score,
            confidence_level: theme.performance_metrics.confidence_level,
            sample_image_paths: theme.sample_images.map(img => img.image_path),
            discovered_at: theme.discovered_at,
            is_active: theme.performance_metrics.recommended_for_generation
          }, { 
            onConflict: 'theme_name',
            ignoreDuplicates: false 
          });

        if (error) {
          this.logger.error(`❌ Failed to store theme "${theme.theme_name}": ${error.message}`);
          errorCount++;
        } else {
          successCount++;
        }

      } catch (error) {
        this.logger.error(`❌ Error storing theme "${theme.theme_name}": ${error.message}`);
        errorCount++;
      }
    }
    
    this.logger.info(`✅ Theme storage complete: ${successCount} successful, ${errorCount} failed`);
    return { successCount, errorCount };
  }

  /**
   * Helper function to calculate overall performance score
   */
  calculatePerformanceScore(post) {
    if (!post) return 0;
    
    // Weighted score combining different engagement metrics
    const engagementWeight = 0.4;
    const likesWeight = 0.3;
    const viewsWeight = 0.2;
    const commentsWeight = 0.1;
    
    const normalizedLikes = Math.min(1, (post.like_count || 0) / 10000);
    const normalizedViews = Math.min(1, (post.view_count || 0) / 100000);
    const normalizedComments = Math.min(1, (post.comment_count || 0) / 1000);
    
    return (
      (post.engagement_rate || 0) * engagementWeight +
      normalizedLikes * likesWeight +
      normalizedViews * viewsWeight +
      normalizedComments * commentsWeight
    );
  }

  /**
   * Main execution function - runs the complete theme discovery process
   */
  async runThemeDiscovery(options = {}) {
    const {
      minEngagementRate = 0.05,
      maxThemes = 20
    } = options;

    this.logger.info(`🚀 Starting Performance-Based Theme Discovery`);
    this.logger.info(`📋 Settings: Min engagement ${(minEngagementRate * 100).toFixed(1)}%, Max themes: ${maxThemes}`);

    try {
      // Step 1: Find high-performing posts
      const highPerformingImages = await this.identifyHighPerformingPosts(minEngagementRate);
      
      if (highPerformingImages.length === 0) {
        throw new Error('No high-performing posts found. Try lowering the engagement threshold.');
      }

      // Step 2: Group by patterns
      const patterns = await this.groupByCommonPatterns(highPerformingImages);
      
      if (patterns.length === 0) {
        throw new Error('No common patterns found in high-performing posts.');
      }

      // Step 3: Extract themes with AI
      const themes = await this.extractThemeKeywords(patterns.slice(0, maxThemes));
      
      if (themes.length === 0) {
        throw new Error('No themes could be extracted from the patterns.');
      }

      // Step 4: Calculate performance metrics
      const themesWithMetrics = this.calculateThemePerformanceMetrics(themes);

      // Step 5: Store in database
      const storageResult = await this.storeDiscoveredThemes(themesWithMetrics);

      this.logger.info(`🎉 Theme Discovery Complete!`);
      this.logger.info(`   📊 High-performing images analyzed: ${highPerformingImages.length}`);
      this.logger.info(`   🔍 Patterns identified: ${patterns.length}`);
      this.logger.info(`   ✨ Themes discovered: ${themes.length}`);
      this.logger.info(`   💾 Themes stored: ${storageResult.successCount}`);
      this.logger.info(`   💰 Total cost: $${this.totalCost.toFixed(4)}`);

      return {
        success: true,
        summary: {
          highPerformingImages: highPerformingImages.length,
          patternsFound: patterns.length,
          themesDiscovered: themes.length,
          themesStored: storageResult.successCount,
          totalCost: this.totalCost
        },
        themes: themesWithMetrics
      };

    } catch (error) {
      this.logger.error(`❌ Theme discovery failed: ${error.message}`);
      throw error;
    }
  }
} 