import { Logger } from '../utils/logger.js';
import { SupabaseClient } from '../database/supabase-client.js';

export class HookSlideStorage {
  constructor() {
    this.logger = new Logger();
    this.db = new SupabaseClient();
  }

  async process(hookSlides) {
    this.logger.info(`💾 Starting hook slide storage - ${hookSlides.length} hook slides to store`);
    
    let storedCount = 0;
    let failedCount = 0;

    for (const hookSlide of hookSlides) {
      try {
        await this.storeHookSlide(hookSlide);
        storedCount++;
      } catch (error) {
        this.logger.error(`❌ Failed to store hook slide ${hookSlide.post_id}: ${error.message}`);
        failedCount++;
      }
    }

    this.logger.info(`✅ Hook slide storage complete: ${storedCount} successful, ${failedCount} failed`);
    
    return {
      stored: storedCount,
      failed: failedCount,
      total: hookSlides.length
    };
  }

  async storeHookSlide(hookSlide) {
    const hookSlideData = {
      username: hookSlide.username,
      post_id: hookSlide.post_id,
      image_path: hookSlide.image_path,
      is_hook_slide: hookSlide.hook_analysis.is_hook_slide,
      confidence: hookSlide.hook_analysis.confidence,
      text_detected: hookSlide.hook_analysis.text_detected,
      theme: hookSlide.hook_analysis.theme,
      content_direction: hookSlide.hook_analysis.content_direction,
      target_vibe: hookSlide.hook_analysis.target_vibe,
      hook_analysis: hookSlide.hook_analysis,
      created_at: new Date().toISOString()
    };

    const { error } = await this.db.client
      .from('hook_slides')
      .upsert(hookSlideData, { 
        onConflict: 'post_id,image_path',
        ignoreDuplicates: false 
      });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    this.logger.info(`✅ Stored hook slide: ${hookSlide.hook_analysis.theme} - "${hookSlide.hook_analysis.text_detected}"`);
  }

  // Get hook slides by theme for content generation
  async getHookSlidesByTheme(theme, limit = 10) {
    const { data, error } = await this.db.client
      .from('hook_slides')
      .select('*')
      .ilike('theme', `%${theme}%`)
      .gte('confidence', 0.7)
      .order('confidence', { ascending: false })
      .order('times_used', { ascending: true }) // Prefer less-used slides
      .limit(limit);

    if (error) {
      throw new Error(`Error fetching hook slides by theme: ${error.message}`);
    }

    return data || [];
  }

  // Get hook slides by target vibe for account matching
  async getHookSlidesByVibe(targetVibe, limit = 10) {
    const { data, error } = await this.db.client
      .from('hook_slides')
      .select('*')
      .ilike('target_vibe', `%${targetVibe}%`)
      .gte('confidence', 0.7)
      .order('confidence', { ascending: false })
      .order('times_used', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Error fetching hook slides by vibe: ${error.message}`);
    }

    return data || [];
  }

  // Get all available themes for UI
  async getAvailableThemes() {
    const { data, error } = await this.db.client
      .from('hook_slides')
      .select('theme, target_vibe')
      .gte('confidence', 0.7)
      .not('theme', 'is', null);

    if (error) {
      throw new Error(`Error fetching available themes: ${error.message}`);
    }

    // Group and count in JavaScript instead
    const themes = {};
    (data || []).forEach(item => {
      const key = `${item.theme}-${item.target_vibe}`;
      if (!themes[key]) {
        themes[key] = { theme: item.theme, target_vibe: item.target_vibe, count: 0 };
      }
      themes[key].count++;
    });

    return Object.values(themes).sort((a, b) => b.count - a.count);
  }

  // Mark hook slide as used and update stats
  async markAsUsed(hookSlideId, generationId = null) {
    try {
      // Update usage stats
      const { error: updateError } = await this.db.client
        .rpc('update_hook_slide_usage', { slide_id: hookSlideId });

      if (updateError) {
        throw updateError;
      }

      // Optionally track which generation used this hook slide
      if (generationId) {
        const { error: trackError } = await this.db.client
          .from('hook_slides')
          .update({
            generated_content_ids: this.db.client.raw(`array_append(generated_content_ids, '${generationId}')`)
          })
          .eq('id', hookSlideId);

        if (trackError) {
          this.logger.warn(`⚠️ Failed to track generation ID for hook slide ${hookSlideId}: ${trackError.message}`);
        }
      }

      this.logger.info(`📊 Updated usage stats for hook slide ${hookSlideId}`);
      
    } catch (error) {
      this.logger.error(`❌ Failed to mark hook slide as used: ${error.message}`);
      throw error;
    }
  }

  // Get hook slide statistics
  async getStats() {
    try {
      const { data: totalData } = await this.db.client
        .from('hook_slides')
        .select('id', { count: 'exact' });

      const { data: highConfidenceData } = await this.db.client
        .from('hook_slides')
        .select('id', { count: 'exact' })
        .gte('confidence', 0.7);

      const { data: themesData } = await this.db.client
        .from('theme_analytics')
        .select('*');

      return {
        totalHookSlides: totalData?.length || 0,
        highConfidenceSlides: highConfidenceData?.length || 0,
        availableThemes: themesData?.length || 0,
        themes: themesData || []
      };
      
    } catch (error) {
      this.logger.error(`❌ Failed to get hook slide stats: ${error.message}`);
      throw error;
    }
  }
} 