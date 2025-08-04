import { SupabaseClient } from './src/database/supabase-client.js';
import { ItemPreferenceAnalyzer } from './src/stages/item-preference-analyzer.js';
import { Logger } from './src/utils/logger.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const logger = new Logger();
const db = new SupabaseClient();

// Parse command line arguments
const args = process.argv.slice(2);
const limitFlag = args.find(arg => arg.startsWith('--limit='));
const limit = limitFlag ? parseInt(limitFlag.split('=')[1]) : 50; // Default to 50 for testing

async function runItemPreferenceAnalysis() {
  logger.info('🚀 Starting Phase 2.3: Item Preference Analysis');
  logger.info(`📊 Processing limit: ${limit} images`);
  
  try {
    // Get images that don't have item preference analysis yet
    logger.info('📋 Fetching images without item preference data...');
    
    const { data: images, error: fetchError } = await db.client
      .from('images')
      .select('id, post_id, image_path')
      .is('item_preference', null) // Only images without item preference
      .not('image_path', 'is', null) // Must have valid image path
      .order('id', { ascending: true }) // Process oldest first
      .limit(limit);

    if (fetchError) {
      logger.error('❌ Error fetching images:', fetchError);
      return;
    }

    if (!images || images.length === 0) {
      logger.info('✅ No images found without item preference analysis!');
      logger.info('🎉 All images have been processed. Phase 2.3 complete!');
      return;
    }

    logger.info(`✅ Found ${images.length} images to analyze`);

    // Prepare data for analyzer
    const analysisData = images.map(img => ({
      imageId: img.id,
      postId: img.post_id,
      imagePath: img.image_path
    }));

    // Run item preference analysis
    logger.info('🔍 Running item preference analysis...');
    const analyzer = new ItemPreferenceAnalyzer();
    const results = await analyzer.process(analysisData);

    // Store results in database
    logger.info('💾 Storing results in database...');
    let successCount = 0;
    let errorCount = 0;

    for (const result of results) {
      try {
        const { data, error: updateError } = await db.client
          .from('images')
          .update({
            item_preference: result.item_preference,
            // Store additional analysis data in rich_context if needed
            rich_context: {
              preference_confidence: result.preference_confidence,
              preference_reasoning: result.preference_reasoning,
              analyzed_at: new Date().toISOString()
            }
          })
          .eq('id', result.imageId)
          .select('id, item_preference');

        if (updateError) {
          logger.error(`❌ Failed to update image ${result.imageId}: ${updateError.message}`);
          errorCount++;
        } else if (data && data.length > 0) {
          logger.info(`✅ Updated image ${result.imageId}: ${result.item_preference}`);
          successCount++;
        } else {
          logger.error(`❌ No rows updated for image ${result.imageId} (might not exist)`);
          errorCount++;
        }

      } catch (err) {
        logger.error(`❌ Exception updating image ${result.imageId}: ${err.message}`);
        errorCount++;
      }
    }

    // Final summary
    logger.info('🎉 Phase 2.3 Item Preference Analysis Complete!');
    logger.info(`   📊 Images processed: ${results.length}`);
    logger.info(`   ✅ Successfully updated: ${successCount}`);
    logger.info(`   ❌ Errors: ${errorCount}`);
    
    // Show breakdown of results
    const singleItems = results.filter(r => r.item_preference === 'single_item').length;
    const fullOutfits = results.filter(r => r.item_preference === 'full_outfit').length;
    const onPerson = results.filter(r => r.item_preference === 'on_person').length;
    
    logger.info('📈 Item Preference Breakdown:');
    logger.info(`   👕 Single items: ${singleItems} (${((singleItems / results.length) * 100).toFixed(1)}%)`);
    logger.info(`   👗 Full outfits: ${fullOutfits} (${((fullOutfits / results.length) * 100).toFixed(1)}%)`);
    logger.info(`   👤 On person: ${onPerson} (${((onPerson / results.length) * 100).toFixed(1)}%)`);

    // Check remaining work
    const { data: remainingImages, error: countError } = await db.client
      .from('images')
      .select('id', { count: 'exact' })
      .is('item_preference', null)
      .not('image_path', 'is', null);

    if (!countError && remainingImages) {
      const remaining = remainingImages.length;
      logger.info(`📋 Remaining images to analyze: ${remaining}`);
      
      if (remaining > 0) {
        logger.info('🔄 To continue analysis, run:');
        logger.info(`   node run-item-preference-analysis.js --limit=${Math.min(remaining, 100)}`);
      }
    }

  } catch (error) {
    logger.error('❌ Fatal error in item preference analysis:', error);
    process.exit(1);
  }
}

// Run the analysis
runItemPreferenceAnalysis(); 