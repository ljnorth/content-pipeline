import { Logger } from '../utils/logger.js';
import OpenAI from 'openai';
import fs from 'fs-extra';

export class AIAnalyzerConcurrent {
  constructor(options = {}) {
    this.logger = new Logger();
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.totalCost = 0;
    this.totalTokens = 0;
    this.processedCount = 0;
    
    // Concurrency settings
    this.concurrency = options.concurrency || 10; // Process 10 images at once
    this.rateLimitDelay = options.rateLimitDelay || 100; // 100ms between batches
  }

  async process(images) {
    this.logger.info(`⚡ Starting CONCURRENT AI analysis - Processing ${images.length} images with ${this.concurrency}x concurrency`);
    
    // Group images by post first
    const postsMap = new Map();
    
    // Process images in concurrent batches
    const results = await this.processConcurrentBatches(images);
    
    // Group results by post
    for (const { item, analysis } of results) {
      if (!postsMap.has(item.postId)) {
        const metadata = item.metadata || {};
        if (!metadata.post_id || !metadata.username) {
          this.logger.error(`❌ Skipping post ${item.postId}: missing required metadata`);
          continue;
        }
        
        postsMap.set(item.postId, {
          ...metadata,
          image_paths: [],
          image_analyses: []
        });
      }
      
      const post = postsMap.get(item.postId);
      post.image_paths.push(item.imagePath);
      post.image_analyses.push(analysis);
    }

    // Log final summary
    this.logger.info(`⚡ CONCURRENT AI Analysis Complete: ${this.processedCount} images processed`);
    this.logger.info(`💰 Total Cost: $${this.totalCost.toFixed(4)} (avg $${(this.totalCost/this.processedCount).toFixed(6)} per image)`);
    this.logger.info(`💰 Total Tokens: ${this.totalTokens} (avg ${Math.round(this.totalTokens/this.processedCount)} per image)`);
    this.logger.info(`⚡ Concurrent processing: ${this.concurrency}x faster than sequential`);

    return Array.from(postsMap.values());
  }

  async processConcurrentBatches(images) {
    const results = [];
    const validImages = images.filter(item => item.postId && item.imagePath);
    
    this.logger.info(`⚡ Processing ${validImages.length} images in batches of ${this.concurrency}`);
    
    for (let i = 0; i < validImages.length; i += this.concurrency) {
      const batch = validImages.slice(i, i + this.concurrency);
      
      this.logger.info(`📦 Processing batch ${Math.floor(i/this.concurrency) + 1}/${Math.ceil(validImages.length/this.concurrency)} (${batch.length} images)`);
      
      // Process batch concurrently
      const batchPromises = batch.map(item => this.processImage(item));
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Handle results
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        const item = batch[j];
        
        if (result.status === 'fulfilled' && result.value) {
          results.push({ item, analysis: result.value });
        } else {
          this.logger.error(`❌ Failed to process ${item.postId}: ${result.reason?.message || 'Unknown error'}`);
        }
      }
      
      // Small delay to respect rate limits
      if (i + this.concurrency < validImages.length) {
        await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
      }
      
      // Progress logging
      if ((i + batch.length) % 50 === 0 || i + batch.length >= validImages.length) {
        this.logger.info(`💰 Progress: ${this.processedCount} images processed, $${this.totalCost.toFixed(4)} spent`);
      }
    }
    
    return results;
  }

  async processImage(item) {
    try {
      // Read image file as buffer and convert to base64
      const imageBuffer = await fs.readFile(item.imagePath);
      const base64Image = imageBuffer.toString('base64');

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: `Analyze image. Return JSON: {a:"aesthetic",c:["colors"],s:"season",o:"occasion",ad:["additional"]}` },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ]
          }
        ],
        max_tokens: 100,
        temperature: 0
      });

      const text = response.choices[0].message.content.trim();
      
      // Parse compressed JSON and convert back to full format
      const compressed = JSON.parse(text);
      const analysis = {
        aesthetic: compressed.a,
        colors: compressed.c,
        season: compressed.s,
        occasion: compressed.o,
        additional: compressed.ad
      };

      // Track usage and costs
      this.processedCount++;
      const promptTokens = response.usage.prompt_tokens;
      const completionTokens = response.usage.completion_tokens;
      const totalTokens = response.usage.total_tokens;
      
      // Standard API pricing
      const cost = (promptTokens * 0.000150 / 1000) + (completionTokens * 0.000600 / 1000);
      
      this.totalTokens += totalTokens;
      this.totalCost += cost;
      
      return analysis;
      
    } catch (err) {
      throw new Error(`OpenAI analysis failed for ${item.postId}: ${err.message}`);
    }
  }

  getCostSummary() {
    return {
      totalCost: this.totalCost,
      totalTokens: this.totalTokens,
      processedCount: this.processedCount,
      averageCostPerImage: this.processedCount > 0 ? this.totalCost / this.processedCount : 0,
      averageTokensPerImage: this.processedCount > 0 ? this.totalTokens / this.processedCount : 0,
      concurrencyLevel: this.concurrency
    };
  }
} 