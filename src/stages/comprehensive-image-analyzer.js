import OpenAI from 'openai';
import { Logger } from '../utils/logger.js';

export class ComprehensiveImageAnalyzer {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.logger = new Logger();
    
    // Cost and progress tracking
    this.processedCount = 0;
    this.totalCost = 0;
    this.inputTokens = 0;
    this.outputTokens = 0;
    this.startTime = Date.now();
    
    // Results tracking
    this.singleItemCount = 0;
    this.fullOutfitCount = 0;
    this.onPersonCount = 0;
    this.coverSlidesFound = 0;
    this.errorCount = 0;
  }

  async process(images) {
    this.logger.info(`🚀 Starting comprehensive image analysis - Processing ${images.length} images`);
    this.logger.info(`💰 Estimated cost: $${(images.length * 0.00286).toFixed(2)}`);
    
    const results = [];
    const batchSize = 50; // Process in batches for better progress tracking
    
    for (let i = 0; i < images.length; i += batchSize) {
      const batch = images.slice(i, i + batchSize);
      const batchResults = await this.processBatch(batch, i + 1);
      results.push(...batchResults);
      
      // Log progress every batch
      const progress = ((i + batch.length) / images.length * 100).toFixed(1);
      const elapsed = (Date.now() - this.startTime) / 1000;
      const rate = this.processedCount / elapsed;
      const remaining = images.length - this.processedCount;
      const eta = remaining / rate;
      
      this.logger.info(`📊 Progress: ${progress}% (${this.processedCount}/${images.length}) | Cost: $${this.totalCost.toFixed(4)} | ETA: ${Math.round(eta/60)}min`);
    }
    
    this.logFinalSummary(results);
    return results;
  }

  async processBatch(batch, batchStartIndex) {
    this.logger.info(`📦 Processing batch ${Math.ceil(batchStartIndex/50)} - ${batch.length} images`);
    const results = [];
    
    for (const item of batch) {
      if (!item.imageId || !item.imagePath) {
        this.logger.error(`❌ Skipping invalid image: missing imageId or imagePath`);
        this.errorCount++;
        continue;
      }
      
      try {
        const analysis = await this.analyzeImage(item);
        results.push(analysis);
        this.updateCounters(analysis);
        
      } catch (error) {
        this.logger.error(`❌ Failed to analyze image ${item.imageId}: ${error.message}`);
        this.errorCount++;
        // Add error result to maintain data integrity
        results.push({
          imageId: item.imageId,
          postId: item.postId,
          imagePath: item.imagePath,
          item_preference: 'error',
          is_cover_slide: false,
          cover_slide_text: null,
          confidence: 0.0,
          error: error.message
        });
      }
    }
    
    return results;
  }

  async analyzeImage(item) {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { 
              type: 'text', 
              text: `Analyze this fashion image for TWO things:

1. ITEM PREFERENCE - Classify as ONE of:
   - "single_item": Individual items (shoes, bags, single clothing piece)
   - "full_outfit": Complete outfit combinations (multiple coordinated pieces)
   - "on_person": Person wearing clothes (modeling shots, mirror selfies)

2. COVER SLIDE - Check if this has text overlays announcing themes like "Back to School Outfits", "Date Night Looks", etc.

Return JSON:
{
  "item_preference": "single_item|full_outfit|on_person",
  "confidence": 0.95,
  "is_cover_slide": true/false,
  "cover_slide_text": "extracted text or null",
  "theme": "theme like 'back to school' or null"
}`
            },
            {
              type: 'image_url',
              image_url: {
                url: item.imagePath,
                detail: 'low'
              }
            }
          ]
        }
      ],
      max_tokens: 150,
      temperature: 0.1
    });

    // Track usage and cost
    this.inputTokens += response.usage.prompt_tokens;
    this.outputTokens += response.usage.completion_tokens;
    const cost = (response.usage.prompt_tokens * 0.000150 + response.usage.completion_tokens * 0.000600) / 1000;
    this.totalCost += cost;
    this.processedCount++;

    // Parse response
    let content = response.choices[0].message.content.trim();
    
    // Strip markdown code blocks if present
    if (content.startsWith('```json')) {
      content = content.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
    } else if (content.startsWith('```')) {
      content = content.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
    }
    
    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch (parseError) {
      this.logger.error(`❌ Failed to parse JSON for image ${item.imageId}: ${content}`);
      throw new Error(`JSON parse failed: ${parseError.message}`);
    }

    // Validate and clean response
    const validPreferences = ['single_item', 'full_outfit', 'on_person'];
    if (!validPreferences.includes(analysis.item_preference)) {
      analysis.item_preference = 'error';
    }

    return {
      imageId: item.imageId,
      postId: item.postId,
      imagePath: item.imagePath,
      item_preference: analysis.item_preference,
      preference_confidence: analysis.confidence || 0.0,
      is_cover_slide: analysis.is_cover_slide || false,
      cover_slide_text: analysis.cover_slide_text || null,
      theme: analysis.theme || null,
      raw_analysis: analysis
    };
  }

  updateCounters(analysis) {
    // Track item preferences
    if (analysis.item_preference === 'single_item') this.singleItemCount++;
    else if (analysis.item_preference === 'full_outfit') this.fullOutfitCount++;
    else if (analysis.item_preference === 'on_person') this.onPersonCount++;
    
    // Track cover slides
    if (analysis.is_cover_slide) {
      this.coverSlidesFound++;
      this.logger.info(`✨ COVER SLIDE: "${analysis.cover_slide_text}" - Theme: ${analysis.theme}`);
    }
  }

  logFinalSummary(results) {
    const elapsed = (Date.now() - this.startTime) / 1000;
    
    this.logger.info('🎉 Comprehensive Analysis Complete!');
    this.logger.info(`⏱️  Total time: ${Math.round(elapsed/60)}min ${Math.round(elapsed%60)}s`);
    this.logger.info(`💰 Total cost: $${this.totalCost.toFixed(4)}`);
    this.logger.info(`📊 Processed: ${this.processedCount} images`);
    this.logger.info(`❌ Errors: ${this.errorCount}`);
    
    this.logger.info('📈 Item Preference Breakdown:');
    this.logger.info(`   👕 Single items: ${this.singleItemCount} (${(this.singleItemCount/results.length*100).toFixed(1)}%)`);
    this.logger.info(`   👗 Full outfits: ${this.fullOutfitCount} (${(this.fullOutfitCount/results.length*100).toFixed(1)}%)`);
    this.logger.info(`   👤 On person: ${this.onPersonCount} (${(this.onPersonCount/results.length*100).toFixed(1)}%)`);
    this.logger.info(`   🎯 Cover slides found: ${this.coverSlidesFound}`);
  }
} 