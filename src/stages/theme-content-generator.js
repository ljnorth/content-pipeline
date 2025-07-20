import { Logger } from '../utils/logger.js';
import { SupabaseClient } from '../database/supabase-client.js';
import { HookSlideStorage } from './hook-slide-storage.js';
import { BackgroundColorStorage } from './background-color-storage.js';

export class ThemeContentGenerator {
  constructor() {
    this.logger = new Logger();
    this.db = new SupabaseClient();
    this.hookSlideStorage = new HookSlideStorage();
    this.backgroundColorStorage = new BackgroundColorStorage();
  }

  // Generate theme-based content for a specific account
  async generateForAccount(accountUsername, options = {}) {
    const {
      preferredTheme = null,
      imageCount = 10,
      colorScheme = null,
      aestheticPreference = null,
      ensureColorUniformity = true
    } = options;

    this.logger.info(`🎯 Generating theme-based content for @${accountUsername}`);

    try {
      // Get account profile if available
      const accountProfile = await this.getAccountProfile(accountUsername);
      
      // Step 1: Select a hook slide based on account strategy
      const selectedHookSlide = await this.selectHookSlideForAccount(
        accountUsername, 
        preferredTheme, 
        aestheticPreference || accountProfile?.content_strategy?.aestheticFocus?.[0]
      );

      if (!selectedHookSlide) {
        throw new Error('No suitable hook slide found for this account');
      }

      this.logger.info(`✨ Selected hook slide theme: "${selectedHookSlide.theme}" (${selectedHookSlide.target_vibe})`);
      
      // Step 2: Generate color-matched content based on the hook slide
      const colorMatchedContent = await this.backgroundColorStorage.generateColorMatchedContent(
        selectedHookSlide.id,
        accountUsername,
        colorScheme
      );

      if (colorMatchedContent.images.length === 0) {
        this.logger.warn('⚠️ No color-matched images found, falling back to theme-only matching');
        
        // Fallback: Get content by theme without strict color matching
        const themeMatchedContent = await this.getContentByTheme(
          selectedHookSlide.theme,
          selectedHookSlide.target_vibe,
          accountUsername,
          imageCount
        );
        
        colorMatchedContent.images = themeMatchedContent;
      }

      // Step 3: Apply account-specific filtering and optimization
      const optimizedContent = await this.optimizeForAccount(
        colorMatchedContent.images,
        accountProfile,
        imageCount
      );

      // Step 4: Store generation record
      const generationRecord = await this.saveGenerationRecord({
        hookSlideId: selectedHookSlide.id,
        accountUsername,
        theme: selectedHookSlide.theme,
        targetVibe: selectedHookSlide.target_vibe,
        selectedImages: optimizedContent,
        colorScheme: colorMatchedContent.colorScheme,
        accountProfile
      });

      // Step 5: Mark hook slide as used
      await this.hookSlideStorage.markAsUsed(selectedHookSlide.id, generationRecord.id);

      this.logger.info(`🎉 Generated ${optimizedContent.length} images for theme: ${selectedHookSlide.theme}`);

      return {
        success: true,
        theme: selectedHookSlide.theme,
        targetVibe: selectedHookSlide.target_vibe,
        hookSlide: selectedHookSlide,
        colorScheme: colorMatchedContent.colorScheme,
        images: optimizedContent,
        generationId: generationRecord.id,
        accountAdaptation: {
          aestheticFocus: accountProfile?.content_strategy?.aestheticFocus || [],
          targetAudience: accountProfile?.target_audience || 'general',
          contentStrategy: accountProfile?.content_strategy || {}
        }
      };

    } catch (error) {
      this.logger.error(`❌ Theme content generation failed for @${accountUsername}: ${error.message}`);
      throw error;
    }
  }

