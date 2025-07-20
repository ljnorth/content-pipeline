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
    
    const hookSlides = [];
    
    for (const item of images) {
      // Validate required fields
      if (!item.postId || !item.imagePath) {
        this.logger.error(`❌ Skipping invalid image item: missing postId or imagePath`);
        continue;
      }
      
      this.logger.info(`🔍 Analyzing image for hook slides: ${item.postId}`);

      // Read image file as buffer and convert to base64
      const imageBuffer = await fs.readFile(item.imagePath);
      const base64Image = imageBuffer.toString('base64');

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
                  text: `Analyze if this image is a "hook slide" - an image with text overlays that announces a theme like "Back to School Outfits", "Summer Vacation Fits", "Date Night Looks", etc. 

Return JSON: {
  "is_hook_slide": true/false,
  "confidence": 0.0-1.0,
  "text_detected": "extracted text from image or null",
  "theme": "specific theme like 'back to school', 'date night', 'summer vacation' or null",
  "content_direction": "brief description of what type of content this suggests or null",
  "target_vibe": "aesthetic vibe like 'preppy', 'streetwear', 'glam', 'casual' or null"
}

Focus on images that have clear text overlays announcing outfit themes, not just fashion images.` 
                },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
              ]
            }
          ],
          max_tokens: 150,
          temperature: 0
        });

        const text = response.choices[0].message.content.trim();
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
        
        // If this is a hook slide, add it to our collection
        if (analysis.is_hook_slide && analysis.confidence > 0.7) {
          this.hookSlidesFound++;
          
          const hookSlide = {
            ...item.metadata,
            post_id: item.postId,
            image_path: item.imagePath,
            hook_analysis: analysis,
            created_at: new Date().toISOString()
          };
          
          hookSlides.push(hookSlide);
          
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

    return hookSlides;
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