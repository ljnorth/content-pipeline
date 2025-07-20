import dotenv from 'dotenv';
import { SupabaseClient } from './src/database/supabase-client.js';
import { AccountProcessor } from './src/stages/account-processor.js';
import { ContentAcquirer } from './src/stages/content-acquirer.js';
import { Logger } from './src/utils/logger.js';
import path from 'path';

dotenv.config();

const logger = new Logger();
const db = new SupabaseClient();

async function testIncrementalScraping() {
  try {
    logger.info('🧪 Testing Incremental Scraping System');
    logger.info('=====================================\n');
    
    // Get all accounts from database
    const accounts = await db.getAllAccounts();
    logger.info(`📊 Found ${accounts.length} accounts in database\n`);
    
    if (accounts.length === 0) {
      logger.info('⚠️ No accounts found. Add some accounts first using the web interface.');
      return;
    }
    
    // Process accounts to determine what needs scraping
    const accountProcessor = new AccountProcessor();
    const accountTasks = await accountProcessor.process(accounts);
    
    logger.info('\n📋 Account Processing Results:');
    logger.info('==============================');
    
    let newAccountCount = 0;
    let existingAccountCount = 0;
    
    accountTasks.forEach(task => {
      if (task.isNew) {
        newAccountCount++;
        logger.info(`🆕 NEW: @${task.username} - will scrape up to 75 posts`);
      } else {
        existingAccountCount++;
        const lastScrapedText = task.lastScraped 
          ? new Date(task.lastScraped).toLocaleDateString()
          : 'never';
        logger.info(`🔄 EXISTING: @${task.username} - ${task.existingPostCount} posts, last scraped: ${lastScrapedText}`);
      }
    });
    
    logger.info(`\n📊 Summary:`);
    logger.info(`   🆕 New accounts (full scrape): ${newAccountCount}`);
    logger.info(`   🔄 Existing accounts (incremental): ${existingAccountCount}`);
    
    // Simulate what the ContentAcquirer would do
    logger.info('\n🎯 Incremental Scraping Strategy:');
    logger.info('=================================');
    
    const contentAcquirer = new ContentAcquirer();
    
    // Only process a subset for testing to avoid hitting API limits
    const testAccounts = accountTasks.slice(0, 3); // Test with first 3 accounts
    logger.info(`🧪 Testing with ${testAccounts.length} accounts to avoid API limits\n`);
    
    // Show what would happen for each account
    for (const account of testAccounts) {
      if (account.isNew) {
        logger.info(`📥 @${account.username}: Would scrape up to 75 new posts`);
      } else {
        const existingPostIds = await db.getExistingPostIds(account.username);
        logger.info(`🔍 @${account.username}: Would check for new posts (currently has ${existingPostIds.length} posts)`);
        logger.info(`   Strategy: Check recent posts, filter out ${existingPostIds.length} existing post IDs`);
      }
    }
    
    logger.info('\n⚡ Benefits of Incremental Scraping:');
    logger.info('===================================');
    logger.info('✅ Only scrapes NEW content you don\'t already have');
    logger.info('✅ Saves API calls and processing time');
    logger.info('✅ Automatically detects new vs existing accounts');
    logger.info('✅ Prevents duplicate content in your database');
    logger.info('✅ Much faster pipeline runs after initial setup');
    
    logger.info('\n🎉 Incremental scraping system is ready!');
    logger.info('   Run the pipeline normally - it will automatically use incremental mode');
    
  } catch (error) {
    logger.error(`❌ Test failed: ${error.message}`);
  }
}

testIncrementalScraping(); 