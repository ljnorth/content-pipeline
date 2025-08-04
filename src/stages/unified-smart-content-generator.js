import { Logger } from '../utils/logger.js';
import { SupabaseClient } from '../database/supabase-client.js';
import { HookSlideStorage } from './hook-slide-storage.js';
import { BackgroundColorStorage } from './background-color-storage.js';
import OpenAI from 'openai';

export class UnifiedSmartContentGenerator {
  constructor() {
    this.logger = new Logger();
    this.db = new SupabaseClient();
    this.hookSlideStorage = new HookSlideStorage();
    this.backgroundColorStorage = new BackgroundColorStorage();
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.totalCost = 0;
  }

  /**
   * ULTIMATE CONTENT GENERATION
   * Combines: Performance themes + Hook slides + Account profiles
   * This is like having a professional content strategist, designer, and account manager working together
   */
  async generateUltimateContent(accountUsername, options = {}) {
    const {
      postCount = 3,
      imageCount = 5,
      useHookSlides = true,
      minThemeConfidence = 'medium',
      ensureVariety = true
    } = options;

    this.logger.info(`🚀 ULTIMATE Content Generation for @${accountUsername}`);
    this.logger.info(`🎯 Combining: Performance Themes + Hook Slides + Account Profile`);
    this.logger.info(`📋 Settings: ${postCount} posts, ${imageCount} images each`);

    try {
      // STEP 1: Get account profile (the foundation)
      const accountProfile = await this.getAccountProfile(accountUsername);
      if (!accountProfile) {
        throw new Error(`Account profile not found for @${accountUsername}. Please create an account profile first.`);
      }

      this.logger.info(`👤 Account Profile: ${accountProfile.target_audience?.age || 'general'} audience, ${accountProfile.content_strategy?.aestheticFocus?.join(', ') || 'mixed'} aesthetic`);

      // STEP 2: Get cover slide themes from existing cover slide texts
      const compatibleThemes = await this.getCoverSlideThemes(accountProfile);
      
      if (compatibleThemes.length === 0) {
        throw new Error(`No cover slide themes found. Make sure you have cover slides with text in your database.`);
      }
      
      this.logger.info(`✨ Found ${compatibleThemes.length} cover slide themes to use`);

      // STEP 3: Track used cover slides to ensure variety
      const usedCoverSlideIds = new Set();
      const generatedPosts = [];
      
      for (let i = 0; i < postCount; i++) {
        this.logger.info(`\n📝 Generating post ${i + 1}/${postCount}...`);
        
        try {
          const post = await this.generateUltimatePost(
            accountUsername, 
            accountProfile, 
            compatibleThemes, 
            imageCount, 
            i + 1, 
            { 
              useHookSlides, 
              ensureVariety,
              usedCoverSlideIds // Pass the tracking set
            }
          );
          
          // Track the cover slide used in this post
          if (post.images && post.images.length > 0) {
            const coverSlide = post.images.find(img => img.is_cover_slide);
            if (coverSlide && coverSlide.id) {
              usedCoverSlideIds.add(coverSlide.id);
              this.logger.info(`📌 Tracked cover slide ID: ${coverSlide.id}`);
            }
          }
          
          generatedPosts.push(post);
          
        } catch (postError) {
          this.logger.error(`❌ Failed to generate post ${i + 1}: ${postError.message}`);
          // Continue with next post instead of failing entire batch
          continue;
        }
      }

      if (generatedPosts.length === 0) {
        throw new Error('No posts were successfully generated');
      }

      // STEP 4: Save generation record
      const generationRecord = {
        account_username: accountUsername,
        generation_type: 'ultimate_smart',
        post_count: generatedPosts.length,
        total_cost: this.totalCost,
        generation_date: new Date().toISOString(),
        options: { postCount, imageCount, useHookSlides, ensureVariety }
      };

      await this.saveGenerationRecord(generationRecord);

      this.logger.info(`\n🎉 ULTIMATE Content Generation Complete!`);
      this.logger.info(`✅ Generated ${generatedPosts.length} posts`);
      this.logger.info(`💰 Total cost: $${this.totalCost.toFixed(4)}`);
      this.logger.info(`📊 Used ${usedCoverSlideIds.size} unique cover slides`);

      return {
        posts: generatedPosts,
        summary: {
          totalPosts: generatedPosts.length,
          totalCost: this.totalCost,
          uniqueCoverSlidesUsed: usedCoverSlideIds.size,
          generationType: 'ultimate_smart'
        }
      };

    } catch (error) {
      this.logger.error(`❌ ULTIMATE Content Generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate a single post using the ultimate approach
   * This is where the magic happens - combining all three approaches
   */
  async generateUltimatePost(accountUsername, accountProfile, compatibleThemes, imageCount, postNumber, options) {
    const { useHookSlides, ensureVariety, usedCoverSlideIds = new Set() } = options;

    try {
      // STEP 1: Select the best theme for this post that hasn't used its cover slide yet
      const selectedTheme = this.selectBestThemeForPost(compatibleThemes, postNumber, ensureVariety, usedCoverSlideIds);
      this.logger.info(`🎯 Selected theme: "${selectedTheme.theme_name}" (${selectedTheme.performance_score}/100 performance)`);

      // STEP 2: Try to find a matching hook slide (if enabled)
      let selectedHookSlide = null;
      if (useHookSlides) {
        selectedHookSlide = await this.findMatchingHookSlide(selectedTheme, accountProfile);
        if (selectedHookSlide) {
          this.logger.info(`✨ Found matching hook slide: "${selectedHookSlide.theme}" (${(selectedHookSlide.confidence * 100).toFixed(1)}% confidence)`);
        } else {
          this.logger.info(`ℹ️ No matching hook slide found, proceeding without one`);
        }
      }

      // STEP 3: Find images that match theme + account profile + hook slide (if any)
      const selectedImages = await this.findUltimateImages(
        selectedTheme,
        accountProfile,
        selectedHookSlide,
        imageCount,
        accountUsername,
        usedCoverSlideIds
      );

      if (selectedImages.length === 0) {
        throw new Error(`No suitable images found for theme "${selectedTheme.theme_name}" and account profile`);
      }

      // STEP 4: Generate ultimate content using all context
      const content = await this.generateUltimatePostContent(
        selectedTheme,
        accountProfile,
        selectedHookSlide,
        selectedImages,
        postNumber
      );

      // STEP 5: Create the ultimate post object
      const post = {
        accountUsername,
        postNumber,
        
        // Theme information
        theme: selectedTheme.theme_name,
        themeDescription: selectedTheme.description,
        themePerformanceScore: selectedTheme.performance_score,
        themeConfidence: selectedTheme.confidence_level,
        
        // Hook slide information (if used)
        hookSlide: selectedHookSlide ? {
          id: selectedHookSlide.id,
          theme: selectedHookSlide.theme,
          textDetected: selectedHookSlide.text_detected,
          targetVibe: selectedHookSlide.target_vibe,
          confidence: selectedHookSlide.confidence
        } : null,
        
        // Account optimization
        accountOptimization: {
          targetAudience: accountProfile.target_audience,
          aestheticFocus: accountProfile.content_strategy?.aestheticFocus,
          colorPalette: accountProfile.content_strategy?.colorPalette,
          performanceGoals: accountProfile.performance_goals
        },
        
        // Generated content
        images: selectedImages.map(img => ({
          id: img.id,
          imagePath: img.image_path,
          aesthetic: img.aesthetic,
          colors: img.colors,
          season: img.season,
          occasion: img.occasion
        })),
        
        caption: content.caption,
        hashtags: content.hashtags,
        
        // Strategy summary
        strategy: {
          approach: 'ultimate_smart',
          themeUsed: selectedTheme.theme_name,
          hookSlideUsed: !!selectedHookSlide,
          accountOptimized: true,
          expectedPerformance: content.expectedPerformance,
          confidenceLevel: this.calculateOverallConfidence(selectedTheme, selectedHookSlide, accountProfile)
        },
        
        generatedAt: new Date().toISOString()
      };

      // STEP 6: Update usage tracking
      await this.updateUsageTracking(selectedTheme, selectedHookSlide, selectedImages, accountUsername);

      this.logger.info(`✅ Ultimate post generated: "${selectedTheme.theme_name}"${selectedHookSlide ? ' + Hook Slide' : ''} + Account Profile`);
      return post;

    } catch (error) {
      this.logger.error(`❌ Failed to generate ultimate post: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get themes from cover slide texts that match the account profile
   */
  async getCoverSlideThemes(accountProfile) {
    this.logger.info(`🔍 Getting cover slide themes...`);

    try {
      // Get all cover slides with text
      const { data: coverSlides, error } = await this.db.client
        .from('images')
        .select('cover_slide_text, aesthetic, season, occasion, id, image_path, post_id')
        .eq('is_cover_slide', true)
        .not('cover_slide_text', 'is', null)
        .limit(50);

      if (!coverSlides || coverSlides.length === 0) {
        return [];
      }

      // Convert cover slide texts to themes
      const themeMap = new Map();
      
      coverSlides.forEach(slide => {
        const text = slide.cover_slide_text.trim();
        if (!themeMap.has(text)) {
          themeMap.set(text, {
            theme_name: text,
            description: `Theme based on cover slide: "${text}"`,
            aesthetic: slide.aesthetic || 'mixed',
            season: slide.season || 'any',
            occasion: slide.occasion || 'casual',
            keywords: text.toLowerCase().split(' ').filter(w => w.length > 2),
            hashtags: [`#${text.toLowerCase().replace(/[^a-z0-9]/g, '')}`],
            performance_score: 85, // High score since these are proven cover slides
            cover_slide_id: slide.id,
            cover_slide_path: slide.image_path,
            post_count: 0,
            compatibility_score: 85
          });
        }
        
        // Increment post count for this theme
        themeMap.get(text).post_count++;
      });

      // Convert to array and sort by post count (most popular first)
      const themes = Array.from(themeMap.values())
        .sort((a, b) => b.post_count - a.post_count);

      this.logger.info(`📊 Cover slide themes: ${themes.slice(0, 3).map(t => `"${t.theme_name}" (${t.post_count} posts)`).join(', ')}`);
      
      return themes;

    } catch (coverSlideError) {
      this.logger.error(`❌ Failed to get cover slide themes: ${coverSlideError.message}`);
      throw coverSlideError;
    }
  }

  /**
   * Find a hook slide that matches the selected theme and account profile
   */
  async findMatchingHookSlide(selectedTheme, accountProfile) {
    try {
      let query = this.db.client
        .from('hook_slides')
        .select('*')
        .gte('confidence', 0.7)
        .order('times_used', { ascending: true }) // Prefer less-used slides
        .order('confidence', { ascending: false });

      // Try to match theme first
      if (selectedTheme.theme_name) {
        const themeKeywords = selectedTheme.keywords || [];
        const searchTerms = [selectedTheme.theme_name, ...themeKeywords].join('|');
        query = query.or(`theme.ilike.%${selectedTheme.aesthetic}%,target_vibe.ilike.%${selectedTheme.aesthetic}%`);
      }

      const { data: hookSlides, error } = await query.limit(10);

      if (error) {
        this.logger.warn(`⚠️ Could not fetch hook slides: ${error.message}`);
        return null;
      }

      if (!hookSlides || hookSlides.length === 0) {
        return null;
      }

      // Score hook slides based on theme and account compatibility
      const scoredSlides = hookSlides.map(slide => {
        let matchScore = slide.confidence * 100; // Base score from AI confidence
        
        // Theme aesthetic match
        if (slide.target_vibe === selectedTheme.aesthetic) {
          matchScore += 30;
        } else if (slide.target_vibe?.includes(selectedTheme.aesthetic)) {
          matchScore += 15;
        }
        
        // Account aesthetic match
        const accountAesthetics = accountProfile.content_strategy?.aestheticFocus || [];
        if (accountAesthetics.includes(slide.target_vibe)) {
          matchScore += 20;
        }
        
        // Prefer less-used slides
        matchScore -= (slide.times_used || 0) * 2;
        
        return {
          ...slide,
          match_score: matchScore
        };
      });

      // Return the best matching slide
      const bestSlide = scoredSlides.sort((a, b) => b.match_score - a.match_score)[0];
      
      return bestSlide && bestSlide.match_score > 70 ? bestSlide : null;

    } catch (error) {
      this.logger.warn(`⚠️ Error finding matching hook slide: ${error.message}`);
      return null;
    }
  }

  /**
   * Find images that work with theme + account profile + hook slide
   */
  async findUltimateImages(selectedTheme, accountProfile, selectedHookSlide, imageCount, accountUsername, usedCoverSlideIds) {
    this.logger.info(`🖼️ Finding ultimate images that match all criteria...`);

    try {
      // STEP 1: Check if we can use the cover slide (not already used)
      const coverSlide = selectedTheme.cover_slide_id && !usedCoverSlideIds.has(selectedTheme.cover_slide_id) 
        ? await this.getCoverSlideImage(selectedTheme.cover_slide_id) 
        : null;
      
      let selectedImages = [];
      let remainingCount = imageCount;
      
      if (coverSlide) {
        selectedImages.push({ ...coverSlide, selection_score: 200, is_cover_slide: true });
        remainingCount = imageCount - 1;
        this.logger.info(`✨ Including cover slide: "${selectedTheme.theme_name}"`);
      } else if (selectedTheme.cover_slide_id && usedCoverSlideIds.has(selectedTheme.cover_slide_id)) {
        this.logger.info(`⚠️ Cover slide already used, skipping to avoid duplicates`);
      }

      // STEP 2: Find additional images that match the theme
      let query = this.db.client
        .from('images')
        .select('*')
        .not('aesthetic', 'is', null);

      // Exclude the cover slide from additional images
      if (coverSlide) {
        query = query.neq('id', coverSlide.id);
      }

      // Also exclude any previously used cover slides
      if (usedCoverSlideIds.size > 0) {
        query = query.not('id', 'in', `(${Array.from(usedCoverSlideIds).join(',')})`);
      }

      // Theme-based filtering
      if (selectedTheme.aesthetic && selectedTheme.aesthetic !== 'unknown') {
        query = query.eq('aesthetic', selectedTheme.aesthetic);
      }

      if (selectedTheme.season && selectedTheme.season !== 'any') {
        query = query.eq('season', selectedTheme.season);
      }

      if (selectedTheme.occasion && selectedTheme.occasion !== 'casual') {
        query = query.eq('occasion', selectedTheme.occasion);
      }

      // Account profile filtering
      const accountAesthetics = accountProfile.content_strategy?.aestheticFocus || [];
      if (accountAesthetics.length > 0 && !accountAesthetics.includes(selectedTheme.aesthetic)) {
        // If theme aesthetic doesn't match account, broaden the search
        query = query.in('aesthetic', [...accountAesthetics, selectedTheme.aesthetic]);
      }

      // Color matching (theme + account preferences) - skip for now since colors is JSONB
      const themeColors = selectedTheme.colors || [];
      const accountColors = accountProfile.content_strategy?.colorPalette || [];
      const preferredColors = [...new Set([...themeColors, ...accountColors])];
      
      // Note: Skipping color filtering due to JSONB array complexity
      // Can be added later with proper JSONB queries if needed

      // Avoid recently used images
      const recentlyUsed = await this.getRecentlyUsedImages(accountUsername, 30);
      if (recentlyUsed.length > 0) {
        query = query.not('id', 'in', `(${recentlyUsed.join(',')})`);
      }

      const { data: additionalImages, error } = await query
        .limit(remainingCount * 3) // Get extra images for better selection
        .order('id', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch images: ${error.message}`);
      }

      if (!additionalImages || additionalImages.length === 0) {
        if (selectedImages.length === 0) {
          this.logger.warn('⚠️ No images found with strict criteria, relaxing filters...');
          // Fallback with relaxed criteria
          return await this.findImagesWithRelaxedCriteria(selectedTheme, accountProfile, imageCount, accountUsername, usedCoverSlideIds);
        } else {
          // We have the cover slide at least
          this.logger.warn('⚠️ No additional images found, using only cover slide');
          return selectedImages;
        }
      }

      // Score additional images based on how well they match all criteria
      const scoredImages = additionalImages.map(img => {
        let score = 100; // Base score
        
        // Theme compatibility
        if (img.aesthetic === selectedTheme.aesthetic) score += 30;
        if (img.season === selectedTheme.season) score += 20;
        if (img.occasion === selectedTheme.occasion) score += 15;
        
        // Color matching
        const imgColors = img.colors || [];
        const colorMatches = imgColors.filter(c => preferredColors.includes(c)).length;
        score += colorMatches * 10;
        
        // Account aesthetic preference
        if (accountAesthetics.includes(img.aesthetic)) score += 25;
        
        // Hook slide compatibility (if we have one)
        if (selectedHookSlide && selectedHookSlide.target_vibe === img.aesthetic) {
          score += 20;
        }
        
        return { ...img, selection_score: score };
      });

      // Select the best additional images with variety
      const additionalSelectedImages = this.selectImagesWithVariety(scoredImages, remainingCount);
      
      // Combine cover slide + additional images
      const finalImages = [...selectedImages, ...additionalSelectedImages];
      
      this.logger.info(`✅ Selected ${finalImages.length} ultimate images (${coverSlide ? 'with cover slide + ' + additionalSelectedImages.length + ' additional' : finalImages.length + ' total'})`);
      
      return finalImages;

    } catch (error) {
      this.logger.error(`❌ Failed to find ultimate images: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate content that incorporates theme + account profile + hook slide context
   */
  async generateUltimatePostContent(selectedTheme, accountProfile, selectedHookSlide, selectedImages, postNumber) {
    this.logger.info(`🤖 Generating ultimate content with full context...`);

    try {
      const prompt = `Create the ULTIMATE TikTok post using ALL this context:

PERFORMANCE THEME: "${selectedTheme.theme_name}"
- Description: ${selectedTheme.description}
- Performance Score: ${selectedTheme.performance_score}/100 (${selectedTheme.confidence_level} confidence)
- Target Audience: ${selectedTheme.target_audience}
- Keywords: ${selectedTheme.keywords?.join(', ') || 'N/A'}
- Suggested Hashtags: ${selectedTheme.hashtags?.join(', ') || 'N/A'}

ACCOUNT PROFILE:
- Target Audience: ${JSON.stringify(accountProfile.target_audience)}
- Aesthetic Focus: ${accountProfile.content_strategy?.aestheticFocus?.join(', ') || 'mixed'}
- Color Palette: ${accountProfile.content_strategy?.colorPalette?.join(', ') || 'varied'}
- Performance Goals: ${JSON.stringify(accountProfile.performance_goals)}

${selectedHookSlide ? `HOOK SLIDE CONTEXT:
- Theme: "${selectedHookSlide.theme}"
- Text Detected: "${selectedHookSlide.text_detected}"
- Target Vibe: ${selectedHookSlide.target_vibe}
- Confidence: ${(selectedHookSlide.confidence * 100).toFixed(1)}%` : 'NO HOOK SLIDE USED'}

SELECTED IMAGES:
${selectedImages.map((img, i) => 
  `${i + 1}. ${img.aesthetic} | ${img.colors?.join(', ') || 'no colors'} | ${img.season} | ${img.occasion}`
).join('\n')}

INSTRUCTIONS:
This is ULTIMATE content generation - combine ALL contexts above:
1. Use the high-performing theme as the foundation
2. Match the account's target audience and aesthetic preferences  
3. ${selectedHookSlide ? 'Incorporate the hook slide\'s vibe and detected text theme' : 'Create engaging hook without slide'}
4. Write for ${accountProfile.target_audience?.age || '16-25'} year olds interested in ${accountProfile.content_strategy?.aestheticFocus?.join(' and ') || 'fashion'}
5. Use simple, engaging language with appropriate emojis
6. Include hashtags that blend theme suggestions with account strategy
7. This should be your BEST content because it uses proven performance data + account optimization

Return JSON:
{
  "caption": "Complete caption with hashtags at the end",
  "primary_hook": "The main attention-grabbing element",
  "audience_appeal": "Why this appeals to the target audience", 
  "expectedPerformance": "high/medium/low based on all factors",
  "confidenceReason": "Why you're confident this will perform well"
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 500,
        temperature: 0.3 // Lower temperature for more consistent quality
      });

      // Track costs
      this.totalCost += (response.usage.prompt_tokens * 0.000150 / 1000) + 
                       (response.usage.completion_tokens * 0.000600 / 1000);

      const content = JSON.parse(response.choices[0].message.content);
      
      // Extract hashtags from caption
      const hashtags = this.extractHashtags(content.caption);
      
      return {
        caption: content.caption,
        hashtags: hashtags,
        primaryHook: content.primary_hook,
        audienceAppeal: content.audience_appeal,
        expectedPerformance: content.expectedPerformance,
        confidenceReason: content.confidenceReason
      };

    } catch (error) {
      this.logger.error(`❌ Failed to generate ultimate content: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper methods
   */

  selectBestThemeForPost(compatibleThemes, postNumber, ensureVariety, usedCoverSlideIds = new Set()) {
    if (!ensureVariety) {
      return compatibleThemes[0]; // Always use the best theme
    }
    
    // Rotate through top themes to ensure variety
    const topThemes = compatibleThemes.slice(0, Math.min(5, compatibleThemes.length));
    let selectedTheme = null;
    
    // First, try to find a theme with an unused cover slide
    for (const theme of topThemes) {
      if (theme.cover_slide_id && !usedCoverSlideIds.has(theme.cover_slide_id)) {
        selectedTheme = theme;
        break;
      }
    }
    
    // If no theme with unused cover slide found, fall back to rotation
    if (!selectedTheme) {
      const availableThemes = topThemes.filter(theme => 
        !theme.cover_slide_id || !usedCoverSlideIds.has(theme.cover_slide_id)
      );
      
      if (availableThemes.length > 0) {
        selectedTheme = availableThemes[(postNumber - 1) % availableThemes.length];
      } else {
        // If all cover slides are used, just rotate through themes
        selectedTheme = topThemes[(postNumber - 1) % topThemes.length];
      }
    }
    
    return selectedTheme || topThemes[0]; // Final fallback
  }

  selectImagesWithVariety(scoredImages, imageCount) {
    // Sort by score first
    const sortedImages = scoredImages.sort((a, b) => b.selection_score - a.selection_score);
    
    // Select images ensuring variety in colors and aesthetics
    const selected = [];
    const usedColors = new Set();
    const usedAesthetics = new Set();
    
    for (const img of sortedImages) {
      if (selected.length >= imageCount) break;
      
      // Prefer images that add variety (unless we're running out of options)
      const hasNewColor = img.colors?.some(c => !usedColors.has(c)) || selected.length > imageCount * 0.7;
      const hasNewAesthetic = !usedAesthetics.has(img.aesthetic) || selected.length > imageCount * 0.5;
      
      if (hasNewColor || hasNewAesthetic || selected.length < imageCount * 0.3) {
        selected.push(img);
        img.colors?.forEach(c => usedColors.add(c));
        usedAesthetics.add(img.aesthetic);
      }
    }
    
    // Fill remaining slots if needed
    while (selected.length < imageCount && selected.length < sortedImages.length) {
      const remaining = sortedImages.filter(img => !selected.includes(img));
      if (remaining.length > 0) {
        selected.push(remaining[0]);
      } else {
        break;
      }
    }
    
    return selected;
  }

  calculateOverallConfidence(selectedTheme, selectedHookSlide, accountProfile) {
    let confidence = 'medium'; // Default
    
    const themeScore = selectedTheme.performance_score || 0;
    const hasHookSlide = !!selectedHookSlide;
    const hasAccountProfile = !!accountProfile;
    
    if (themeScore >= 80 && hasHookSlide && hasAccountProfile) {
      confidence = 'very_high';
    } else if (themeScore >= 70 && (hasHookSlide || hasAccountProfile)) {
      confidence = 'high';  
    } else if (themeScore >= 60) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }
    
    return confidence;
  }

  async updateUsageTracking(selectedTheme, selectedHookSlide, selectedImages, accountUsername) {
    try {
      // Update theme usage
      if (selectedTheme) {
        await this.db.client
          .from('discovered_themes')
          .update({
            times_used_for_generation: this.db.client.raw('times_used_for_generation + 1'),
            last_used_at: new Date().toISOString()
          })
          .eq('theme_name', selectedTheme.theme_name);
      }

      // Update hook slide usage
      if (selectedHookSlide) {
        await this.hookSlideStorage.markAsUsed(selectedHookSlide.id, `ultimate_${Date.now()}`);
      }

      // Track image usage
      for (const image of selectedImages) {
        await this.db.client
          .from('image_usage')
          .insert({
            image_id: image.id,
            account_username: accountUsername,
            generation_id: `ultimate_${Date.now()}`,
            usage_type: 'ultimate_smart',
            used_at: new Date().toISOString()
          });
      }

    } catch (error) {
      this.logger.warn(`⚠️ Could not update usage tracking: ${error.message}`);
    }
  }

  async getCoverSlideImage(coverSlideId) {
    try {
      const { data: coverSlide, error } = await this.db.client
        .from('images')
        .select('*')
        .eq('id', coverSlideId)
        .single();

      if (error || !coverSlide) {
        this.logger.warn(`⚠️ Could not fetch cover slide ${coverSlideId}: ${error?.message || 'Not found'}`);
        return null;
      }

      return coverSlide;
    } catch (error) {
      this.logger.warn(`⚠️ Error fetching cover slide: ${error.message}`);
      return null;
    }
  }

  async findImagesWithRelaxedCriteria(selectedTheme, accountProfile, imageCount, accountUsername, usedCoverSlideIds = new Set()) {
    // Simplified image search with relaxed criteria
    let query = this.db.client
      .from('images')
      .select('*')
      .not('aesthetic', 'is', null);

    // Exclude previously used cover slides
    if (usedCoverSlideIds.size > 0) {
      query = query.not('id', 'in', `(${Array.from(usedCoverSlideIds).join(',')})`);
    }

    const { data: images, error } = await query
      .limit(imageCount * 2)
      .order('id', { ascending: false });

    if (error || !images) {
      return [];
    }

    return images.slice(0, imageCount).map(img => ({ ...img, selection_score: 50 }));
  }

  async getAccountProfile(accountUsername) {
    try {
      const { data: profile, error } = await this.db.client
        .from('account_profiles')
        .select('*')
        .eq('username', accountUsername)
        .single();

      return error ? null : profile;
    } catch (error) {
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

      return error ? [] : (recentUsage?.map(u => u.image_id) || []);
    } catch (error) {
      return [];
    }
  }

  async saveGenerationRecord(generationRecord) {
    try {
      const { error } = await this.db.client
        .from('saved_generations')
        .insert({
          generation_id: generationRecord.id,
          name: `Ultimate Smart Generation for @${generationRecord.accountUsername}`,
          account_username: generationRecord.accountUsername,
          generation_type: 'ultimate_smart',
          generation_params: generationRecord.strategy,
          image_data: generationRecord.posts.map(p => ({
            theme: p.theme,
            hookSlide: p.hookSlide,
            images: p.images,
            strategy: p.strategy
          })),
          image_count: generationRecord.posts.reduce((sum, p) => sum + p.images.length, 0)
        });

      if (!error) {
        this.logger.info(`💾 Saved ultimate generation record: ${generationRecord.id}`);
      }
    } catch (error) {
      this.logger.warn(`⚠️ Could not save generation record: ${error.message}`);
    }
  }

  getCurrentSeason(month) {
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  extractHashtags(text) {
    const hashtagRegex = /#[\w\d_]+/g;
    return text.match(hashtagRegex) || [];
  }
} 