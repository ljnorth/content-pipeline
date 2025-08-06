#!/usr/bin/env node

/**
 * Data Collection Script - TikTok Scraping Only
 * 
 * This script handles ONLY the data collection phase - scraping TikTok posts
 * and storing them in the database. No analysis or processing.
 * 
 * Usage:
 *   # Scrape new posts for all existing accounts (delta)
 *   node run-data-collection.js --delta-only
 *   
 *   # Scrape new posts for specific account
 *   node run-data-collection.js --delta @username
 *   
 *   # Full scrape for new account (75 posts)
 *   node run-data-collection.js --new @username
 */

import { config } from 'dotenv';
config();

import { Logger } from './src/utils/logger.js';
import { SupabaseClient } from './src/database/supabase-client.js';
import { ContentAcquirer } from './src/stages/content-acquirer.js';

const logger = new Logger();
const db = new SupabaseClient();

// Parse command line arguments
const args = process.argv.slice(2);
const mode = args[0];
const username = args[1];

async function getAccountsToScrape(mode, username) {
  if (mode === '--delta-only') {
    // Get all existing accounts
    const { data: accounts, error } = await db.client
      .from('account_profiles')
      .select('username')
      .order('username');
    
    if (error) throw error;
    
    // Get post counts and latest timestamps for each account
    const accountsWithMetadata = [];
    
    for (const account of accounts) {
      const { data: stats } = await db.client
        .from('posts')
        .select('id, created_at')
        .eq('username', account.username)
        .order('created_at', { ascending: false })
        .limit(1);
      
      const latestPost = stats?.[0];
      const { count } = await db.client
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('username', account.username);
      
      accountsWithMetadata.push({
        username: account.username,
        isNew: false,
        existingPostCount: count || 0,
        latestPostTimestamp: latestPost?.created_at || null
      });
    }
    
    return accountsWithMetadata;
  }
  
  if (mode === '--delta' || mode === '--new') {
    if (!username || !username.startsWith('@')) {
      throw new Error('Please provide a username starting with @ (e.g., @aestheticgirl3854)');
    }
    
    const cleanUsername = username.replace('@', '');
    
    if (mode === '--new') {
      return [{
        username: cleanUsername,
        isNew: true,
        existingPostCount: 0,
        latestPostTimestamp: null
      }];
    }
    
    // Delta mode for single account
    const { data: stats } = await db.client
      .from('posts')
      .select('id, created_at')
      .eq('username', cleanUsername)
      .order('created_at', { ascending: false })
      .limit(1);
    
    const latestPost = stats?.[0];
    const { count } = await db.client
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('username', cleanUsername);
    
    return [{
      username: cleanUsername,
      isNew: false,
      existingPostCount: count || 0,
      latestPostTimestamp: latestPost?.created_at || null
    }];
  }
  
  throw new Error('Invalid mode. Use --delta-only, --delta @username, or --new @username');
}

async function runDataCollection(accounts) {
  const acquirer = new ContentAcquirer();
  
  // Track statistics
  const stats = {
    totalAccounts: accounts.length,
    newAccounts: accounts.filter(a => a.isNew).length,
    existingAccounts: accounts.filter(a => !a.isNew).length,
    totalNewPosts: 0,
    accountResults: []
  };
  
  // Process accounts
  const allPosts = await acquirer.process(accounts);
  stats.totalNewPosts = allPosts.length;
  
  // Store posts in database
  if (allPosts.length > 0) {
    logger.info(`💾 Storing ${allPosts.length} new posts in database...`);
    
    for (const post of allPosts) {
      try {
        // Check if post already exists (safety check)
        const { data: existing } = await db.client
          .from('posts')
          .select('id')
          .eq('post_id', post.id)
          .single();
        
        if (existing) {
          logger.warn(`⚠️ Post ${post.id} already exists, skipping...`);
          continue;
        }
        
        // Insert post
        const { error } = await db.client
          .from('posts')
          .insert({
            post_id: post.id,
            username: post.username,
            description: post.description || '',
            hashtags: post.hashtags || [],
            like_count: post.stats?.likeCount || 0,
            comment_count: post.stats?.commentCount || 0,
            share_count: post.stats?.shareCount || 0,
            view_count: post.stats?.viewCount || 0,
            save_count: post.stats?.saveCount || 0,
            engagement_rate: calculateEngagementRate(post.stats),
            video_url: post.videoUrl,
            thumbnail_url: post.thumbnailUrl,
            created_at: new Date(post.createTime * 1000).toISOString(),
            scraped_at: new Date().toISOString()
          });
        
        if (error) {
          logger.error(`❌ Failed to insert post ${post.id}:`, error.message);
        }
      } catch (error) {
        logger.error(`❌ Error processing post ${post.id}:`, error.message);
      }
    }
  }
  
  return stats;
}

function calculateEngagementRate(stats) {
  if (!stats || !stats.viewCount) return 0;
  const totalEngagements = (stats.likeCount || 0) + (stats.commentCount || 0) + (stats.shareCount || 0) + (stats.saveCount || 0);
  return (totalEngagements / stats.viewCount) * 100;
}

async function main() {
  try {
    logger.info('🚀 Starting Data Collection (TikTok Scraping)');
    logger.info(`📋 Mode: ${mode || 'not specified'}`);
    
    // Validate mode
    if (!mode || !['--delta-only', '--delta', '--new'].includes(mode)) {
      console.error('\nUsage:');
      console.error('  node run-data-collection.js --delta-only');
      console.error('  node run-data-collection.js --delta @username');
      console.error('  node run-data-collection.js --new @username\n');
      process.exit(1);
    }
    
    // Get accounts to scrape
    const accounts = await getAccountsToScrape(mode, username);
    logger.info(`📊 Will scrape ${accounts.length} account(s)`);
    
    // Log account details
    for (const account of accounts) {
      if (account.isNew) {
        logger.info(`   🆕 @${account.username} - NEW ACCOUNT (will scrape ~75 posts)`);
      } else {
        logger.info(`   🔄 @${account.username} - ${account.existingPostCount} existing posts, checking for new content`);
      }
    }
    
    // Run data collection
    const stats = await runDataCollection(accounts);
    
    // Summary
    logger.info('\n✅ Data Collection Complete!');
    logger.info('📊 Summary:');
    logger.info(`   • Total accounts: ${stats.totalAccounts}`);
    logger.info(`   • New accounts: ${stats.newAccounts}`);
    logger.info(`   • Existing accounts: ${stats.existingAccounts}`);
    logger.info(`   • New posts collected: ${stats.totalNewPosts}`);
    
    if (stats.totalNewPosts === 0) {
      logger.info('   • Result: All accounts are up to date! ✨');
    } else {
      logger.info('   • Result: New content ready for analysis! 🎯');
    }
    
  } catch (error) {
    logger.error('❌ Data collection failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run data collection
main();