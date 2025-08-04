import { InputProcessor } from '../../stages/input-processor.js';
import { AccountProcessor } from '../../stages/account-processor.js';
import { ContentAcquirer } from '../../stages/content-acquirer.js';
import { ImageProcessor } from '../../stages/image-processor.js';
import { AIAnalyzer } from '../../stages/ai-analyzer.js';
import { HookSlideAnalyzer } from '../../stages/hook-slide-analyzer.js';
import { HookSlideAnalyzerBatch } from '../../stages/hook-slide-analyzer-batch.js';
import { BackgroundColorAnalyzer } from '../../stages/background-color-analyzer.js';
import { DatabaseStorage } from '../../stages/database-storage.js';
import { HookSlideStorage } from '../../stages/hook-slide-storage.js';
import { BackgroundColorStorage } from '../../stages/background-color-storage.js';
import { Logger } from '../../utils/logger.js';

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
  async runHookSlideDetectionOnly(limit) {
    this.logger.info('✨ Running Hook Slide Detection (normal API, not batch)...');
    try {
      // Get all images from database that haven't been checked for hook slides
      // Check for images where is_cover_slide is null (not yet processed)
      let imageQuery = this.databaseStorage.db.client
        .from('images')
        .select('*')
        .is('is_cover_slide', null);
        
      if (limit) {
        imageQuery = imageQuery.limit(limit);
      }
      const { data: images, error } = await imageQuery;
      if (error) {
        this.logger.error(`❌ Database error fetching images: ${error.message}`);
        throw error;
      }
      if (!images || images.length === 0) {
        this.logger.info('✅ No new images to process for hook slides');
        return { processed: 0, hookSlides: 0, cost: 0 };
      }
      
      // Get batch size from environment or default to 5
      const batchSize = parseInt(process.env.BATCH_SIZE, 10) || 5;
      const totalImages = images.length;
      const totalBatches = Math.ceil(totalImages / batchSize);
      
      // Cost calculation (approximate)
      const costPerImage = 0.00765; // gpt-4o-mini vision cost per image
      const projectedCost = totalImages * costPerImage;
      
      this.logger.info(`📊 Processing ${totalImages} images in ${totalBatches} batches of ${batchSize}`);
      this.logger.info(`💰 Projected cost: $${projectedCost.toFixed(4)}`);
      
      let totalProcessed = 0;
      let totalHookSlides = 0;
      let totalCost = 0;
      const startTime = Date.now();
      
      // Process images in batches
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batchStart = batchIndex * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, totalImages);
        const batch = images.slice(batchStart, batchEnd);
        
        this.logger.info(`🔄 Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} images)...`);
        
        // Process batch with HookSlideAnalyzer (normal API)
        const analyzer = new HookSlideAnalyzer();
        const batchResults = await analyzer.process(batch.map(img => ({
          imageId: img.id,
          postId: img.post_id,
          imagePath: img.image_path
        })));
        
        // Store results in images table (not separate hook_slides table)
        for (const result of batchResults) {
          try {
            // Update the specific image by its unique ID
            const { data, error: updateError } = await this.databaseStorage.db.client
              .from('images')
              .update({
                is_cover_slide: result.is_hook_slide,
                cover_slide_text: result.text_detected
              })
              .eq('id', result.imageId)
              .select('id, post_id, is_cover_slide, cover_slide_text');
              
            if (updateError) {
              this.logger.error(`❌ Failed to update image ${result.imageId}: ${updateError.message}`);
              this.logger.error(`Full error details:`, updateError);
            } else if (data && data.length > 0) {
              if (result.is_hook_slide) {
                totalHookSlides++;
                this.logger.info(`✅ Hook slide stored: ${result.imageId} (post ${result.postId}) - "${result.text_detected}"`);
              } else {
                this.logger.info(`✅ Not hook slide stored: ${result.imageId} (post ${result.postId})`);
              }
            } else {
              this.logger.error(`❌ No rows updated for image_id: ${result.imageId} (might not exist)`);
            }
          } catch (err) {
            this.logger.error(`❌ Exception updating image ${result.imageId}: ${err.message}`);
            this.logger.error(`Full exception:`, err);
          }
        }
        
        totalProcessed += batch.length;
        totalCost += batch.length * costPerImage;
        
        // Calculate progress and time estimates
        const elapsedTime = (Date.now() - startTime) / 1000; // seconds
        const avgTimePerImage = elapsedTime / totalProcessed;
        const remainingImages = totalImages - totalProcessed;
        const estimatedTimeRemaining = remainingImages * avgTimePerImage;
        
        this.logger.info(`📈 Progress: ${totalProcessed}/${totalImages} (${Math.round((totalProcessed/totalImages)*100)}%)`);
        this.logger.info(`⏱️  Estimated time remaining: ${Math.round(estimatedTimeRemaining/60)} minutes`);
        this.logger.info(`💰 Cost so far: $${totalCost.toFixed(4)} / $${projectedCost.toFixed(4)}`);
        this.logger.info(`🎯 Hook slides found so far: ${totalHookSlides}`);
        
        // Small delay between batches to avoid rate limits
        if (batchIndex < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      const totalTime = (Date.now() - startTime) / 1000;
      this.logger.info(`🎉 Hook slide detection completed!`);
      this.logger.info(`   📊 Images processed: ${totalProcessed}`);
      this.logger.info(`   🎯 Hook slides found: ${totalHookSlides}`);
      this.logger.info(`   ⏱️  Total time: ${Math.round(totalTime/60)} minutes`);
      this.logger.info(`   💰 Total cost: $${totalCost.toFixed(4)}`);
      
      return {
        processed: totalProcessed,
        hookSlides: totalHookSlides,
        cost: totalCost,
        timeSeconds: totalTime
      };
      
    } catch (error) {
      this.logger.error(`❌ Error in hook slide detection: ${error.message}`);
      throw error;
    }
  }
} 