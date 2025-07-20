import { FashionDataPipelineBatch } from './src/pipeline/fashion-pipeline-batch.js';
import { Logger } from './src/utils/logger.js';

const logger = new Logger();

async function main() {
  try {
    logger.info('🚀 Starting Fashion Data Pipeline with BATCH AI Processing');
    logger.info('💰 This will use OpenAI Batch API for 50% cost savings!');
    
    const pipeline = new FashionDataPipelineBatch();
    await pipeline.run();
    
    logger.info('✅ Batch pipeline completed successfully!');
    
  } catch (error) {
    logger.error(`❌ Pipeline failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main(); 