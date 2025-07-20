import { Logger } from '../utils/logger.js';
import OpenAI from 'openai';
import fs from 'fs-extra';
import path from 'path';

export class HookSlideAnalyzerBatch {
  constructor() {
    this.logger = new Logger();
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.processedCount = 0;
    this.totalCost = 0;
    this.totalTokens = 0;
    this.hookSlidesFound = 0;
    this.batchDir = './temp/batch-hook-slides';
  }

  async process(images) {
    this.logger.info(`🎯 Starting BATCH hook slide detection - Processing ${images.length} images with 50% cost savings`);
    
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
    this.logger.info(`📦 Creating batch tasks for ${images.length} hook slide analyses`);
    
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
          custom_id: `hook-task-${i}-${item.postId}`,
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
                    text: `Analyze if this image is a "hook slide" - an image with text overlays that announces a theme like "Back to School Outfits", "Summer Vacation Fits", "Date Night Looks", etc. 

Return JSON: {
  "h": true/false,
  "c": 0.0-1.0,
  "t": "extracted text or null",
  "th": "theme like 'back to school' or null",
  "cd": "content direction or null",
  "tv": "target vibe like 'preppy' or null"
}

Focus on images with clear text overlays announcing outfit themes.` 
                  },
                  { 
                    type: 'image_url', 
                    image_url: { url: `data:image/jpeg;base64,${base64Image}` } 
                  }
                ]
              }
            ],
            max_tokens: 120,
            temperature: 0
          }
        };
        
        tasks.push(task);
        
        if ((i + 1) % 100 === 0) {
          this.logger.info(`📝 Created ${i + 1}/${images.length} hook slide batch tasks`);
        }
        
      } catch (err) {
        this.logger.error(`Failed to process image ${item.imagePath}: ${err.message}`);
        continue;
      }
    }
    
    this.logger.info(`✅ Created ${tasks.length} hook slide batch tasks`);
    return tasks;
  }

  async createBatchJob(batchTasks) {
    this.logger.info(`🚀 Creating batch job for ${batchTasks.length} hook slide tasks`);
    
    // Save batch tasks to file
    const batchFileName = `hook-slide-batch-${Date.now()}.jsonl`;
    const batchFilePath = path.join(this.batchDir, batchFileName);
    
    const batchContent = batchTasks.map(task => JSON.stringify(task)).join('\n');
    await fs.writeFile(batchFilePath, batchContent);
    
    this.logger.info(`📄 Batch file created: ${batchFilePath}`);
    
    // Upload batch file
    this.logger.info('📤 Uploading batch file to OpenAI...');
    const fileUpload = await this.openai.files.create({
      file: fs.createReadStream(batchFilePath),
      purpose: 'batch'
    });
    
    this.logger.info(`✅ File uploaded with ID: ${fileUpload.id}`);
    
    // Create batch job
    this.logger.info('🔄 Creating batch job...');
    const batch = await this.openai.batches.create({
      input_file_id: fileUpload.id,
      endpoint: '/v1/chat/completions',
      completion_window: '24h',
      metadata: {
        description: 'Hook slide detection batch',
        type: 'hook-slide-analysis'
      }
    });
    
    this.logger.info(`✅ Batch job created with ID: ${batch.id}`);
    this.logger.info(`📊 Status: ${batch.status}`);
    
    return batch;
  }

  async waitAndGetResults(batchJob) {
    this.logger.info(`⏳ Waiting for batch job ${batchJob.id} to complete...`);
    this.logger.info('💡 Batch jobs can take 5-10 minutes but cost 50% less!');
    
    let batch = batchJob;
    let attempts = 0;
    const maxAttempts = 60; // 30 minutes max wait time
    
    while (batch.status === 'in_progress' || batch.status === 'validating') {
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
      attempts++;
      
      batch = await this.openai.batches.retrieve(batch.id);
      this.logger.info(`⏳ Batch status: ${batch.status} (attempt ${attempts}/${maxAttempts})`);
      
      if (attempts >= maxAttempts) {
        throw new Error('Batch job timed out after 30 minutes');
      }
    }
    
    if (batch.status !== 'completed') {
      throw new Error(`Batch job failed with status: ${batch.status}`);
    }
    
    this.logger.info(`✅ Batch job completed! Downloading results...`);
    
    // Download results
    const resultFile = await this.openai.files.content(batch.output_file_id);
    const resultText = await resultFile.text();
    
    // Parse results
    const results = resultText.trim().split('\n').map(line => JSON.parse(line));
    
    this.logger.info(`📥 Downloaded ${results.length} batch results`);
    
    return results;
  }

  processResults(batchResults, originalImages) {
    this.logger.info(`🔄 Processing batch results for hook slide detection...`);
    
    // Create lookup map for original images
    const imageMap = new Map();
    originalImages.forEach((item, index) => {
      imageMap.set(`hook-task-${index}-${item.postId}`, item);
    });
    
    const hookSlides = [];
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
          is_hook_slide: compressed.h,
          confidence: compressed.c,
          text_detected: compressed.t,
          theme: compressed.th,
          content_direction: compressed.cd,
          target_vibe: compressed.tv
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
        
        // If this is a hook slide, add it to our collection
        if (analysis.is_hook_slide && analysis.confidence > 0.7) {
          this.hookSlidesFound++;
          
          const hookSlide = {
            ...originalItem.metadata,
            post_id: originalItem.postId,
            image_path: originalItem.imagePath,
            hook_analysis: analysis,
            created_at: new Date().toISOString()
          };
          
          hookSlides.push(hookSlide);
          
          this.logger.info(`✨ HOOK SLIDE FOUND: "${analysis.text_detected}" - Theme: ${analysis.theme} (${(analysis.confidence * 100).toFixed(1)}% confidence)`);
        }
        
        if (this.processedCount % 50 === 0) {
          this.logger.info(`💰 Batch progress: ${this.processedCount} images processed, ${this.hookSlidesFound} hook slides found, $${totalCost.toFixed(4)} spent`);
        }
        
      } catch (err) {
        this.logger.error(`Failed to process batch result for ${customId}: ${err.message}`);
        continue;
      }
    }
    
    // Store final totals
    this.totalCost = totalCost;
    this.totalTokens = totalTokens;
    
    // Log final summary
    this.logger.info(`🎉 BATCH Hook Slide Detection Complete:`);
    this.logger.info(`   📊 Images processed: ${this.processedCount}`);
    this.logger.info(`   ✨ Hook slides found: ${this.hookSlidesFound}`);
    this.logger.info(`   🎯 Discovery rate: ${((this.hookSlidesFound / this.processedCount) * 100).toFixed(1)}%`);
    this.logger.info(`   💰 Total Batch cost: $${this.totalCost.toFixed(4)} (avg $${(this.totalCost/this.processedCount).toFixed(6)} per image)`);
    this.logger.info(`   💰 Total tokens: ${this.totalTokens} (avg ${Math.round(this.totalTokens/this.processedCount)} per image)`);
    this.logger.info(`   💰 Batch API Savings: 50% cheaper than individual calls!`);
    
    const regularCost = this.totalCost * 2; // What it would cost with regular API
    this.logger.info(`   💰 You saved $${(regularCost - this.totalCost).toFixed(4)} compared to individual API calls`);

    return hookSlides;
  }

  getCostSummary() {
    const regularCostWouldBe = this.totalCost * 2;
    const batchSavings = regularCostWouldBe - this.totalCost;
    
    return {
      processedCount: this.processedCount,
      hookSlidesFound: this.hookSlidesFound,
      totalCost: this.totalCost,
      totalTokens: this.totalTokens,
      averageCostPerImage: this.processedCount > 0 ? this.totalCost / this.processedCount : 0,
      discoveryRate: this.processedCount > 0 ? (this.hookSlidesFound / this.processedCount) * 100 : 0,
      regularCostWouldBe,
      batchSavings
    };
  }
} 