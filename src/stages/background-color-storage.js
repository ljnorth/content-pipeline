import { Logger } from '../utils/logger.js';
import { SupabaseClient } from '../database/supabase-client.js';

export class BackgroundColorStorage {
  constructor() {
    this.logger = new Logger();
    this.db = new SupabaseClient();
  }

  async process(colorAnalysisResults) {
    this.logger.info(`🎨 Starting background color storage - ${colorAnalysisResults.length} images to update`);
    
    let updatedCount = 0;
    let failedCount = 0;

    for (const result of colorAnalysisResults) {
      try {
        await this.updateImageBackgroundColors(result);
        updatedCount++;
      } catch (error) {
        this.logger.error(`❌ Failed to update background colors for ${result.post_id}: ${error.message}`);
        failedCount++;
      }
    }

    // Run the database function to extract JSONB data to columns
    try {
      await this.db.client.rpc('update_image_background_colors');
      this.logger.info(`✅ Extracted background color data to structured columns`);
    } catch (error) {
      this.logger.warn(`⚠️ Failed to run background color extraction: ${error.message}`);
    }

    this.logger.info(`✅ Background color storage complete: ${updatedCount} successful, ${failedCount} failed`);
    
    return {
      updated: updatedCount,
      failed: failedCount,
      total: colorAnalysisResults.length
    };
  }

