import { Logger } from '../utils/logger.js';
import OpenAI from 'openai';
import fs from 'fs-extra';
import path from 'path';

export class AIAnalyzerBatch {
  constructor() {
    this.logger = new Logger();
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.totalCost = 0;
    this.totalTokens = 0;
    this.processedCount = 0;
    this.batchDir = 'temp/batch_jobs';
  }

  async process(images) {
    this.logger.info(`🚀 Starting BATCH AI analysis - Processing ${images.length} images with 50% cost savings`);
    
    // Ensure batch directory exists
    await fs.ensureDir(this.batchDir);
    
    // Create batch tasks
    const batchTasks = await this.createBatchTasks(images);
    
    // Upload batch file and create job
    const batchJob = await this.createBatchJob(batchTasks);
    
    // Wait for completion and get results
    const results = await this.waitAndGetResults(batchJob);
    
    // Process and return results
    return this.processResults(results, images);
  }

  async createBatchTasks(images) {
    this.logger.info(`📦 Creating batch tasks for ${images.length} images`);
    
    const tasks = [];
    
    for (let i = 0; i < images.length; i++) {
      const item = images[i];
      
      // Validate required fields
      if (!item.postId || !item.imagePath) {
        this.logger.error(`❌ Skipping invalid image item: missing postId or imagePath`);
        continue;
      }

      try {
        // Read image file as buffer and convert to base64
        const imageBuffer = await fs.readFile(item.imagePath);
        const base64Image = imageBuffer.toString('base64');

        const task = {
          custom_id: `task-${i}-${item.postId}`,
          method: "POST",
          url: "/v1/chat/completions",
          body: {
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'user',
                content: [
                  { 
                    type: 'text', 
                    text: `Analyze image. Return JSON: {a:"aesthetic",c:["colors"],s:"season",o:"occasion",ad:["additional"]}` 
                  },
                  { 
                    type: 'image_url', 
                    image_url: { url: `data:image/jpeg;base64,${base64Image}` } 
                  }
                ]
              }
            ],
            max_tokens: 100,
            temperature: 0
          }
        };
        
        tasks.push(task);
        
        if ((i + 1) % 100 === 0) {
          this.logger.info(`📝 Created ${i + 1}/${images.length} batch tasks`);
        }
        
      } catch (err) {
        this.logger.error(`Failed to process image ${item.imagePath}: ${err.message}`);
        continue;
      }
    }
    
    this.logger.info(`✅ Created ${tasks.length} batch tasks`);
    return tasks;
  }

  async createBatchJob(tasks) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const batchFileName = path.join(this.batchDir, `fashion_batch_${timestamp}.jsonl`);
    
    // Write tasks to JSONL file
    this.logger.info(`💾 Writing batch file: ${batchFileName}`);
    const fileContent = tasks.map(task => JSON.stringify(task)).join('\n');
    await fs.writeFile(batchFileName, fileContent);
    
    // Upload file to OpenAI
    this.logger.info(`📤 Uploading batch file to OpenAI...`);
    const batchFile = await this.openai.files.create({
      file: fs.createReadStream(batchFileName),
      purpose: "batch"
    });
    
    // Create batch job
    this.logger.info(`🚀 Creating batch job...`);
    const batchJob = await this.openai.batches.create({
      input_file_id: batchFile.id,
      endpoint: "/v1/chat/completions",
      completion_window: "24h"
    });
    
    this.logger.info(`✅ Batch job created: ${batchJob.id}`);
    this.logger.info(`📊 Status: ${batchJob.status}`);
    this.logger.info(`💰 Expected 50% cost savings vs individual API calls`);
    
    return batchJob;
  }

  async waitAndGetResults(batchJob) {
    this.logger.info(`⏳ Waiting for batch job completion (max 24h)...`);
    
    let job = batchJob;
    const maxWaitTime = 24 * 60 * 60 * 1000; // 24 hours
    const startTime = Date.now();
    const checkInterval = 30000; // Check every 30 seconds
    
    while (job.status === 'validating' || job.status === 'in_progress') {
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error('Batch job timed out after 24 hours');
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      
      job = await this.openai.batches.retrieve(job.id);
      this.logger.info(`📊 Batch status: ${job.status} | Completed: ${job.request_counts?.completed || 0}/${job.request_counts?.total || 0}`);
    }
    
    if (job.status === 'completed') {
      this.logger.info(`✅ Batch job completed successfully!`);
      
      // Download results
      const resultFileContent = await this.openai.files.content(job.output_file_id);
      const resultsText = Buffer.from(await resultFileContent.arrayBuffer()).toString();
      
      // Save results locally
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const resultsFileName = path.join(this.batchDir, `results_${timestamp}.jsonl`);
      await fs.writeFile(resultsFileName, resultsText);
      
      // Parse results
      const results = resultsText.trim().split('\n').map(line => JSON.parse(line));
      
      this.logger.info(`📊 Processing ${results.length} batch results`);
      return results;
      
    } else if (job.status === 'failed') {
      throw new Error(`Batch job failed: ${job.errors?.[0]?.message || 'Unknown error'}`);
    } else {
      throw new Error(`Unexpected batch job status: ${job.status}`);
    }
  }

  processResults(batchResults, originalImages) {
    this.logger.info(`🔄 Processing batch results and grouping by posts...`);
    
    // Group images by post
    const postsMap = new Map();
    
    // Create lookup map for original images
    const imageMap = new Map();
    originalImages.forEach((item, index) => {
      imageMap.set(`task-${index}-${item.postId}`, item);
    });
    
    let totalCost = 0;
    let totalTokens = 0;
    
    for (const result of batchResults) {
      const customId = result.custom_id;
      const originalItem = imageMap.get(customId);
      
      if (!originalItem) {
        this.logger.error(`❌ Could not find original item for ${customId}`);
        continue;
      }
      
      try {
        const response = result.response.body;
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
        
        // Track usage and costs (Batch API is 50% cheaper)
        const promptTokens = response.usage.prompt_tokens;
        const completionTokens = response.usage.completion_tokens;
        const tokensUsed = response.usage.total_tokens;
        
        // Batch API pricing: 50% discount on standard rates
        // Standard: $0.000150 input, $0.000600 output
        // Batch: $0.000075 input, $0.000300 output
        const cost = (promptTokens * 0.000075 / 1000) + (completionTokens * 0.000300 / 1000);
        
        totalTokens += tokensUsed;
        totalCost += cost;
        this.processedCount++;
        
        // Group by post
        if (!postsMap.has(originalItem.postId)) {
          const metadata = originalItem.metadata || {};
          if (!metadata.post_id || !metadata.username) {
            this.logger.error(`❌ Skipping post ${originalItem.postId}: missing required metadata`);
            continue;
          }
          
          postsMap.set(originalItem.postId, {
            ...metadata,
            image_paths: [],
            image_analyses: []
          });
        }
        
        const post = postsMap.get(originalItem.postId);
        post.image_paths.push(originalItem.imagePath);
        post.image_analyses.push(analysis);
        
        if (this.processedCount % 100 === 0) {
          this.logger.info(`💰 Batch progress: ${this.processedCount} images processed, $${totalCost.toFixed(4)} spent`);
        }
        
      } catch (err) {
        this.logger.error(`Failed to process batch result for ${customId}: ${err.message}`);
        continue;
      }
    }
    
    // Log final cost summary
    this.totalCost = totalCost;
    this.totalTokens = totalTokens;
    
    this.logger.info(`🎉 BATCH AI Analysis Complete: ${this.processedCount} images processed`);
    this.logger.info(`💰 Total Batch Cost: $${this.totalCost.toFixed(4)} (avg $${(this.totalCost/this.processedCount).toFixed(6)} per image)`);
    this.logger.info(`💰 Total Tokens: ${this.totalTokens} (avg ${Math.round(this.totalTokens/this.processedCount)} per image)`);
    this.logger.info(`💰 Batch API Savings: 50% cheaper than individual calls!`);
    
    const regularCost = this.totalCost * 2; // What it would cost with regular API
    this.logger.info(`💰 You saved $${(regularCost - this.totalCost).toFixed(4)} compared to individual API calls`);
    
    return Array.from(postsMap.values());
  }

  getCostSummary() {
    return {
      totalCost: this.totalCost,
      totalTokens: this.totalTokens,
      processedCount: this.processedCount,
      averageCostPerImage: this.processedCount > 0 ? this.totalCost / this.processedCount : 0,
      averageTokensPerImage: this.processedCount > 0 ? this.totalTokens / this.processedCount : 0,
      batchSavings: this.totalCost, // This IS the savings (50% off)
      regularCostWouldBe: this.totalCost * 2
    };
  }
} 