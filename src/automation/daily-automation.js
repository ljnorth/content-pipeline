import dotenv from 'dotenv';
import { ContentGenerator } from './content-generator.js';
import { TikTokAPI } from './tiktok-api.js';
import { Logger } from '../utils/logger.js';
import { SupabaseClient } from '../database/supabase-client.js';

// Load environment variables
dotenv.config();

export class DailyAutomation {
  constructor() {
    this.logger = new Logger();
    this.contentGenerator = new ContentGenerator();
    this.tiktokAPI = new TikTokAPI();
    this.db = new SupabaseClient();
  }

  /**
   * Run the complete daily automation process
   */
  async runDailyAutomation() {
    this.logger.info('🚀 STARTING DAILY TIKTOK AUTOMATION');
    this.logger.info('🎯 Goal: Generate 3 posts (5 images each) for all active accounts');
    
    const startTime = Date.now();
    
    try {
      // Log automation start
      const automationId = await this.logAutomationStart();
      
      // Step 1: Generate content for all accounts
      this.logger.info('📝 STEP 1: Generating content...');
      const generatedContent = await this.contentGenerator.generateDailyContent();
      
      await this.logAutomationStep(automationId, 'content_generation', generatedContent);
      
      // Step 2: Upload to TikTok drafts
      this.logger.info('📤 STEP 2: Uploading to TikTok drafts...');
      const uploadResults = await this.tiktokAPI.uploadPostsToDrafts(generatedContent);
      
      await this.logAutomationStep(automationId, 'tiktok_upload', uploadResults);
      
      // Step 3: Generate summary report
      const summary = this.generateSummary(generatedContent, uploadResults);
      
      // Step 4: Complete automation log
      await this.logAutomationComplete(automationId, summary);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.info(`🎉 DAILY AUTOMATION COMPLETE! (${duration}s)`);
      this.logSummary(summary);
      
      return {
        success: true,
        automationId,
        duration: duration + 's',
        summary
      };
      
    } catch (error) {
      this.logger.error(`❌ AUTOMATION FAILED: ${error.message}`);
      
      // Log automation failure
      await this.logAutomationError(error);
      
      throw error;
    }
  }

  /**
   * Generate automation summary
   */
  generateSummary(generatedContent, uploadResults) {
    const accounts = new Set();
    let totalPosts = 0;
    let totalImages = 0;
    let successfulUploads = 0;
    let failedUploads = 0;

    // Count content generation results
    if (generatedContent?.results) {
      for (const result of generatedContent.results) {
        accounts.add(result.account);
        if (result.success && result.posts) {
          totalPosts += result.posts.length;
          result.posts.forEach(post => {
            totalImages += post.images?.length || 0;
          });
        }
      }
    }

    // Count upload results
    if (uploadResults) {
      for (const result of uploadResults) {
        if (result.success && result.uploads) {
          successfulUploads += result.uploads.filter(u => u.success).length;
          failedUploads += result.uploads.filter(u => !u.success).length;
        }
      }
    }

    return {
      accountsProcessed: accounts.size,
      postsGenerated: totalPosts,
      imagesUsed: totalImages,
      uploadsSuccessful: successfulUploads,
      uploadsFailed: failedUploads,
      expectedPostsPerAccount: 3,
      expectedImagesPerPost: 5,
      completionRate: accounts.size > 0 ? (successfulUploads / (accounts.size * 3)) * 100 : 0
    };
  }

  /**
   * Log summary to console
   */
  logSummary(summary) {
    this.logger.info('📊 AUTOMATION SUMMARY:');
    this.logger.info(`   👥 Accounts processed: ${summary.accountsProcessed}`);
    this.logger.info(`   📝 Posts generated: ${summary.postsGenerated}`);
    this.logger.info(`   🖼️  Images used: ${summary.imagesUsed}`);
    this.logger.info(`   ✅ Successful uploads: ${summary.uploadsSuccessful}`);
    this.logger.info(`   ❌ Failed uploads: ${summary.uploadsFailed}`);
    this.logger.info(`   📈 Completion rate: ${summary.completionRate.toFixed(1)}%`);
    
    if (summary.completionRate === 100) {
      this.logger.info('🎯 PERFECT RUN! All content generated and uploaded successfully!');
    } else if (summary.completionRate >= 80) {
      this.logger.info('✨ GREAT RUN! Most content was processed successfully!');
    } else if (summary.completionRate >= 50) {
      this.logger.info('⚠️  PARTIAL SUCCESS. Some issues occurred but automation partially worked.');
    } else {
      this.logger.info('🚨 POOR RUN. Significant issues occurred during automation.');
    }
  }

