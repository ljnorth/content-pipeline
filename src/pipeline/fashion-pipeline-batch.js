import { InputProcessor } from '../stages/input-processor.js';
import { AccountProcessor } from '../stages/account-processor.js';
import { ContentAcquirer } from '../stages/content-acquirer.js';
import { ImageProcessor } from '../stages/image-processor.js';
import { AIAnalyzerBatch } from '../stages/ai-analyzer-batch.js';
import { DatabaseStorage } from '../stages/database-storage.js';
import { Logger } from '../utils/logger.js';

export class FashionDataPipelineBatch {
  constructor() {
    this.logger = new Logger();
    this.inputProcessor = new InputProcessor();
    this.accountProcessor = new AccountProcessor();
    this.contentAcquirer = new ContentAcquirer();
    this.imageProcessor = new ImageProcessor();
    this.aiAnalyzer = new AIAnalyzerBatch(); // Using batch analyzer
    this.databaseStorage = new DatabaseStorage();
  }

  async run() {
    this.logger.info('🚀 Starting Fashion Data Pipeline with BATCH processing');
    this.logger.info('💰 Expected 50% cost savings vs individual API calls');
    
    // Stage 1: Input & Configuration
    const accounts = await this.inputProcessor.process();

    // Stage 2: Account Processing
    const accountTasks = await this.accountProcessor.process(accounts);

    // Stage 3: Content Acquisition
    const posts = await this.contentAcquirer.process(accountTasks);

    // Stage 4: Image Extraction
    const images = await this.imageProcessor.process(posts);

    // Stage 5: AI Analysis (BATCH MODE)
    this.logger.info('🔄 Entering BATCH AI Analysis phase...');
    const analyzed = await this.aiAnalyzer.process(images);

    // Stage 6: Database Storage
    await this.databaseStorage.process(analyzed);
    
    // Final cost summary
    const costSummary = this.aiAnalyzer.getCostSummary();
    this.logger.info('💰 FINAL BATCH COST SUMMARY:');
    this.logger.info(`   Images processed: ${costSummary.processedCount}`);
    this.logger.info(`   Total cost: $${costSummary.totalCost.toFixed(4)}`);
    this.logger.info(`   Cost per image: $${costSummary.averageCostPerImage.toFixed(6)}`);
    this.logger.info(`   Total tokens: ${costSummary.totalTokens}`);
    this.logger.info(`   Regular API would cost: $${costSummary.regularCostWouldBe.toFixed(4)}`);
    this.logger.info(`   BATCH SAVINGS: $${costSummary.batchSavings.toFixed(4)} (50% off!)`);
  }
} 