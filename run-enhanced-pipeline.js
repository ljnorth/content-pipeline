import { FashionDataPipelineEnhanced } from './src/pipeline/fashion-pipeline-enhanced.js';
import { Logger } from './src/utils/logger.js';

const logger = new Logger();

async function main() {
  try {
    logger.info('🚀 Starting Enhanced Fashion Data Pipeline');
    logger.info('✨ Features: Hook Slide Detection + Background Color Analysis + Regular Processing');
    
    const pipeline = new FashionDataPipelineEnhanced();
    const result = await pipeline.run();
    
    logger.info('🎉 Enhanced pipeline completed successfully!');
    logger.info('📊 FINAL RESULTS:');
    logger.info(`   👥 Accounts: ${result.accounts}`);
    logger.info(`   📄 Posts: ${result.posts}`);
    logger.info(`   🖼️ Images: ${result.images}`);
    logger.info(`   ✨ Hook Slides: ${result.hookSlides}`);
    logger.info(`   🎨 Background Analyzed: ${result.backgroundAnalyzed}`);
    logger.info(`   💰 Total Cost: $${result.totalCost.toFixed(4)}`);
    
  } catch (error) {
    logger.error(`❌ Enhanced pipeline failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Check command line arguments for specific operations
const args = process.argv.slice(2);
if (args.includes('--hook-slides-only')) {
  // Run only hook slide detection
  (async () => {
    try {
      logger.info('✨ Running Hook Slide Detection Only');
      const pipeline = new FashionDataPipelineEnhanced();
      const result = await pipeline.runHookSlideDetectionOnly();
      
      logger.info('🎉 Hook slide detection completed!');
      logger.info(`   📊 Images processed: ${result.processed}`);
      logger.info(`   ✨ Hook slides found: ${result.found}`);
      logger.info(`   💰 Cost: $${result.cost.toFixed(4)}`);
      
    } catch (error) {
      logger.error(`❌ Hook slide detection failed: ${error.message}`);
      process.exit(1);
    }
  })();
} else {
  // Run full enhanced pipeline
  main();
} 