  // Select the best hook slide for an account based on strategy and performance
  async selectHookSlideForAccount(accountUsername, preferredTheme = null, aestheticPreference = null) {
    try {
      let query = this.db.client
        .from('hook_slides')
        .select('*')
        .gte('confidence', 0.7)
        .order('times_used', { ascending: true }) // Prefer less-used slides
        .order('confidence', { ascending: false });

      // Filter by preferred theme if specified
      if (preferredTheme) {
        query = query.ilike('theme', `%${preferredTheme}%`);
      }

      // Filter by aesthetic preference if specified
      if (aestheticPreference) {
        query = query.ilike('target_vibe', `%${aestheticPreference}%`);
      }

      const { data: hookSlides, error } = await query.limit(20);

      if (error) {
        throw new Error(`Failed to fetch hook slides: ${error.message}`);
      }

      if (!hookSlides || hookSlides.length === 0) {
        // Try without filters if nothing found
        const { data: fallbackSlides } = await this.db.client
          .from('hook_slides')
          .select('*')
          .gte('confidence', 0.7)
          .order('confidence', { ascending: false })
          .limit(10);

        if (!fallbackSlides || fallbackSlides.length === 0) {
          return null;
        }
        
        hookSlides.push(...fallbackSlides);
      }

      // Score hook slides based on account compatibility
      const scoredSlides = await this.scoreHookSlidesForAccount(hookSlides, accountUsername);
      
      // Return the highest-scoring slide
      return scoredSlides[0] || null;

    } catch (error) {
      this.logger.error(`❌ Failed to select hook slide: ${error.message}`);
      throw error;
    }
  }

  // Score hook slides based on how well they match an account's strategy
  async scoreHookSlidesForAccount(hookSlides, accountUsername) {
    const accountProfile = await this.getAccountProfile(accountUsername);
    
    const scoredSlides = hookSlides.map(slide => {
      let score = slide.confidence; // Base score from AI confidence
      
      // Boost score based on account strategy alignment
      if (accountProfile?.content_strategy?.aestheticFocus) {
        const aestheticMatch = accountProfile.content_strategy.aestheticFocus.some(aesthetic =>
          slide.target_vibe?.toLowerCase().includes(aesthetic.toLowerCase())
        );
        if (aestheticMatch) score += 0.3;
      }

      // Boost score for less-used slides to ensure variety
      const usageBonus = Math.max(0, 0.2 - (slide.times_used * 0.05));
      score += usageBonus;

      // Boost score based on theme popularity vs uniqueness
      const themeBonus = slide.theme?.length > 15 ? 0.1 : 0; // Prefer specific themes
      score += themeBonus;

      return { ...slide, accountScore: score };
    });

    // Sort by account-specific score
    return scoredSlides.sort((a, b) => b.accountScore - a.accountScore);
  }

  // Get content by theme without strict color matching (fallback)
  async getContentByTheme(theme, targetVibe, accountUsername, limit = 10) {
    try {
      let query = this.db.client
        .from('images')
        .select('*, posts!inner(engagement_rate, like_count, view_count)')
        .not('aesthetic', 'is', null);

      // Filter by aesthetic if possible
      if (targetVibe) {
        query = query.or(`aesthetic.ilike.%${targetVibe}%,additional.cs.{${targetVibe}}`);
      }

      // Get performance-sorted results
      const { data: images, error } = await query
        .order('posts(engagement_rate)', { ascending: false, nullsLast: true })
        .limit(limit * 3); // Get more options to filter

      if (error) {
        throw new Error(`Failed to fetch theme content: ${error.message}`);
      }

      return images?.slice(0, limit) || [];

    } catch (error) {
      this.logger.error(`❌ Failed to get content by theme: ${error.message}`);
      return [];
    }
  }

  // Optimize content selection for a specific account
  async optimizeForAccount(images, accountProfile, targetCount) {
    if (!images || images.length === 0) return [];

    // Apply account-specific filtering
    let filteredImages = images;

    if (accountProfile?.content_strategy?.aestheticFocus) {
      const aestheticFiltered = images.filter(img => {
        if (!img.aesthetic) return true;
        return accountProfile.content_strategy.aestheticFocus.some(aesthetic =>
          img.aesthetic.toLowerCase().includes(aesthetic.toLowerCase())
        );
      });
      
      if (aestheticFiltered.length > 0) {
        filteredImages = aestheticFiltered;
      }
    }

    // Ensure diversity in the selection
    const diverseImages = this.ensureDiversity(filteredImages, targetCount);

    // Sort by performance if available
    const performanceSorted = diverseImages.sort((a, b) => {
      const aEngagement = a.posts?.engagement_rate || a.engagement_rate || 0;
      const bEngagement = b.posts?.engagement_rate || b.engagement_rate || 0;
      return bEngagement - aEngagement;
    });

    return performanceSorted.slice(0, targetCount);
  }