  async updateImageBackgroundColors(result) {
    // Find the image record to update
    const { data: existingImages, error: fetchError } = await this.db.client
      .from('images')
      .select('id')
      .eq('post_id', result.post_id)
      .eq('image_path', result.image_path);

    if (fetchError) {
      throw new Error(`Failed to find image: ${fetchError.message}`);
    }

    if (!existingImages || existingImages.length === 0) {
      this.logger.warn(`⚠️ No existing image found for ${result.post_id} - skipping background color update`);
      return;
    }

    // Update the image with background analysis
    const updateData = {
      background_analysis: result.background_analysis,
      primary_bg_color: result.background_analysis.primary_bg_color,
      secondary_bg_color: result.background_analysis.secondary_bg_color,
      bg_color_hex: result.background_analysis.bg_color_hex,
      bg_type: result.background_analysis.bg_type,
      bg_brightness: result.background_analysis.bg_brightness,
      uniformity_score: result.background_analysis.uniformity_score,
      suitable_for_matching: result.background_analysis.suitable_for_matching,
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await this.db.client
      .from('images')
      .update(updateData)
      .eq('id', existingImages[0].id);

    if (updateError) {
      throw new Error(`Database update error: ${updateError.message}`);
    }

    this.logger.info(`✅ Updated background colors: ${result.background_analysis.primary_bg_color} (${(result.background_analysis.uniformity_score * 100).toFixed(0)}% uniform)`);
  }

  // Get images with matching background colors for content generation
  async getImagesByBackgroundColor(targetColor, targetBrightness = null, limit = 50) {
    try {
      const { data, error } = await this.db.client
        .rpc('get_color_matched_images', {
          target_color: targetColor,
          target_brightness: targetBrightness,
          min_uniformity: 0.7,
          limit_count: limit
        });

      if (error) {
        throw new Error(`Error fetching color-matched images: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      this.logger.error(`❌ Failed to get images by background color: ${error.message}`);
      throw error;
    }
  }

  // Get recommended background colors for content generation
  async getRecommendedBackgroundColors(aesthetic = null, username = null) {
    try {
      const { data, error } = await this.db.client
        .rpc('suggest_background_colors', {
          aesthetic_filter: aesthetic,
          username_filter: username
        });

      if (error) {
        throw new Error(`Error getting background color recommendations: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      this.logger.error(`❌ Failed to get background color recommendations: ${error.message}`);
      throw error;
    }
  }

  // Get background color analytics
  async getBackgroundColorAnalytics() {
    try {
      const { data: analytics, error: analyticsError } = await this.db.client
        .from('background_analytics')
        .select('*')
        .limit(20);

      const { data: groups, error: groupsError } = await this.db.client
        .from('background_color_groups')
        .select('*')
        .limit(10);

      if (analyticsError || groupsError) {
        throw new Error(`Analytics error: ${analyticsError?.message || groupsError?.message}`);
      }

      // Get total counts
      const { data: totalData } = await this.db.client
        .from('images')
        .select('id', { count: 'exact' })
        .not('primary_bg_color', 'is', null);

      const { data: matchingData } = await this.db.client
        .from('images')
        .select('id', { count: 'exact' })
        .eq('suitable_for_matching', true);

      return {
        analytics: analytics || [],
        colorGroups: groups || [],
        totalAnalyzed: totalData?.length || 0,
        suitableForMatching: matchingData?.length || 0
      };

    } catch (error) {
      this.logger.error(`❌ Failed to get background color analytics: ${error.message}`);
      throw error;
    }
  }

  // Generate color-matched content for a specific theme and account
  async generateColorMatchedContent(hookSlideId, accountUsername, targetColorScheme = null) {
    try {
      this.logger.info(`🎨 Generating color-matched content for hook slide ${hookSlideId} and account ${accountUsername}`);

      // Get the hook slide to understand the theme
      const { data: hookSlide, error: hookError } = await this.db.client
        .from('hook_slides')
        .select('*')
        .eq('id', hookSlideId)
        .single();

      if (hookError) {
        throw new Error(`Failed to fetch hook slide: ${hookError.message}`);
      }

      // Get recommended colors for this aesthetic/theme
      const recommendedColors = await this.getRecommendedBackgroundColors(
        hookSlide.target_vibe,
        null // Don't filter by username to get diverse options
      );

      if (recommendedColors.length === 0) {
        this.logger.warn(`⚠️ No recommended background colors found for ${hookSlide.target_vibe}`);
        return { images: [], colorScheme: null };
      }

      // Choose the best color scheme (or use provided one)
      const selectedColor = targetColorScheme || recommendedColors[0];
      
      this.logger.info(`🎨 Using color scheme: ${selectedColor.primary_bg_color} (${selectedColor.bg_brightness})`);

      // Get images that match this color scheme and aesthetic
      const matchingImages = await this.getImagesByBackgroundColor(
        selectedColor.primary_bg_color,
        selectedColor.bg_brightness,
        30 // Get more options to choose from
      );

      // Filter images by aesthetic compatibility if possible
      const compatibleImages = matchingImages.filter(img => {
        if (!img.aesthetic) return true;
        
        // Simple aesthetic compatibility check
        const hookVibe = hookSlide.target_vibe?.toLowerCase() || '';
        const imgAesthetic = img.aesthetic?.toLowerCase() || '';
        
        return imgAesthetic.includes(hookVibe) || 
               hookVibe.includes(imgAesthetic) ||
               this.areAestheticsCompatible(hookVibe, imgAesthetic);
      });

      const finalImages = compatibleImages.length > 0 ? compatibleImages : matchingImages;
      
      this.logger.info(`🎯 Found ${finalImages.length} color-matched images for theme: ${hookSlide.theme}`);

      return {
        images: finalImages.slice(0, 15), // Return top 15 images
        colorScheme: selectedColor,
        hookSlide: hookSlide,
        theme: hookSlide.theme,
        targetVibe: hookSlide.target_vibe
      };

    } catch (error) {
      this.logger.error(`❌ Failed to generate color-matched content: ${error.message}`);
      throw error;
    }
  }

  // Simple aesthetic compatibility checker
  areAestheticsCompatible(vibe1, vibe2) {
    const compatibilityMap = {
      'streetwear': ['casual', 'urban', 'sporty'],
      'glam': ['elegant', 'formal', 'sophisticated'],
      'preppy': ['classic', 'clean', 'smart'],
      'casual': ['relaxed', 'everyday', 'comfortable'],
      'bohemian': ['free-spirited', 'artistic', 'flowing']
    };

    for (const [key, compatibles] of Object.entries(compatibilityMap)) {
      if (vibe1.includes(key) && compatibles.some(c => vibe2.includes(c))) {
        return true;
      }
      if (vibe2.includes(key) && compatibles.some(c => vibe1.includes(c))) {
        return true;
      }
    }

    return false;
  }
} 