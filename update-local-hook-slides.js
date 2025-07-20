import dotenv from 'dotenv';
import { HookSlideAnalyzerBatch } from './src/stages/hook-slide-analyzer-batch.js';
import { HookSlideStorage } from './src/stages/hook-slide-storage.js';
import { SupabaseClient } from './src/database/supabase-client.js';
import { Logger } from './src/utils/logger.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = new Logger();

async function updateLocalHookSlides() {
  logger.info('🎯 Starting hook slide detection on local images...');
  
  try {
    // Initialize components
    const hookSlideAnalyzer = new HookSlideAnalyzerBatch();
    const hookSlideStorage = new HookSlideStorage();
    const db = new SupabaseClient();
    
    // Find all local jpg images in temp directory
    logger.info('📂 Scanning temp directory for images...');
    const tempDir = path.join(__dirname, 'temp');
    const imageFiles = [];
    
    async function scanDirectory(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.jpg')) {
          // Extract post ID from filename
          const filename = entry.name;
          const postIdMatch = filename.match(/^(\d+)_slide_\d+\.jpg$/);
          
          if (postIdMatch) {
            const postId = postIdMatch[1];
            
            // Check if this post exists in our database
            const { data: existingPost } = await db.client
              .from('posts')
              .select('post_id')
              .eq('post_id', postId)
              .single();
            
            if (existingPost) {
              imageFiles.push({
                postId: postId,
                imagePath: fullPath,
                metadata: {
                  post_id: postId,
                  username: path.basename(path.dirname(path.dirname(fullPath))), // Extract username from path
                  image_path: fullPath
                }
              });
            }
          }
        }
      }
    }
    
    await scanDirectory(tempDir);
    
    logger.info(`📊 Found ${imageFiles.length} local images to process`);
    
    if (imageFiles.length === 0) {
      logger.info('✅ No images to process');
      return { processed: 0, found: 0, cost: 0 };
    }
    
    // Process images in smaller batches to avoid file size limits
    const BATCH_SIZE = 500; // Process 500 images at a time
    const allHookSlides = [];
    
    for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
      const batch = imageFiles.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(imageFiles.length / BATCH_SIZE);
      
      logger.info(`✨ Processing batch ${batchNum}/${totalBatches} (${batch.length} images)`);
      
      const hookSlides = await hookSlideAnalyzer.process(batch);
      allHookSlides.push(...hookSlides);
      
      logger.info(`🎯 Batch ${batchNum} complete: ${hookSlides.length} hook slides found`);
    }
    
    // Store the results
    logger.info('💾 Storing hook slide results...');
    const hookStats = await hookSlideStorage.process(allHookSlides);
    
    // Log results
    logger.info('🎉 Hook slide detection complete!');
    logger.info(`   📊 Images processed: ${imageFiles.length}`);
    logger.info(`   ✨ Hook slides found: ${hookStats.stored}`);
    logger.info(`   🎯 Discovery rate: ${((hookStats.stored / imageFiles.length) * 100).toFixed(1)}%`);
    logger.info(`   💰 Total cost: $${hookSlideAnalyzer.totalCost.toFixed(4)} (BATCH mode)`);
    
    const regularCost = hookSlideAnalyzer.totalCost * 2;
    logger.info(`   💰 Batch savings: $${(regularCost - hookSlideAnalyzer.totalCost).toFixed(4)} (50% off individual calls)`);
    
    return {
      processed: imageFiles.length,
      found: hookStats.stored,
      cost: hookSlideAnalyzer.totalCost
    };
    
  } catch (error) {
    logger.error(`❌ Hook slide detection failed: ${error.message}`);
    throw error;
  }
}

// Run the script
updateLocalHookSlides()
  .then(result => {
    console.log('\n🎉 SUCCESS!');
    console.log(`📊 Processed: ${result.processed} images`);
    console.log(`✨ Found: ${result.found} hook slides`);
    console.log(`💰 Cost: $${result.cost.toFixed(4)}`);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ FAILED:', error.message);
    process.exit(1);
  }); 