  // Ensure diversity in image selection
  ensureDiversity(images, targetCount) {
    if (images.length <= targetCount) return images;

    const diverse = [];
    const usedUsers = new Set();
    const usedAesthetics = new Set();

    // First pass: Pick diverse aesthetics and users
    for (const img of images) {
      if (diverse.length >= targetCount) break;
      
      const userUnique = !usedUsers.has(img.username);
      const aestheticUnique = !usedAesthetics.has(img.aesthetic);
      
      if (userUnique || aestheticUnique) {
        diverse.push(img);
        usedUsers.add(img.username);
        usedAesthetics.add(img.aesthetic);
      }
    }

    // Second pass: Fill remaining slots with best remaining images
    if (diverse.length < targetCount) {
      const remaining = images.filter(img => !diverse.includes(img));
      diverse.push(...remaining.slice(0, targetCount - diverse.length));
    }

    return diverse;
  }

  // Get account profile with content strategy
  async getAccountProfile(accountUsername) {
    try {
      const { data: profile, error } = await this.db.client
        .from('account_profiles')
        .select('*')
        .eq('username', accountUsername)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is OK
        this.logger.warn(`⚠️ Could not fetch account profile for @${accountUsername}: ${error.message}`);
      }

      return profile || null;
    } catch (error) {
      this.logger.warn(`⚠️ Account profile query failed: ${error.message}`);
      return null;
    }
  }

  // Save generation record for tracking and analytics
  async saveGenerationRecord(data) {
    try {
      const generationData = {
        hook_slide_id: data.hookSlideId,
        account_username: data.accountUsername,
        theme: data.theme,
        target_vibe: data.targetVibe,
        selected_images: data.selectedImages.map(img => ({
          id: img.id,
          post_id: img.post_id,
          image_path: img.image_path,
          aesthetic: img.aesthetic,
          primary_bg_color: img.primary_bg_color,
          username: img.username
        })),
        image_count: data.selectedImages.length,
        account_aesthetic_focus: data.accountProfile?.content_strategy?.aestheticFocus || [],
        background_colors: data.colorScheme ? [data.colorScheme.primary_bg_color] : [],
        created_at: new Date().toISOString()
      };

      const { data: record, error } = await this.db.client
        .from('theme_generations')
        .insert(generationData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to save generation record: ${error.message}`);
      }

      this.logger.info(`💾 Saved generation record with ID: ${record.id}`);
      return record;

    } catch (error) {
      this.logger.error(`❌ Failed to save generation record: ${error.message}`);
      throw error;
    }
  }

  // Get available themes for UI
  async getAvailableThemes() {
    try {
      const themes = await this.hookSlideStorage.getAvailableThemes();
      return {
        success: true,
        themes: themes
      };
    } catch (error) {
      this.logger.error(`❌ Failed to get available themes: ${error.message}`);
      return {
        success: false,
        error: error.message,
        themes: []
      };
    }
  }

  // Get generation analytics
  async getGenerationAnalytics(accountUsername = null) {
    try {
      let query = this.db.client
        .from('theme_generations')
        .select('*');

      if (accountUsername) {
        query = query.eq('account_username', accountUsername);
      }

      const { data: generations, error } = await query
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        throw new Error(`Failed to fetch generation analytics: ${error.message}`);
      }

      // Calculate analytics
      const analytics = this.calculateGenerationAnalytics(generations || []);
      
      return {
        success: true,
        analytics,
        generations: generations || []
      };

    } catch (error) {
      this.logger.error(`❌ Failed to get generation analytics: ${error.message}`);
      return {
        success: false,
        error: error.message,
        analytics: null
      };
    }
  }

  calculateGenerationAnalytics(generations) {
    if (generations.length === 0) {
      return {
        totalGenerations: 0,
        popularThemes: [],
        averageImageCount: 0,
        recentActivity: []
      };
    }

    // Theme popularity
    const themeCount = {};
    let totalImages = 0;

    generations.forEach(gen => {
      themeCount[gen.theme] = (themeCount[gen.theme] || 0) + 1;
      totalImages += gen.image_count || 0;
    });

    const popularThemes = Object.entries(themeCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([theme, count]) => ({ theme, count }));

    return {
      totalGenerations: generations.length,
      popularThemes,
      averageImageCount: Math.round(totalImages / generations.length),
      recentActivity: generations.slice(0, 10).map(gen => ({
        theme: gen.theme,
        accountUsername: gen.account_username,
        imageCount: gen.image_count,
        createdAt: gen.created_at
      }))
    };
  }
} 