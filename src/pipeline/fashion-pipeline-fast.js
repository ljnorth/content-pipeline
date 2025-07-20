import { InputProcessor } from '../stages/input-processor.js';
import { AccountProcessor } from '../stages/account-processor.js';
import { ContentAcquirer } from '../stages/content-acquirer.js';
import { ImageProcessor } from '../stages/image-processor.js';
import { AIAnalyzerConcurrent } from '../stages/ai-analyzer-concurrent.js';
import { DatabaseStorage } from '../stages/database-storage.js';
import { Logger } from '../utils/logger.js';

export class FashionDataPipelineFast {
  constructor(options = {}) {
    this.logger = new Logger();
    this.inputProcessor = new InputProcessor();
    this.accountProcessor = new AccountProcessor();
    this.contentAcquirer = new ContentAcquirer();
    this.imageProcessor = new ImageProcessor();
    this.aiAnalyzer = new AIAnalyzerConcurrent({
      concurrency: options.concurrency || 10,
      rateLimitDelay: options.rateLimitDelay || 100
    });
    this.databaseStorage = new DatabaseStorage();
  }

  async run() {
    this.logger.info('⚡ Starting Fashion Data Pipeline with CONCURRENT processing');
    this.logger.info('🚀 Real-time results with 10x faster processing');
    
    // Stage 1: Input & Configuration
    const accounts = await this.inputProcessor.process();

    // Stage 2: Account Processing
    const accountTasks = await this.accountProcessor.process(accounts);

    // Stage 3: Content Acquisition
    const posts = await this.contentAcquirer.process(accountTasks);

    // Stage 4: Image Extraction
    const images = await this.imageProcessor.process(posts);

    // Stage 5: AI Analysis (CONCURRENT MODE)
    this.logger.info('⚡ Entering CONCURRENT AI Analysis phase...');
    const analyzed = await this.aiAnalyzer.process(images);

    // Stage 6: Database Storage
    await this.databaseStorage.process(analyzed);
    
    // Final cost summary
    const costSummary = this.aiAnalyzer.getCostSummary();
    this.logger.info('⚡ FINAL CONCURRENT PROCESSING SUMMARY:');
    this.logger.info(`   Images processed: ${costSummary.processedCount}`);
    this.logger.info(`   Total cost: $${costSummary.totalCost.toFixed(4)}`);
    this.logger.info(`   Cost per image: $${costSummary.averageCostPerImage.toFixed(6)}`);
    this.logger.info(`   Total tokens: ${costSummary.totalTokens}`);
    this.logger.info(`   Concurrency level: ${costSummary.concurrencyLevel}x faster`);
    this.logger.info(`   Processing time: Real-time (immediate results)`);
  }
} 