#!/usr/bin/env node

/**
 * Consolidated Pipeline Runner
 * 
 * This is the main orchestrator for all content pipeline operations.
 * It handles both new account setup and incremental updates.
 * 
 * Usage:
 *   # Add new account (full pipeline)
 *   node run-pipeline.js --new-account @username
 *   
 *   # Weekly update for all accounts (delta only)
 *   node run-pipeline.js --update-all
 *   
 *   # Update single account (delta only)
 *   node run-pipeline.js --update @username
 */

import { config } from 'dotenv';
config();

import { Logger } from './src/utils/logger.js';
import { SupabaseClient } from './src/database/supabase-client.js';
import { ContentAcquirer } from './src/stages/content-acquirer.js';
import { ImageProcessor } from './src/stages/image-processor.js';
import { AIAnalyzer } from './src/stages/ai-analyzer.js';
import { DatabaseStorage } from './src/stages/database-storage.js';
import { ThemeDiscoveryAnalyzer } from './src/stages/theme-discovery-analyzer.js';
import { execSync } from 'child_process';

const logger = new Logger();
const db = new SupabaseClient();

// Parse command line arguments
const args = process.argv.slice(2);
const mode = args[0];
const username = args[1];

async function getAccountsToProcess(mode, username) {
  logger.info('📋 Determining accounts to process...');
  
  if (mode === '--new-account') {
    if (!username || !username.startsWith('@')) {
      throw new Error('Please provide a username starting with @ (e.g., @aestheticgirl3854)');
    }
    
    // Check if account already exists
    const { data: existing } = await db.client
      .from('account_profiles')
      .select('username')
      .eq('username', username.replace('@', ''))
      .single();
    
    if (existing) {
      throw new Error(`Account ${username} already exists. Use --update instead.`);
    }
    
    return [{
      username: username.replace('@', ''),
      isNew: true,
      requiresFullPipeline: true
    }];
  }
  
  if (mode === '--update-all') {
    // Get all existing accounts
    const { data: accounts, error } = await db.client
      .from('account_profiles')
      .select('username, created_at')
      .order('username');
    
    if (error) throw error;
    
    return accounts.map(acc => ({
      username: acc.username,
      isNew: false,
      requiresFullPipeline: false,
      lastUpdated: acc.created_at
    }));
  }
  
  if (mode === '--update') {
    if (!username || !username.startsWith('@')) {
      throw new Error('Please provide a username starting with @ (e.g., @aestheticgirl3854)');
    }
    
    const { data: existing } = await db.client
      .from('account_profiles')
      .select('username, created_at')
      .eq('username', username.replace('@', ''))
      .single();
    
    if (!existing) {
      throw new Error(`Account ${username} not found. Use --new-account to add it first.`);
    }
    
    return [{
      username: existing.username,
      isNew: false,
      requiresFullPipeline: false,
      lastUpdated: existing.created_at
    }];
  }
  
  throw new Error('Invalid mode. Use --new-account, --update-all, or --update');
}

async function runDataCollection(accounts) {
  logger.info('🔄 Starting data collection phase...');
  
  // For new accounts or updates, run data collection
  const collectionArgs = accounts.map(acc => 
    acc.isNew ? `--new ${acc.username}` : `--delta ${acc.username}`
  ).join(' ');
  
  try {
    logger.info(`🏃 Running: node run-data-collection.js ${collectionArgs}`);
    execSync(`node run-data-collection.js ${collectionArgs}`, { stdio: 'inherit' });
  } catch (error) {
    logger.error('❌ Data collection failed:', error.message);
    throw error;
  }
}

async function runAnalysisPipeline(accounts) {
  logger.info('🧠 Starting analysis pipeline...');
  
  // Get posts that need analysis
  const postsToAnalyze = [];
  
  for (const account of accounts) {
    const query = db.client
      .from('posts')
      .select('*')
      .eq('username', account.username);
    
    // For delta updates, only get unanalyzed posts
    if (!account.isNew) {
      query.is('ai_analysis', null);
    }
    
    const { data: posts, error } = await query;
    if (error) throw error;
    
    postsToAnalyze.push(...posts);
    logger.info(`📊 Found ${posts.length} posts to analyze for @${account.username}`);
  }
  
  if (postsToAnalyze.length === 0) {
    logger.info('✅ All posts are already analyzed!');
    return;
  }
  
  // Run analysis stages
  const stages = {
    imageProcessor: new ImageProcessor(),
    aiAnalyzer: new AIAnalyzer(),
    databaseStorage: new DatabaseStorage()
  };
  
  // Process images
  logger.info('🖼️ Processing images...');
  const processedPosts = await stages.imageProcessor.process(postsToAnalyze);
  
  // Run AI analysis
  logger.info('🤖 Running AI analysis...');
  const analyzedPosts = await stages.aiAnalyzer.process(processedPosts);
  
  // Store results
  logger.info('💾 Storing analysis results...');
  await stages.databaseStorage.process(analyzedPosts);
  
  // Run theme discovery on high-performing content
  logger.info('🎯 Discovering themes from high-performing content...');
  const themeAnalyzer = new ThemeDiscoveryAnalyzer();
  await themeAnalyzer.discoverThemes({
    minEngagementRate: 0.05,
    maxThemes: 20
  });
}

async function generatePreviewContent(accounts) {
  logger.info('🎨 Generating preview content...');
  
  for (const account of accounts) {
    try {
      logger.info(`📱 Generating content for @${account.username}`);
      execSync(`node generate-content.js @${account.username} --count 5`, { stdio: 'inherit' });
    } catch (error) {
      logger.error(`❌ Failed to generate content for @${account.username}:`, error.message);
    }
  }
}

async function main() {
  try {
    logger.info('🚀 Starting Consolidated Pipeline');
    logger.info(`📋 Mode: ${mode || 'not specified'}`);
    
    // Validate mode
    if (!mode || !['--new-account', '--update-all', '--update'].includes(mode)) {
      console.error('\nUsage:');
      console.error('  node run-pipeline.js --new-account @username');
      console.error('  node run-pipeline.js --update-all');
      console.error('  node run-pipeline.js --update @username\n');
      process.exit(1);
    }
    
    // Get accounts to process
    const accounts = await getAccountsToProcess(mode, username);
    logger.info(`📊 Processing ${accounts.length} account(s)`);
    
    // Step 1: Data Collection (scraping)
    if (mode === '--new-account' || accounts.some(a => !a.isNew)) {
      await runDataCollection(accounts);
    }
    
    // Step 2: Analysis Pipeline
    await runAnalysisPipeline(accounts);
    
    // Step 3: Generate preview content (optional)
    if (mode === '--new-account') {
      await generatePreviewContent(accounts);
    }
    
    logger.info('✅ Pipeline completed successfully!');
    
    // Summary
    logger.info('\n📊 Pipeline Summary:');
    logger.info(`   • Mode: ${mode}`);
    logger.info(`   • Accounts processed: ${accounts.length}`);
    logger.info(`   • New accounts: ${accounts.filter(a => a.isNew).length}`);
    logger.info(`   • Updated accounts: ${accounts.filter(a => !a.isNew).length}`);
    
  } catch (error) {
    logger.error('❌ Pipeline failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the pipeline
main();