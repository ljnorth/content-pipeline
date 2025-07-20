import { Logger } from '../utils/logger.js';
import OpenAI from 'openai';
import fs from 'fs-extra';

export class AIAnalyzer {
  constructor() {
    this.logger = new Logger();
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.totalCost = 0;
    this.totalTokens = 0;
    this.processedCount = 0;
  }

  async process(images) {
    this.logger.info(`🎯 Starting AI analysis with cost optimization - Processing ${images.length} images`);
    
    // Group images by post
    const postsMap = new Map();
    
    for (const item of images) {
      // Validate required fields
      if (!item.postId || !item.imagePath) {
        this.logger.error(`❌ Skipping invalid image item: missing postId or imagePath`);
        continue;
      }
      
      this.logger.info(`🔍 Analyzing image from post ${item.postId}`);

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
                { type: 'text', text: `Analyze image. Return JSON: {a:"aesthetic",c:["colors"],s:"season",o:"occasion",ad:["additional"]}` },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
              ]
            }
          ],
          max_tokens: 100, // Reduced from 200 for cost savings
          temperature: 0
        });

        const text = response.choices[0].message.content.trim();
        
        // Parse compressed JSON and convert back to full format for compatibility
        const compressed = JSON.parse(text);
        analysis = {
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
        
        // GPT-4o-mini pricing: $0.000150 per 1K input tokens, $0.000600 per 1K output tokens
        const cost = (promptTokens * 0.000150 / 1000) + (completionTokens * 0.000600 / 1000);
        
        this.totalTokens += totalTokens;
        this.totalCost += cost;
        
        if (this.processedCount % 50 === 0) {
          this.logger.info(`💰 Cost tracking: ${this.processedCount} images processed, $${this.totalCost.toFixed(4)} spent, ${this.totalTokens} tokens used`);
        }
        
      } catch (err) {
        this.logger.error(`OpenAI analysis failed for ${item.postId}: ${err.message}`);
        continue;
      }

      // Group by post
      if (!postsMap.has(item.postId)) {
        const metadata = item.metadata || {};
        // Ensure required fields are present
        if (!metadata.post_id || !metadata.username) {
          this.logger.error(`❌ Skipping post ${item.postId}: missing required metadata (post_id or username)`);
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

    // Log final cost summary
    this.logger.info(`💰 AI Analysis Complete: ${this.processedCount} images processed`);
    this.logger.info(`💰 Total Cost: $${this.totalCost.toFixed(4)} (avg $${(this.totalCost/this.processedCount).toFixed(6)} per image)`);
    this.logger.info(`💰 Total Tokens: ${this.totalTokens} (avg ${Math.round(this.totalTokens/this.processedCount)} per image)`);
    this.logger.info(`💰 Estimated 60% prompt savings: ~$${(this.totalCost * 0.6).toFixed(4)} saved vs old prompt`);

    // Convert map back to array
    return Array.from(postsMap.values());
  }

  getCostSummary() {
    return {
      totalCost: this.totalCost,
      totalTokens: this.totalTokens,
      processedCount: this.processedCount,
      averageCostPerImage: this.processedCount > 0 ? this.totalCost / this.processedCount : 0,
      averageTokensPerImage: this.processedCount > 0 ? this.totalTokens / this.processedCount : 0
    };
  }
} 