#!/usr/bin/env node

/**
 * Content Generation Script - Using Instant Preview System
 * 
 * This script generates content using the new instant-preview system
 * without immediately saving to the database.
 * 
 * Usage:
 *   # Generate content for an account
 *   node generate-content.js @username
 *   
 *   # Generate specific number of posts
 *   node generate-content.js @username --count 10
 *   
 *   # Generate and save immediately
 *   node generate-content.js @username --save
 *   
 *   # Generate and push to Slack
 *   node generate-content.js @username --slack
 */

import { config } from 'dotenv';
config();

import { Logger } from './src/utils/logger.js';
import { SupabaseClient } from './src/database/supabase-client.js';
import fetch from 'node-fetch';
import { execSync } from 'child_process';

const logger = new Logger();
const db = new SupabaseClient();

// Parse command line arguments
const args = process.argv.slice(2);
const username = args[0];
const options = {
  count: 10,
  save: false,
  slack: false
};

// Parse options
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--count' && args[i + 1]) {
    options.count = parseInt(args[i + 1]);
    i++;
  } else if (args[i] === '--save') {
    options.save = true;
  } else if (args[i] === '--slack') {
    options.slack = true;
  }
}

async function generateContent(username, count) {
  logger.info(`🎨 Generating ${count} images for @${username} using instant preview system...`);
  
  // Call the generate-preview API endpoint
  const response = await fetch('http://localhost:3000/api/generate-preview', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      accountUsername: username,
      imageCount: count
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to generate content: ${error}`);
  }
  
  const result = await response.json();
  return result;
}

async function savePost(post, accountUsername) {
  logger.info(`💾 Saving generated post...`);
  
  const response = await fetch('http://localhost:3000/api/save-post', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      post: post,
      accountUsername: accountUsername
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to save post: ${error}`);
  }
  
  const result = await response.json();
  return result;
}

async function pushToSlack(batchId, accountUsername, post) {
  logger.info(`📱 Pushing to Slack...`);
  
  // Get account profile
  const { data: profile } = await db.client
    .from('account_profiles')
    .select('*')
    .eq('username', accountUsername)
    .single();
  
  if (!profile) {
    throw new Error(`Account profile not found for @${accountUsername}`);
  }
  
  // Format for Slack
  const slackData = {
    batchId: batchId,
    account: {
      username: accountUsername,
      displayName: profile.display_name || accountUsername,
      profileImage: profile.profile_pic_url || ''
    },
    post: {
      images: post.images,
      caption: post.caption || 'Check out this amazing content! 🔥',
      hashtags: ['#fashion', '#style', '#ootd', '#aesthetic']
    },
    metrics: {
      estimatedReach: '50K-100K',
      engagementPotential: 'High',
      bestPostingTime: '6:00 PM EST'
    }
  };
  
  // Send to Slack webhook
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.warn('⚠️ SLACK_WEBHOOK_URL not configured, skipping Slack notification');
    return;
  }
  
  const slackResponse = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: `New content generated for @${accountUsername}! 🎨`,
      attachments: [{
        color: '#FF006E',
        fields: [
          {
            title: 'Preview URL',
            value: `https://easypost.fun/preview/${username.substring(1)}?batchId=${batchId}`,
            short: false
          },
          {
            title: 'Images',
            value: `${post.images.length} images`,
            short: true
          },
          {
            title: 'Account',
            value: `@${accountUsername}`,
            short: true
          }
        ],
        footer: 'EasyPost Content Generator',
        ts: Math.floor(Date.now() / 1000)
      }]
    })
  });
  
  if (!slackResponse.ok) {
    logger.warn('⚠️ Failed to send Slack notification');
  } else {
    logger.info('✅ Sent to Slack successfully');
  }
}

async function ensureServerRunning() {
  try {
    const response = await fetch('http://localhost:3000/');
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function startServer() {
  logger.info('🚀 Starting local server...');
  execSync('node src/web/server.js &', { 
    stdio: 'ignore',
    detached: true
  });
  
  // Wait for server to start
  let attempts = 0;
  while (attempts < 10) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (await ensureServerRunning()) {
      logger.info('✅ Server is running');
      return;
    }
    attempts++;
  }
  
  throw new Error('Failed to start server');
}

async function main() {
  try {
    // Validate input
    if (!username || !username.startsWith('@')) {
      console.error('\nUsage:');
      console.error('  node generate-content.js @username [options]');
      console.error('\nOptions:');
      console.error('  --count N    Generate N images (default: 10)');
      console.error('  --save       Save the generated post immediately');
      console.error('  --slack      Push to Slack after generation\n');
      process.exit(1);
    }
    
    const cleanUsername = username.replace('@', '');
    
    // Check if account exists
    const { data: profile } = await db.client
      .from('account_profiles')
      .select('username')
      .eq('username', cleanUsername)
      .single();
    
    if (!profile) {
      logger.error(`❌ Account @${cleanUsername} not found. Please add it first using:`);
      logger.error(`   node run-pipeline.js --new-account @${cleanUsername}`);
      process.exit(1);
    }
    
    // Ensure server is running
    if (!(await ensureServerRunning())) {
      await startServer();
    }
    
    // Generate content
    logger.info(`🎨 Generating content for @${cleanUsername}`);
    logger.info(`📊 Options: ${JSON.stringify(options)}`);
    
    const result = await generateContent(cleanUsername, options.count);
    
    if (!result.success) {
      throw new Error('Content generation failed');
    }
    
    logger.info(`✅ Generated ${result.post.images.length} images successfully!`);
    
    // Save if requested
    let batchId = null;
    if (options.save) {
      const saveResult = await savePost(result.post, cleanUsername);
      batchId = saveResult.batchId;
      logger.info(`✅ Saved with batch ID: ${batchId}`);
      logger.info(`🔗 View at: https://easypost.fun/preview/${username.substring(1)}?batchId=${batchId}`);
    } else {
      logger.info(`🔗 Preview at: http://localhost:3000/preview/${cleanUsername}`);
      logger.info('💡 Tip: Use --save to save this post permanently');
    }
    
    // Push to Slack if requested
    if (options.slack) {
      if (!batchId) {
        // Save first if not already saved
        const saveResult = await savePost(result.post, cleanUsername);
        batchId = saveResult.batchId;
      }
      await pushToSlack(batchId, cleanUsername, result.post);
    }
    
    // Summary
    logger.info('\n📊 Generation Summary:');
    logger.info(`   • Account: @${cleanUsername}`);
    logger.info(`   • Images: ${result.post.images.length}`);
    logger.info(`   • Saved: ${options.save ? 'Yes' : 'No'}`);
    logger.info(`   • Slack: ${options.slack ? 'Sent' : 'No'}`);
    
    if (!options.save) {
      logger.info('\n💡 Next steps:');
      logger.info('   1. Visit the preview URL to see and reroll images');
      logger.info('   2. Click "Save Post" when happy with the selection');
      logger.info('   3. Use "Download Selected" or "Download All" for the images');
    }
    
  } catch (error) {
    logger.error('❌ Content generation failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run content generation
main();