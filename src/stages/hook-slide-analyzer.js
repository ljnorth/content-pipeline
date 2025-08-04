import { Logger } from '../utils/logger.js';
import OpenAI from 'openai';
import fs from 'fs-extra';

export class HookSlideAnalyzer {
  constructor() {
    this.logger = new Logger();
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.totalCost = 0;
    this.totalTokens = 0;
    this.processedCount = 0;
    this.hookSlidesFound = 0;
  }

  async process(images) {
    this.logger.info(`🎯 Starting hook slide detection - Processing ${images.length} images`);
    const results = [];
    for (const item of images) {
      // Validate required fields
      if (!item.postId || !item.imagePath) {
        this.logger.error(`❌ Skipping invalid image item: missing postId or imagePath`);
        continue;
      }
      this.logger.info(`🔍 Analyzing image for hook slides: ${item.postId}`);
      let analysis;
      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                { 
                  type: 'text', 
                  text: `Analyze if this image is a "hook slide" - an image with text overlays that announces a theme like "Back to School Outfits", "Summer Vacation Fits", "Date Night Looks", etc. \n\nReturn JSON: {\n  \"is_hook_slide\": true/false,\n  \"confidence\": 0.0-1.0,\n  \"text_detected\": \"extracted text from image or null\",\n  \"theme\": \"specific theme like 'back to school', 'date night', 'summer vacation' or null\",\n  \"content_direction\": \"brief description of what type of content this suggests or null\",\n  \"target_vibe\": \"aesthetic vibe like 'preppy', 'streetwear', 'glam', 'casual' or null\"\n}\n\nFocus on images that have clear text overlays announcing outfit themes, not just fashion images.` 
                },
                { type: 'image_url', image_url: { url: item.imagePath } }
              ]
            }
          ],
          max_tokens: 150,
          temperature: 0
        });
        let text = response.choices[0].message.content.trim();
        // Strip markdown code block if present
        if (text.startsWith('```json')) {
          text = text.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
        } else if (text.startsWith('```')) {
          text = text.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
        }
        analysis = JSON.parse(text);
        // Track usage and costs
        this.processedCount++;
        const promptTokens = response.usage.prompt_tokens;
        const completionTokens = response.usage.completion_tokens;
        const totalTokens = response.usage.total_tokens;
        // GPT-4o-mini pricing: $0.000150 per 1K input tokens, $0.000600 per 1K output tokens
        const cost = (promptTokens * 0.000150 / 1000) + (completionTokens * 0.000600 / 1000);
        this.totalTokens += totalTokens;
        this.totalCost += cost;
        
        // Create result for this image (regardless of hook slide status)
        const result = {
          imageId: item.imageId,
          postId: item.postId,
          imagePath: item.imagePath,
          is_hook_slide: analysis.is_hook_slide,
          confidence: analysis.confidence,
          text_detected: analysis.text_detected,
          theme: analysis.theme,
          content_direction: analysis.content_direction,
          target_vibe: analysis.target_vibe,
          hook_analysis: analysis,
          created_at: new Date().toISOString()
        };
        results.push(result);
        
        // Log if this is a hook slide
        if (analysis.is_hook_slide && analysis.confidence > 0.7) {
          this.hookSlidesFound++;
          this.logger.info(`✨ HOOK SLIDE FOUND: "${analysis.text_detected}" - Theme: ${analysis.theme} (${(analysis.confidence * 100).toFixed(1)}% confidence)`);
        }
        
        if (this.processedCount % 50 === 0) {
          this.logger.info(`💰 Hook slide detection progress: ${this.processedCount} images processed, ${this.hookSlidesFound} hook slides found, $${this.totalCost.toFixed(4)} spent`);
        }
      } catch (err) {
        this.logger.error(`OpenAI hook slide analysis failed for ${item.postId}: ${err.message}`);
        continue;
      }
    }
    // Log final summary
    this.logger.info(`🎉 Hook Slide Detection Complete:`);
    this.logger.info(`   📊 Images processed: ${this.processedCount}`);
    this.logger.info(`   ✨ Hook slides found: ${this.hookSlidesFound}`);
    this.logger.info(`   💰 Total cost: $${this.totalCost.toFixed(4)}`);
    this.logger.info(`   🎯 Discovery rate: ${((this.hookSlidesFound / this.processedCount) * 100).toFixed(1)}%`);
    return results;
  }

  getCostSummary() {
    return {
      processedCount: this.processedCount,
      hookSlidesFound: this.hookSlidesFound,
      totalCost: this.totalCost,
      totalTokens: this.totalTokens,
      averageCostPerImage: this.processedCount > 0 ? this.totalCost / this.processedCount : 0,
      discoveryRate: this.processedCount > 0 ? (this.hookSlidesFound / this.processedCount) : 0
    };
  }
} 