import { createClient } from '@supabase/supabase-js';
import { ComprehensiveImageAnalyzer } from './src/stages/comprehensive-image-analyzer.js';
import { Logger } from './src/utils/logger.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const logger = new Logger();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runComprehensiveAnalysis() {
  logger.info('🚀 Starting Comprehensive Image Analysis Pipeline');
  logger.info('   📊 This will analyze item preferences AND cover slides for all images');
  
  try {
    // Fetch images in chunks to bypass Supabase row limits
    logger.info('📋 Fetching images from database...');
    
    let images = [];
    let offset = 0;
    const chunkSize = 1000;
    
    while (true) {
      const { data: chunk, error } = await supabase
        .from('images')
        .select('id, post_id, image_path, item_preference, is_cover_slide, cover_slide_text')
        .not('image_path', 'is', null)
        .order('id')
        .range(offset, offset + chunkSize - 1);

      if (error) {
        logger.error(`❌ Failed to fetch images chunk at offset ${offset}: ${error.message}`);
        return;
      }

      if (!chunk || chunk.length === 0) {
        break; // No more data
      }

      images = images.concat(chunk);
      offset += chunkSize;
      
      logger.info(`📋 Fetched ${images.length} images so far...`);
      
      if (chunk.length < chunkSize) {
        break; // Last chunk was smaller than expected, we're done
      }
    }

    logger.info(`📊 Found ${images.length} total images in database`);

    // Filter to images that need analysis
    const needsAnalysis = images.filter(img => 
      !img.item_preference || // No item preference yet
      (img.is_cover_slide === null || img.is_cover_slide === false) && !img.cover_slide_text // No cover slide analysis
    );

    logger.info(`🎯 ${needsAnalysis.length} images need analysis`);
    logger.info(`✅ ${images.length - needsAnalysis.length} images already analyzed`);

    if (needsAnalysis.length === 0) {
      logger.info('🎉 All images already analyzed! Nothing to do.');
      return;
    }

    // Transform data for analyzer
    const imagesToAnalyze = needsAnalysis.map(img => ({
      imageId: img.id,
      postId: img.post_id,
      imagePath: img.image_path
    }));

    // Run comprehensive analysis
    const analyzer = new ComprehensiveImageAnalyzer();
    const results = await analyzer.process(imagesToAnalyze);

    // Save results to database
    logger.info('💾 Saving results to database...');
    let successCount = 0;
    let errorCount = 0;

    for (const result of results) {
      try {
        const updateData = {
          item_preference: result.item_preference,
          is_cover_slide: result.is_cover_slide,
          cover_slide_text: result.cover_slide_text,
          updated_at: new Date().toISOString()
        };

        // Store additional analysis in the analysis JSONB field
        if (result.raw_analysis) {
          updateData.analysis = {
            ...updateData.analysis,
            comprehensive_analysis: {
              preference_confidence: result.preference_confidence,
              theme: result.theme,
              analyzed_at: new Date().toISOString(),
              analyzer_version: '1.0'
            }
          };
        }

        const { error: updateError } = await supabase
          .from('images')
          .update(updateData)
          .eq('id', result.imageId);

        if (updateError) {
          logger.error(`❌ Failed to update image ${result.imageId}: ${updateError.message}`);
          errorCount++;
        } else {
          successCount++;
          if (successCount % 100 === 0) {
            logger.info(`💾 Saved ${successCount}/${results.length} results...`);
          }
        }

      } catch (err) {
        logger.error(`❌ Exception updating image ${result.imageId}: ${err.message}`);
        errorCount++;
      }
    }

    // Final summary
    logger.info('🎉 Comprehensive Analysis Pipeline Complete!');
    logger.info(`📊 Total images processed: ${results.length}`);
    logger.info(`✅ Successfully saved: ${successCount}`);
    logger.info(`❌ Errors: ${errorCount}`);
    
    // Show final database state
    const { data: finalCount } = await supabase
      .from('images')
      .select('item_preference, is_cover_slide')
      .not('item_preference', 'is', null);
    
    logger.info(`🗄️  Database now has ${finalCount?.length || 0} images with item preferences`);

  } catch (error) {
    logger.error(`❌ Pipeline failed: ${error.message}`);
    logger.error(error.stack);
  }
}

// Run if called directly
const currentFileUrl = import.meta.url;
const currentFilePath = fileURLToPath(currentFileUrl);
const scriptPath = process.argv[1];

if (currentFilePath === scriptPath) {
  console.log('Running comprehensive analysis...');
  runComprehensiveAnalysis()
    .then(() => {
      console.log('✅ Pipeline completed successfully');
      logger.info('✅ Pipeline completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error(`❌ Pipeline failed: ${error.message}`);
      console.error(error.stack);
      logger.error(`❌ Pipeline failed: ${error.message}`);
      process.exit(1);
    });
} 