// Main entry point for the Content Pipeline
import { SupabaseClient } from './database/supabase-client.js';
import { Logger } from './utils/logger.js';

// Import content generation modules
import { 
  FashionDataPipeline as DefaultPipeline,
  FashionDataPipelineBatch as BatchPipeline,
  FashionDataPipelineFast as FastPipeline,
  FashionDataPipelineEnhanced as EnhancedPipeline
} from './content/index.js';

// Import Slack integration
import { SlackAPI, EnhancedSlackAPI } from './slack/index.js';

// Import analytics modules
import { AestheticsAnalytics, DatabaseAnalytics } from './analytics/index.js';

// Main Content Pipeline class
export class ContentPipeline {
  constructor(options = {}) {
    this.logger = new Logger();
    this.db = new SupabaseClient();
    this.slack = new SlackAPI();
    this.enhancedSlack = new EnhancedSlackAPI();
    
    // Initialize analytics
    this.aestheticsAnalytics = new AestheticsAnalytics();
    this.databaseAnalytics = new DatabaseAnalytics();
    
    // Pipeline options
    this.options = {
      pipelineType: options.pipelineType || 'default', // default, batch, fast, enhanced
      enableSlack: options.enableSlack !== false,
      enableAnalytics: options.enableAnalytics !== false,
      ...options
    };
    
    this.logger.info('🚀 Content Pipeline initialized');
  }

  // Get the appropriate pipeline based on type
  getPipeline() {
    switch (this.options.pipelineType) {
      case 'batch':
        return new BatchPipeline();
      case 'fast':
        return new FastPipeline();
      case 'enhanced':
        return new EnhancedPipeline();
      default:
        return new DefaultPipeline();
    }
  }

  // Run the complete pipeline
  async run() {
    try {
      this.logger.info('🎯 Starting Content Pipeline...');
      
      // Get the pipeline
      const pipeline = this.getPipeline();
      
      // Run content generation
      const result = await pipeline.run();
      
      // Send to Slack if enabled
      if (this.options.enableSlack && this.slack.enabled) {
        this.logger.info('📤 Sending results to Slack...');
        await this.slack.sendPostsToSlack(result);
      }
      
      // Run analytics if enabled
      if (this.options.enableAnalytics) {
        this.logger.info('📊 Running analytics...');
        await this.runAnalytics();
      }
      
      this.logger.info('✅ Content Pipeline completed successfully');
      return result;
      
    } catch (error) {
      this.logger.error(`❌ Pipeline failed: ${error.message}`);
      throw error;
    }
  }

  // Run analytics
  async runAnalytics() {
    try {
      // Get database stats
      const dbStats = await this.databaseAnalytics.getDatabaseStats();
      this.logger.info('📊 Database Statistics:', dbStats);
      
      // Analyze aesthetics
      const aestheticStats = await this.aestheticsAnalytics.analyzeAesthetics();
      this.logger.info('🎨 Aesthetic Analysis completed');
      
      return { dbStats, aestheticStats };
    } catch (error) {
      this.logger.error(`❌ Analytics failed: ${error.message}`);
    }
  }

  // Quick methods for common operations
  async generateContent(pipelineType = 'default') {
    const pipeline = this.getPipeline();
    return await pipeline.run();
  }

  async sendToSlack(content) {
    return await this.slack.sendPostsToSlack(content);
  }

  async getDatabaseStats() {
    return await this.databaseAnalytics.getDatabaseStats();
  }

  async analyzeAesthetics() {
    return await this.aestheticsAnalytics.analyzeAesthetics();
  }
}

// Export individual modules for direct use
export { 
  DefaultPipeline, 
  BatchPipeline, 
  FastPipeline, 
  EnhancedPipeline 
} from './content/index.js';

export { SlackAPI, EnhancedSlackAPI } from './slack/index.js';
export { AestheticsAnalytics, DatabaseAnalytics } from './analytics/index.js';
export { SupabaseClient } from './database/supabase-client.js';
export { Logger } from './utils/logger.js';

// Default export
export default ContentPipeline; 