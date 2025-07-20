import dotenv from 'dotenv';
import { SupabaseClient } from './src/database/supabase-client.js';
import { HookSlideAnalyzerBatch } from './src/stages/hook-slide-analyzer-batch.js';
import { BackgroundColorAnalyzer } from './src/stages/background-color-analyzer.js';
import { Logger } from './src/utils/logger.js';
import fs from 'fs-extra';
import path from 'path';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

const logger = new Logger();

async function updateSupabaseImages() {
  logger.info('🎯 Starting hook slide + background analysis on Supabase images...');
  
  try {
    const db = new SupabaseClient();
    
    // Step 1: Add missing fields to database schema
    logger.info('📝 Adding missing fields to images table...');
    await addMissingFields(db);
    
    // Step 2: Get ALL images from database that need analysis
    logger.info('📊 Fetching ALL images from database...');
    
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
        break; // No more images
      }
      
      allImages.push(...batch);
      offset += batchSize;
      
      logger.info(`📊 Fetched ${allImages.length} images so far...`);
      
      if (batch.length < batchSize) {
        break; // Last batch
      }
    }
    
    const images = allImages;
    
    if (!images || images.length === 0) {
      logger.info('✅ All images have already been analyzed!');
      return;
    }
    
    logger.info(`🎯 Found ${images.length} images to analyze`);
    
    // Step 3: Process images in batches
    const BATCH_SIZE = 500; // Process 500 images at a time (increased from 100)
    const tempDir = './temp/analysis';
    await fs.ensureDir(tempDir);
    
    for (let i = 0; i < images.length; i += BATCH_SIZE) {
      const batch = images.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(images.length / BATCH_SIZE);
      
      logger.info(`✨ Processing batch ${batchNum}/${totalBatches} (${batch.length} images)`);
      
      // Download batch of images temporarily
      const downloadedImages = [];
      for (const image of batch) {
        try {
          const tempPath = await downloadImage(image.image_path, tempDir, image.id);
          downloadedImages.push({
            ...image,
            tempPath
          });
        } catch (downloadError) {
          logger.error(`❌ Failed to download image ${image.id}: ${downloadError.message}`);
        }
      }
      
      if (downloadedImages.length === 0) {
        logger.warn(`⚠️ No images downloaded for batch ${batchNum}, skipping...`);
        continue;
      }
      
      // Run hook slide analysis
      logger.info(`🎯 Running hook slide analysis on ${downloadedImages.length} images...`);
      const hookSlideAnalyzer = new HookSlideAnalyzerBatch();
      
      // Format images for hook slide analyzer (it expects postId and imagePath)
      const hookSlideImageFormat = downloadedImages.map(img => ({
        postId: img.post_id,
        imagePath: img.tempPath,
        metadata: {
          id: img.id,
          username: img.username
        }
      }));
      
      const hookSlides = await hookSlideAnalyzer.process(hookSlideImageFormat);
      
      // Run background color analysis
      logger.info(`🎨 Running background color analysis on ${downloadedImages.length} images...`);
      const backgroundAnalyzer = new BackgroundColorAnalyzer();
      
      // Format images for background analyzer (it expects postId and imagePath)
      const backgroundImageFormat = downloadedImages.map(img => ({
        postId: img.post_id,
        imagePath: img.tempPath,
        metadata: {
          id: img.id,
          username: img.username
        }
      }));
      
      const backgroundResults = await backgroundAnalyzer.process(backgroundImageFormat);
      
      // Update database with results
      logger.info(`💾 Updating database with analysis results...`);
      await updateDatabaseResults(db, downloadedImages, hookSlides, backgroundResults);
      
      // Clean up temporary files
      for (const image of downloadedImages) {
        try {
          await fs.remove(image.tempPath);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }
      
      logger.info(`✅ Batch ${batchNum} complete`);
    }
    
    // Clean up temp directory
    await fs.remove(tempDir);
    
    logger.info('🎉 All images analyzed and updated successfully!');
    
  } catch (error) {
    logger.error(`❌ Error during analysis: ${error.message}`);
    throw error;
  }
}

async function addMissingFields(db) {
  logger.info('📝 Note: You need to add the missing fields to your Supabase database manually.');
  logger.info('🔧 Go to your Supabase SQL Editor and run:');
  
  const sqlScript = `
-- Add hook slide fields
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS is_hook_slide BOOLEAN DEFAULT NULL;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS hook_confidence DECIMAL(3,2) DEFAULT NULL;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS hook_theme TEXT DEFAULT NULL;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS hook_text TEXT DEFAULT NULL;

-- Add background color fields  
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS primary_bg_color TEXT DEFAULT NULL;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS secondary_bg_color TEXT DEFAULT NULL;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS bg_color_hex TEXT DEFAULT NULL;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS bg_type TEXT DEFAULT NULL;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS bg_brightness TEXT DEFAULT NULL;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS uniformity_score DECIMAL(3,2) DEFAULT NULL;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS suitable_for_matching BOOLEAN DEFAULT NULL;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS background_analysis JSONB DEFAULT '{}';
  `;
  
  console.log(sqlScript);
  
  // For now, we'll assume the fields exist or will be added manually
  logger.info('⏳ Continuing with analysis (assuming fields exist)...');
}

async function downloadImage(imageUrl, tempDir, imageId) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  
  const buffer = await response.buffer();
  const extension = path.extname(imageUrl) || '.jpg';
  const tempPath = path.join(tempDir, `${imageId}${extension}`);
  
  await fs.writeFile(tempPath, buffer);
  return tempPath;
}

async function updateDatabaseResults(db, images, hookSlides, backgroundResults) {
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const hookSlide = hookSlides[i];
    
    // Find matching background result by post_id
    const bgResult = backgroundResults.find(bg => bg.post_id === image.post_id);
    
    const updateData = {
      // Hook slide data
      is_hook_slide: hookSlide?.isHookSlide || false,
      hook_confidence: hookSlide?.confidence || null,
      hook_theme: hookSlide?.theme || null,
      hook_text: hookSlide?.text || null,
      
      // Background color data (from background_analysis object)
      primary_bg_color: bgResult?.background_analysis?.primary_bg_color || null,
      secondary_bg_color: bgResult?.background_analysis?.secondary_bg_color || null,
      bg_color_hex: bgResult?.background_analysis?.bg_color_hex || null,
      bg_type: bgResult?.background_analysis?.bg_type || null,
      bg_brightness: bgResult?.background_analysis?.bg_brightness || null,
      uniformity_score: bgResult?.background_analysis?.uniformity_score || null,
      suitable_for_matching: bgResult?.background_analysis?.suitable_for_matching || false,
      background_analysis: bgResult?.background_analysis ? JSON.stringify(bgResult.background_analysis) : '{}',
      
      updated_at: new Date().toISOString()
    };
    
    const { error } = await db.client
      .from('images')
      .update(updateData)
      .eq('id', image.id);
    
    if (error) {
      logger.error(`❌ Failed to update image ${image.id}: ${error.message}`);
    }
  }
}

// Run the script
updateSupabaseImages().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
}); 