  /**
   * Log automation start to database
   */
  async logAutomationStart() {
    try {
      const { data, error } = await this.db.client
        .from('automation_runs')
        .insert({
          type: 'daily_content_generation',
          status: 'running',
          started_at: new Date().toISOString(),
          metadata: {
            goal: '3 posts per account, 5 images per post',
            automation_version: '1.0.0'
          }
        })
        .select('id')
        .single();

      if (error) {
        this.logger.error(`Failed to log automation start: ${error.message}`);
        return null;
      }

      return data.id;
    } catch (error) {
      this.logger.error(`Failed to log automation start: ${error.message}`);
      return null;
    }
  }

  /**
   * Log automation step
   */
  async logAutomationStep(automationId, step, result) {
    if (!automationId) return;

    try {
      await this.db.client
        .from('automation_logs')
        .insert({
          automation_id: automationId,
          step,
          status: result?.success ? 'completed' : 'failed',
          result_data: result,
          logged_at: new Date().toISOString()
        });
    } catch (error) {
      this.logger.error(`Failed to log automation step: ${error.message}`);
    }
  }

  /**
   * Log automation completion
   */
  async logAutomationComplete(automationId, summary) {
    if (!automationId) return;

    try {
      await this.db.client
        .from('automation_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          summary
        })
        .eq('id', automationId);
    } catch (error) {
      this.logger.error(`Failed to log automation completion: ${error.message}`);
    }
  }

  /**
   * Log automation error
   */
  async logAutomationError(error) {
    try {
      await this.db.client
        .from('automation_runs')
        .insert({
          type: 'daily_content_generation',
          status: 'failed',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          error_message: error.message,
          metadata: {
            error_stack: error.stack
          }
        });
    } catch (logError) {
      this.logger.error(`Failed to log automation error: ${logError.message}`);
    }
  }

  /**
   * Test mode - generate content for specific accounts
   */
  async testAutomation(accountUsernames = null) {
    this.logger.info('🧪 RUNNING AUTOMATION IN TEST MODE');
    
    if (accountUsernames && accountUsernames.length > 0) {
      this.logger.info(`🎯 Testing with specific accounts: ${accountUsernames.join(', ')}`);
    }
    
    return await this.runDailyAutomation();
  }

  /**
   * Check if automation should run (based on schedule)
   */
  async shouldRunAutomation() {
    try {
      // Check if automation already ran today
      const today = new Date().toISOString().split('T')[0];
      const { data: todaysRuns, error } = await this.db.client
        .from('automation_runs')
        .select('id, status')
        .eq('type', 'daily_content_generation')
        .gte('started_at', today + 'T00:00:00Z')
        .eq('status', 'completed');

      if (error) {
        this.logger.error(`Failed to check today's runs: ${error.message}`);
        return true; // Default to running if we can't check
      }

      if (todaysRuns && todaysRuns.length > 0) {
        this.logger.info('ℹ️ Daily automation already completed today');
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to check automation schedule: ${error.message}`);
      return true; // Default to running if we can't check
    }
  }
}

// Run automation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const automation = new DailyAutomation();
  
  // Check if this is a test run
  const isTest = process.argv.includes('--test');
  const accountArgs = process.argv.find(arg => arg.startsWith('--accounts='));
  const testAccounts = accountArgs ? accountArgs.split('=')[1].split(',') : null;
  
  if (isTest) {
    automation.testAutomation(testAccounts)
      .then(() => process.exit(0))
      .catch(error => {
        console.error('Automation failed:', error.message);
        process.exit(1);
      });
  } else {
    automation.shouldRunAutomation()
      .then(shouldRun => {
        if (shouldRun) {
          return automation.runDailyAutomation();
        } else {
          console.log('Skipping automation - already completed today');
          process.exit(0);
        }
      })
      .then(() => process.exit(0))
      .catch(error => {
        console.error('Automation failed:', error.message);
        process.exit(1);
      });
  }
} 