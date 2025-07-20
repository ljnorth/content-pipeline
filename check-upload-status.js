#!/usr/bin/env node

/**
 * TikTok Upload Status Checker
 * 
 * This script helps you verify if your TikTok uploads worked by:
 * 1. Checking the database for uploaded posts
 * 2. Checking the web interface status
 * 3. Providing a summary of upload results
 */

// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

import { SupabaseClient } from './src/database/supabase-client.js';
import { Logger } from './src/utils/logger.js';

const logger = new Logger();

async function checkUploadStatus() {
  console.log('🔍 TikTok Upload Status Checker');
  console.log('================================\n');

  try {
    // Initialize database connection
    const db = new SupabaseClient();
    
    // Check recent uploads in the database
    console.log('📊 Checking recent uploads in database...');
    
    const { data: recentPosts, error } = await db.client
      .from('generated_posts')
      .select('*')
      .not('platform_post_id', 'is', null)
      .order('posted_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Database error:', error.message);
      return;
    }

    if (recentPosts.length === 0) {
      console.log('⚠️  No uploaded posts found in database');
      console.log('💡 This could mean:');
      console.log('   - No uploads have been made yet');
      console.log('   - Uploads failed to save to database');
      console.log('   - You need to run the upload process first');
      return;
    }

    console.log(`✅ Found ${recentPosts.length} recent uploads:\n`);

    // Display upload summary
    recentPosts.forEach((post, index) => {
      console.log(`${index + 1}. Post for @${post.account_username}`);
      console.log(`   📝 TikTok ID: ${post.platform_post_id}`);
      console.log(`   📅 Uploaded: ${new Date(post.posted_at).toLocaleString()}`);
      console.log(`   📄 Caption: ${post.caption?.substring(0, 50)}...`);
      console.log(`   🏷️  Hashtags: ${post.hashtags?.slice(0, 3).join(', ')}...`);
      console.log('');
    });

    // Check web interface status (both localhost and production)
    console.log('🌐 Checking web interface status...');
    
    const webUrls = [
      'http://localhost:3000',
      'https://easypost.fun'
    ];
    
    let webStatus = null;
    
    for (const baseUrl of webUrls) {
      try {
        const response = await fetch(`${baseUrl}/api/accounts/aestheticgirl3854/tiktok-status`);
        if (response.ok) {
          webStatus = await response.json();
          console.log(`✅ Web interface is running at ${baseUrl}`);
          console.log(`📱 TikTok connection: ${webStatus.connected ? 'Connected' : 'Not connected'}`);
          if (webStatus.connected && webStatus.expired) {
            console.log('⚠️  TikTok token is expired - reconnect needed');
          }
          break;
        }
      } catch (webError) {
        console.log(`⚠️  Web interface not available at ${baseUrl}`);
      }
    }
    
    if (!webStatus) {
      console.log('⚠️  No web interface available (check if running locally or deployed)');
    }

    // Summary
    console.log('\n📋 Verification Summary:');
    console.log('========================');
    console.log(`✅ Database uploads: ${recentPosts.length} posts found`);
    console.log(`📱 Latest upload: ${new Date(recentPosts[0].posted_at).toLocaleString()}`);
    console.log(`🎯 TikTok IDs: ${recentPosts.map(p => p.platform_post_id).join(', ')}`);
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Check your TikTok app → Profile → Drafts');
    console.log('2. Look for carousel posts with the captions shown above');
    console.log('3. If you don\'t see them, check the web interface for error messages');
    console.log('4. Access web interface:');
    console.log('   - Local: http://localhost:3000 (run: npm run web)');
    console.log('   - Production: https://easypost.fun');

  } catch (error) {
    console.error('❌ Error checking upload status:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('1. Make sure your environment variables are set (SUPABASE_URL, etc.)');
    console.log('2. Check that your database is accessible');
    console.log('3. Verify your TikTok account is connected');
  }
}

// Run the check
checkUploadStatus(); 