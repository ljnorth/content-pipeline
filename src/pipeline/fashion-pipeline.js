import { InputProcessor } from '../stages/input-processor.js';
import { AccountProcessor } from '../stages/account-processor.js';
import { ContentAcquirer } from '../stages/content-acquirer.js';
import { ImageProcessor } from '../stages/image-processor.js';
import { AIAnalyzer } from '../stages/ai-analyzer.js';
import { DatabaseStorage } from '../stages/database-storage.js';
import { Logger } from '../utils/logger.js';

export class FashionDataPipeline {
  constructor() {
    this.logger = new Logger();
    this.inputProcessor = new InputProcessor();
    this.accountProcessor = new AccountProcessor();
    this.contentAcquirer = new ContentAcquirer();
    this.imageProcessor = new ImageProcessor();
    this.aiAnalyzer = new AIAnalyzer();
    this.databaseStorage = new DatabaseStorage();
  }

  async run() {
    // Stage 1: Input & Configuration
    const accounts = await this.inputProcessor.process();

    // Stage 2: Account Processing
    const accountTasks = await this.accountProcessor.process(accounts);

    // Stage 3: Content Acquisition
    const posts = await this.contentAcquirer.process(accountTasks);

    // Stage 4: Image Extraction
    const images = await this.imageProcessor.process(posts);

    // Stage 5: AI Analysis
    const analyzed = await this.aiAnalyzer.process(images);

    // Stage 6: Database Storage
    await this.databaseStorage.process(analyzed);
  }
} 