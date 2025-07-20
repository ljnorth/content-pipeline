import { InputProcessor } from '../stages/input-processor.js';
import { AccountProcessor } from '../stages/account-processor.js';
import { ContentAcquirer } from '../stages/content-acquirer.js';
import { ImageProcessor } from '../stages/image-processor.js';
import { AIAnalyzer } from '../stages/ai-analyzer.js';
import { HookSlideAnalyzerBatch } from '../stages/hook-slide-analyzer-batch.js';
import { BackgroundColorAnalyzer } from '../stages/background-color-analyzer.js';
import { DatabaseStorage } from '../stages/database-storage.js';
import { HookSlideStorage } from '../stages/hook-slide-storage.js';
import { BackgroundColorStorage } from '../stages/background-color-storage.js';
import { Logger } from '../utils/logger.js';

export class FashionDataPipelineEnhanced {
  constructor() {
    this.logger = new Logger();
    this.inputProcessor = new InputProcessor();
    this.accountProcessor = new AccountProcessor();
    this.contentAcquirer = new ContentAcquirer();
    this.imageProcessor = new ImageProcessor();
    this.aiAnalyzer = new AIAnalyzer();
    this.hookSlideAnalyzer = new HookSlideAnalyzerBatch();
    this.backgroundColorAnalyzer = new BackgroundColorAnalyzer();
    this.databaseStorage = new DatabaseStorage();
    this.hookSlideStorage = new HookSlideStorage();
    this.backgroundColorStorage = new BackgroundColorStorage();
  }

  async run() {
    this.logger.info('🚀 Starting Enhanced Fashion Data Pipeline with Hook Slide Detection');
    
    // Stage 1: Input & Configuration
    this.logger.info('📋 Stage 1: Processing input configuration...');
    const accounts = await this.inputProcessor.process();

    // Stage 2: Account Processing
    this.logger.info('👥 Stage 2: Processing accounts and determining scraping strategy...');
    const accountTasks = await this.accountProcessor.process(accounts);

    // Stage 3: Content Acquisition
    this.logger.info('📥 Stage 3: Acquiring content from social media...');
    const posts = await this.contentAcquirer.process(accountTasks);

    // Stage 4: Image Extraction
    this.logger.info('🖼️ Stage 4: Extracting and processing images...');
    const images = await this.imageProcessor.process(posts);

    // Stage 5: AI Analysis (Regular fashion analysis)
    this.logger.info('🎯 Stage 5: Running AI analysis for fashion attributes...');
    const analyzed = await this.aiAnalyzer.process(images);

    // Stage 6: Hook Slide Detection (NEW!) - BATCH MODE for 50% savings
    this.logger.info('✨ Stage 6: Detecting hook slides and content themes (BATCH mode - 50% cost savings)...');
    const hookSlides = await this.hookSlideAnalyzer.process(images);

    // Stage 7: Background Color Analysis (NEW!)
    this.logger.info('🎨 Stage 7: Analyzing background colors for uniform generation...');
    const colorAnalysis = await this.backgroundColorAnalyzer.process(images);

    // Stage 8: Database Storage (Regular content)
    this.logger.info('💾 Stage 8: Storing analyzed content to database...');
    await this.databaseStorage.process(analyzed);

    // Stage 9: Hook Slide Storage (NEW!)
    this.logger.info('💎 Stage 9: Storing hook slides and themes...');
    const hookStats = await this.hookSlideStorage.process(hookSlides);

    // Stage 10: Background Color Storage (NEW!)
    this.logger.info('🎨 Stage 10: Storing background color analysis...');
    const colorStats = await this.backgroundColorStorage.process(colorAnalysis);

    // Final Summary
    this.logger.info('🎉 ENHANCED PIPELINE COMPLETE!');
    this.logger.info('📊 SUMMARY STATISTICS:');
    this.logger.info(`   👥 Accounts processed: ${accounts.length}`);
    this.logger.info(`   📄 Posts processed: ${posts.length}`);
    this.logger.info(`   🖼️ Images analyzed: ${images.length}`);
    this.logger.info(`   ✨ Hook slides found: ${hookStats.stored}`);
    this.logger.info(`   🎨 Images with background analysis: ${colorStats.updated}`);
    this.logger.info(`   💰 AI Analysis cost: $${this.aiAnalyzer.totalCost.toFixed(4)}`);
    this.logger.info(`   💰 Hook detection cost: $${this.hookSlideAnalyzer.totalCost.toFixed(4)} (BATCH mode)`);
    this.logger.info(`   💰 Color analysis cost: $${this.backgroundColorAnalyzer.totalCost.toFixed(4)}`);
    this.logger.info(`   💰 Total cost: $${(this.aiAnalyzer.totalCost + this.hookSlideAnalyzer.totalCost + this.backgroundColorAnalyzer.totalCost).toFixed(4)}`);
    
    // Show batch savings for hook slide detection
    const hookSavings = this.hookSlideAnalyzer.totalCost; // What we paid
    const hookRegularCost = hookSavings * 2; // What we would have paid
    this.logger.info(`   💰 Hook detection batch savings: $${(hookRegularCost - hookSavings).toFixed(4)} (50% off individual calls)`);
    
    // Show hook slide discovery insights
    if (hookStats.stored > 0) {
      this.logger.info('🎯 HOOK SLIDE INSIGHTS:');
      this.logger.info(`   📈 Discovery rate: ${((hookStats.stored / images.length) * 100).toFixed(1)}%`);
      this.logger.info(`   💡 These can now be used for theme-based content generation!`);
      
      // Get available themes for user
      try {
        const themes = await this.hookSlideStorage.getAvailableThemes();
        if (themes.length > 0) {
          this.logger.info('🎨 DISCOVERED THEMES:');
          themes.slice(0, 5).forEach(theme => {
            this.logger.info(`   • ${theme.theme} (${theme.target_vibe}) - ${theme.count} slides`);
          });
          if (themes.length > 5) {
            this.logger.info(`   ... and ${themes.length - 5} more themes`);
          }
        }
      } catch (err) {
        this.logger.warn(`⚠️ Could not retrieve theme summary: ${err.message}`);
      }
    }

    return {
      accounts: accounts.length,
      posts: posts.length,
      images: images.length,
      hookSlides: hookStats.stored,
      backgroundAnalyzed: colorStats.updated,
      totalCost: this.aiAnalyzer.totalCost + this.hookSlideAnalyzer.totalCost + this.backgroundColorAnalyzer.totalCost
    };
  }

