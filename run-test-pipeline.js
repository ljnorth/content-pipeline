import { FashionDataPipeline } from './src/content/pipelines/index.js';

async function runPipeline() {
  try {
    console.log('🚀 Starting abbreviated pipeline test...');
    const pipeline = new FashionDataPipeline();
    await pipeline.run();
    console.log('✅ Pipeline completed successfully!');
  } catch (error) {
    console.error('❌ Pipeline failed:', error.message);
    console.error(error.stack);
  }
}

runPipeline(); 