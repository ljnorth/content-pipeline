#!/usr/bin/env node

/**
 * Daily MVP Content Automation
 * 
 * This script generates 3 posts per day for ALL your accounts and sends them to Slack.
 * Perfect for daily automation - set it up as a cron job or scheduled task.
 * 
 * Features:
 * - Runs MVP generation for all active accounts
 * - Graceful error handling (continues with other accounts if one fails)
 * - Detailed logging and reporting
 * - Slack delivery for easy review
 * - Cost tracking across all accounts
 * 
 * Usage:
 *   node run-daily-mvp-automation.js [options]
 */

import { config } from 'dotenv';
config();

import { MVPSmartContentGenerator } from './src/stages/mvp-smart-content-generator.js';
import { SupabaseClient } from './src/database/supabase-client.js';
import { Logger } from './src/utils/logger.js';

const logger = new Logger();

async function main() {
  logger.info('🌅 Starting Daily MVP Content Automation');
  logger.info('📅 Generating 3 posts per account for Slack delivery');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    postCount: 3,
    imageCount: 5,
    enableSlackUpload: true,
    targetAccounts: [], // Empty = all accounts
    dryRun: false
  };
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      console.log(`
🌅 Daily MVP Content Automation

Generates 3 posts per day for ALL your accounts and sends to Slack.
Perfect for daily automation!

Usage: node run-daily-mvp-automation.js [options]

Options:
  --posts 3              Posts per account (default: 3)
  --images 5             Images per post (default: 5)
  --accounts user1,user2 Only run for specific accounts (default: all)
  --no-slack             Skip Slack upload
  --dry-run              Show what would happen without generating
  --help, -h             Show this help message

Examples:
  node run-daily-mvp-automation.js
  node run-daily-mvp-automation.js --accounts fashionista_lj,style_queen
  node run-daily-mvp-automation.js --posts 5 --no-slack
  node run-daily-mvp-automation.js --dry-run

Cron Job Setup (daily at 9 AM):
  0 9 * * * cd /path/to/project && node run-daily-mvp-automation.js

Environment Variables:
  SUPABASE_URL=your_supabase_url
  SUPABASE_ANON_KEY=your_supabase_key
  OPENAI_API_KEY=your_openai_key
  SLACK_*=your_slack_credentials (optional)
      `);
      process.exit(0);
    } else if (arg === '--posts' && i + 1 < args.length) {
      options.postCount = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--images' && i + 1 < args.length) {
      options.imageCount = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--accounts' && i + 1 < args.length) {
      options.targetAccounts = args[i + 1].split(',').map(s => s.trim());
      i++;
    } else if (arg === '--no-slack') {
      options.enableSlackUpload = false;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }
  
  logger.info(`📋 Configuration:`);
  logger.info(`   📝 Posts per account: ${options.postCount}`);
  logger.info(`   🖼️ Images per post: ${options.imageCount}`);
  logger.info(`   📤 Slack upload: ${options.enableSlackUpload ? 'Enabled' : 'Disabled'}`);
  logger.info(`   🎯 Target accounts: ${options.targetAccounts.length > 0 ? options.targetAccounts.join(', ') : 'All accounts'}`);
  logger.info(`   🧪 Dry run: ${options.dryRun ? 'Yes' : 'No'}`);
  
  try {
    // Get list of accounts to process
    const accounts = await getAccountsToProcess(options.targetAccounts);
    
    if (accounts.length === 0) {
      logger.warn('⚠️ No accounts found to process');
      process.exit(0);
    }
    
    logger.info(`👥 Found ${accounts.length} accounts to process: ${accounts.join(', ')}`);
    
    if (options.dryRun) {
      logger.info('🧪 DRY RUN - No content will be generated');
      logger.info(`📊 Would generate: ${accounts.length * options.postCount} total posts`);
      logger.info(`💰 Estimated cost: $${(accounts.length * options.postCount * 0.01).toFixed(3)}`);
      process.exit(0);
    }
    
    // Initialize generator
    const generator = new MVPSmartContentGenerator();
    
    // Process each account
    const results = [];
    let totalCost = 0;
    let totalPosts = 0;
    let successfulAccounts = 0;
    let failedAccounts = 0;
    
    logger.info('🚀 Starting content generation for all accounts...');
    
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      logger.info(`📝 Processing account ${i + 1}/${accounts.length}: @${account}`);
      
      try {
        const result = await generator.generateMVPContent(account, {
          postCount: options.postCount,
          imageCount: options.imageCount,
          enableSlackUpload: options.enableSlackUpload
        });
        
        if (result.success) {
          results.push({
            account,
            success: true,
            posts: result.posts,
            summary: result.summary
          });
          
          totalCost += result.summary.totalCost;
          totalPosts += result.posts.length;
          successfulAccounts++;
          
          logger.info(`✅ @${account}: ${result.posts.length} posts generated, $${result.summary.totalCost.toFixed(4)} cost`);
        } else {
          results.push({
            account,
            success: false,
            error: 'Generation failed'
          });
          failedAccounts++;
          logger.error(`❌ @${account}: Generation failed`);
        }
        
      } catch (error) {
        results.push({
          account,
          success: false,
          error: error.message
        });
        failedAccounts++;
        logger.error(`❌ @${account}: ${error.message}`);
      }
      
      // Small delay between accounts to avoid rate limits
      if (i < accounts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Generate daily summary report
    await generateDailySummaryReport(results, {
      totalAccounts: accounts.length,
      successfulAccounts,
      failedAccounts,
      totalPosts,
      totalCost,
      options
    });
    
    logger.info('🎉 Daily MVP Content Automation Complete!');
    logger.info('');
    logger.info('📊 DAILY SUMMARY:');
    logger.info(`   👥 Accounts processed: ${accounts.length}`);
    logger.info(`   ✅ Successful: ${successfulAccounts}`);
    logger.info(`   ❌ Failed: ${failedAccounts}`);
    logger.info(`   📝 Total posts generated: ${totalPosts}`);
    logger.info(`   💰 Total cost: $${totalCost.toFixed(4)}`);
    logger.info(`   📤 Slack delivery: ${options.enableSlackUpload ? '✅ Attempted' : '❌ Disabled'}`);
    
    // Show failed accounts if any
    if (failedAccounts > 0) {
      logger.info('');
      logger.info('❌ FAILED ACCOUNTS:');
      results.filter(r => !r.success).forEach(result => {
        logger.info(`   • @${result.account}: ${result.error}`);
      });
    }
    
    // Success rate
    const successRate = (successfulAccounts / accounts.length * 100).toFixed(1);
    logger.info(`   📈 Success rate: ${successRate}%`);
    
    if (successRate >= 90) {
      logger.info('   🏆 Excellent automation performance!');
    } else if (successRate >= 70) {
      logger.info('   🎯 Good automation performance');
    } else {
      logger.info('   ⚠️ Consider investigating failed accounts');
    }
    
    logger.info('');
    logger.info('💡 NEXT STEPS:');
    if (options.enableSlackUpload) {
      logger.info('   1. Check Slack channels for generated content');
      logger.info('   2. Review and approve posts for publishing');
      logger.info('   3. Track performance of posted content');
    } else {
      logger.info('   1. Enable Slack integration for easier workflow');
      logger.info('   2. Use API responses to publish content');
      logger.info('   3. Set up cron job for daily automation');
    }
    
    // Exit with appropriate code
    process.exit(failedAccounts > 0 ? 1 : 0);
    
  } catch (error) {
    logger.error(`❌ Daily automation failed: ${error.message}`);
    
    logger.info('');
    logger.info('🔧 TROUBLESHOOTING:');
    logger.info('   • Check database connection');
    logger.info('   • Verify account list in database');
    logger.info('   • Ensure images exist for accounts');
    logger.info('   • Check API credentials in .env file');
    
    process.exit(1);
  }
}

