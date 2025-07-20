import dotenv from 'dotenv';
import { SupabaseClient } from './src/database/supabase-client.js';
import { Logger } from './src/utils/logger.js';
import OpenAI from 'openai';

// Load environment variables
dotenv.config();

const logger = new Logger();
const openai = new OpenAI();

async function processSupabaseHookSlides() {
  logger.info('🎯 Starting hook slide detection on Supabase images...');
  
  try {
    const db = new SupabaseClient();
    
    // Step 1: Get ALL images from Supabase database
    logger.info('📊 Fetching images from Supabase database...');
    
    let allImages = [];
    let offset = 0;
    const batchSize = 1000;
    
    while (true) {
      const { data: batch, error } = await db.client
        .from('images')
        .select('id, image_path, post_id, username')
        .not('image_path', 'is', null)
        .range(offset, offset + batchSize - 1);
      
      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }
      
      if (!batch || batch.length === 0) {
        break;
      }
      
      allImages.push(...batch);
      offset += batchSize;
      
      logger.info(`📈 Fetched ${allImages.length} images so far...`);
    }
    
    logger.info(`✅ Found ${allImages.length} total images in database`);
    
    // Step 2: Check which images already have hook slide analysis
    const { data: existingHookSlides } = await db.client
      .from('hook_slides')
      .select('post_id');
    
    const processedPostIds = new Set(existingHookSlides?.map(slide => slide.post_id) || []);
    
    // Filter to only unprocessed images
    const unprocessedImages = allImages.filter(img => !processedPostIds.has(img.post_id));
    
    logger.info(`🎯 Found ${unprocessedImages.length} images that need hook slide analysis`);
    logger.info(`✅ Already processed: ${allImages.length - unprocessedImages.length} images`);
    
    if (unprocessedImages.length === 0) {
      logger.info('🎉 All images have already been processed for hook slides!');
      return;
    }
    
    // Step 3: Process images in batches
    const BATCH_SIZE = 100; // Process 100 images at a time
    let totalProcessed = 0;
    let totalHookSlides = 0;
    
    for (let i = 0; i < unprocessedImages.length; i += BATCH_SIZE) {
      const batch = unprocessedImages.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(unprocessedImages.length / BATCH_SIZE);
      
      logger.info(`✨ Processing batch ${batchNum}/${totalBatches} (${batch.length} images)`);
      
      // Process this batch
      const batchResults = await processBatch(batch, openai, db);
      
      totalProcessed += batch.length;
      totalHookSlides += batchResults.hookSlidesFound;
      
      logger.info(`🎯 Batch ${batchNum} complete: ${batchResults.hookSlidesFound} hook slides found`);
      logger.info(`📊 Progress: ${totalProcessed}/${unprocessedImages.length} images processed`);
    }
    
    logger.info('🎉 Hook slide detection complete!');
    logger.info(`📊 Total processed: ${totalProcessed} images`);
    logger.info(`✨ Total hook slides found: ${totalHookSlides}`);
    
  } catch (error) {
    logger.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

async function processBatch(images, openai, db) {
  try {
    // Create batch requests for OpenAI
    const requests = images.map((image, index) => ({
      custom_id: `hook-slide-${image.id}`,
      method: "POST",
      url: "/v1/chat/completions",
      body: {
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this fashion image to determine if it's a "hook slide" - an image designed to grab attention and encourage engagement (like outfit reveals, before/after transformations, styling tips, or fashion advice). 

Return JSON with:
- isHookSlide: boolean
- confidence: number (0-1)
- theme: string (if hook slide: "outfit-reveal", "transformation", "styling-tips", "fashion-advice", "product-showcase", or "other")
- text: string (any visible text in the image, or null)`
              },
              {
                type: "image_url",
                image_url: {
                  url: image.image_path
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 200
      }
    }));
    
    // Create batch file content
    const batchContent = requests.map(req => JSON.stringify(req)).join('\n');
    
    // Submit to OpenAI batch API
    const batchResponse = await openai.batches.create({
      input_file_id: await uploadBatchFile(batchContent, openai),
      endpoint: "/v1/chat/completions",
      completion_window: "24h"
    });
    
    // Wait for batch to complete (simplified - in production you'd check status periodically)
    logger.info(`⏳ Batch submitted: ${batchResponse.id}. Waiting for completion...`);
    
    let batch = batchResponse;
    while (batch.status === 'validating' || batch.status === 'in_progress' || batch.status === 'finalizing') {
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
      batch = await openai.batches.retrieve(batch.id);
      logger.info(`⏳ Batch status: ${batch.status}`);
    }
    
    if (batch.status !== 'completed') {
      throw new Error(`Batch failed with status: ${batch.status}`);
    }
    
    // Download and process results
    const resultFile = await openai.files.content(batch.output_file_id);
    const resultText = await resultFile.text();
    const results = resultText.trim().split('\n').map(line => JSON.parse(line));
    
    // Store results in database
    let hookSlidesFound = 0;
    
    for (const result of results) {
      const customId = result.custom_id;
      const imageId = customId.replace('hook-slide-', '');
      const image = images.find(img => img.id.toString() === imageId);
      
      if (!image) continue;
      
      try {
        const analysis = JSON.parse(result.response.body.choices[0].message.content);
        
        if (analysis.isHookSlide) {
          // Store in hook_slides table
          await db.client
            .from('hook_slides')
            .insert({
              post_id: image.post_id,
              username: image.username,
              confidence: analysis.confidence,
              theme: analysis.theme,
              text_content: analysis.text,
              image_path: image.image_path,
              created_at: new Date().toISOString()
            });
          
          hookSlidesFound++;
        }
      } catch (parseError) {
        logger.error(`❌ Failed to parse result for image ${imageId}: ${parseError.message}`);
      }
    }
    
    return { hookSlidesFound };
    
  } catch (error) {
    logger.error(`❌ Batch processing failed: ${error.message}`);
    throw error;
  }
}

async function uploadBatchFile(content, openai) {
  // Create a buffer from the content
  const buffer = Buffer.from(content, 'utf8');
  
  const file = await openai.files.create({
    file: new File([buffer], 'batch.jsonl', { type: 'application/jsonl' }),
    purpose: 'batch'
  });
  return file.id;
}

// Run the script
processSupabaseHookSlides(); 