  // Run hook slide detection only on existing images
  async runHookSlideDetectionOnly() {
    this.logger.info('✨ Running BATCH Hook Slide Detection on existing images (50% cost savings)...');
    
    try {
      // Get all images from database that haven't been checked for hook slides
      // First get all post_ids that already have hook slides
      const { data: existingHookSlides } = await this.hookSlideStorage.db.client
        .from('hook_slides')
        .select('post_id');
      
      const existingPostIds = existingHookSlides?.map(slide => slide.post_id) || [];
      
      // Then get images that are NOT in that list
      let imageQuery = this.hookSlideStorage.db.client
        .from('images')
        .select('*');
      
      if (existingPostIds.length > 0) {
        imageQuery = imageQuery.not('post_id', 'in', `(${existingPostIds.map(id => `'${id}'`).join(',')})`);
      }
      
      const { data: images, error } = await imageQuery;

      if (error) {
        throw new Error(`Failed to fetch images: ${error.message}`);
      }

      if (!images || images.length === 0) {
        this.logger.info('✅ No new images to check for hook slides');
        return { processed: 0, found: 0 };
      }

      this.logger.info(`🔍 Found ${images.length} images to check for hook slides`);

      // Convert database images to format expected by hook slide analyzer
      const imageItems = images.map(img => ({
        postId: img.post_id,
        imagePath: img.image_path,
        metadata: {
          username: img.username,
          post_id: img.post_id,
          image_path: img.image_path
        }
      }));

      // Run hook slide detection
      const hookSlides = await this.hookSlideAnalyzer.process(imageItems);

      // Store found hook slides
      const hookStats = await this.hookSlideStorage.process(hookSlides);

      this.logger.info('✨ BATCH Hook slide detection complete!');
      this.logger.info(`   📊 Images processed: ${images.length}`);
      this.logger.info(`   ✨ Hook slides found: ${hookStats.stored}`);
      this.logger.info(`   💰 Detection cost: $${this.hookSlideAnalyzer.totalCost.toFixed(4)} (BATCH mode)`);
      
      // Show batch savings
      const regularCost = this.hookSlideAnalyzer.totalCost * 2;
      this.logger.info(`   💰 Batch savings: $${(regularCost - this.hookSlideAnalyzer.totalCost).toFixed(4)} (50% off individual calls)`);

      return {
        processed: images.length,
        found: hookStats.stored,
        cost: this.hookSlideAnalyzer.totalCost
      };

    } catch (error) {
      this.logger.error(`❌ Hook slide detection failed: ${error.message}`);
      throw error;
    }
  }
} 