/**
 * Get list of accounts to process
 */
async function getAccountsToProcess(targetAccounts) {
  const db = new SupabaseClient();
  
  try {
    if (targetAccounts.length > 0) {
      // Use specified accounts
      logger.info(`🎯 Using specified accounts: ${targetAccounts.join(', ')}`);
      return targetAccounts;
    }
    
    // Try to get from account_profiles table first
    try {
      const { data: profiles, error: profileError } = await db.client
        .from('account_profiles')
        .select('username')
        .eq('is_active', true);
      
      if (!profileError && profiles && profiles.length > 0) {
        logger.info(`👤 Found ${profiles.length} active account profiles`);
        return profiles.map(p => p.username);
      }
    } catch (profileError) {
      logger.warn(`⚠️ Could not fetch from account_profiles: using accounts table`);
    }
    
    // Fallback to accounts table
    const { data: accounts, error } = await db.client
      .from('accounts')
      .select('username')
      .limit(50); // Limit to prevent processing too many accounts
    
    if (error) {
      throw new Error(`Failed to fetch accounts: ${error.message}`);
    }
    
    if (!accounts || accounts.length === 0) {
      logger.warn('⚠️ No accounts found in database');
      return [];
    }
    
    logger.info(`📊 Found ${accounts.length} accounts in database`);
    return accounts.map(a => a.username);
    
  } catch (error) {
    logger.error(`❌ Error fetching accounts: ${error.message}`);
    return [];
  }
}

/**
 * Generate and save daily summary report
 */
async function generateDailySummaryReport(results, summary) {
  const db = new SupabaseClient();
  
  try {
    // Create daily report record
    const report = {
      report_id: `daily_mvp_${new Date().toISOString().split('T')[0]}_${Date.now()}`,
      report_date: new Date().toISOString().split('T')[0],
      report_type: 'daily_mvp_automation',
      accounts_processed: summary.totalAccounts,
      successful_accounts: summary.successfulAccounts,
      failed_accounts: summary.failedAccounts,
      total_posts_generated: summary.totalPosts,
      total_cost: summary.totalCost,
      success_rate: (summary.successfulAccounts / summary.totalAccounts * 100).toFixed(1),
      settings: summary.options,
      detailed_results: results,
      created_at: new Date().toISOString()
    };
    
    // Try to save report (gracefully handle if table doesn't exist)
    try {
      const { error } = await db.client
        .from('daily_reports')
        .insert(report);
      
      if (!error) {
        logger.info(`📊 Daily report saved: ${report.report_id}`);
      }
    } catch (reportError) {
      logger.warn(`⚠️ Could not save daily report: ${reportError.message}`);
    }
    
  } catch (error) {
    logger.warn(`⚠️ Error generating daily report: ${error.message}`);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  logger.info('\n⏹️ Daily automation interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('\n⏹️ Daily automation terminated');
  process.exit(0);
});

// Run the main function
main().catch(error => {
  logger.error(`❌ Unexpected error in daily automation: ${error.message}`);
  process.exit(1);
}); 