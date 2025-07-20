import { FashionDataPipelineFast } from './src/pipeline/fashion-pipeline-fast.js';
import { Logger } from './src/utils/logger.js';

const logger = new Logger();

async function main() {
  try {
    logger.info('⚡ Starting Fashion Data Pipeline with FAST concurrent processing');
    logger.info('🚀 Real-time results with 10x speed improvement!');
    
    // You can customize concurrency and rate limiting
    const options = {
      concurrency: 15,      // Process 15 images simultaneously (adjust based on rate limits)
      rateLimitDelay: 50    // 50ms delay between batches (adjust based on API limits)
    };
    
    const pipeline = new FashionDataPipelineFast(options);
    await pipeline.run();
    
    logger.info('✅ Fast pipeline completed successfully!');
    
  } catch (error) {
    logger.error(`❌ Pipeline failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main(); 