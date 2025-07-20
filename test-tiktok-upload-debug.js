#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

const VERCEL_URL = 'https://content-pipeline-hpvme00nu-ljs-projects-156bff16.vercel.app';

async function testTikTokUploadDebug() {
  console.log('🔍 Debugging TikTok Upload Process...\n');
  
  try {
    // Test 1: Check TikTok connection status
    console.log('1️⃣ Testing TikTok connection status...');
    const statusResponse = await fetch(`${VERCEL_URL}/api/tiktok-status?username=aestheticgirl3854`);
    const statusData = await statusResponse.text();
    
    if (statusResponse.ok && statusData.startsWith('{')) {
      const status = JSON.parse(statusData);
      console.log('✅ TikTok status endpoint working');
      console.log(`   🔗 Connected: ${status.connected}`);
      console.log(`   📊 Access Token: ${status.accessToken || 'Unknown'}`);
      console.log(`   ⏰ Expires: ${status.expiresAt || 'Unknown'}`);
      console.log(`   🔄 Expired: ${status.isExpired || 'Unknown'}`);
    } else {
      console.log('❌ TikTok status endpoint failed');
      console.log('Response:', statusData.substring(0, 200) + '...');
    }
    
    // Test 2: Check if we can get account info
    console.log('\n2️⃣ Testing TikTok account info...');
    const accountResponse = await fetch(`${VERCEL_URL}/api/tiktok-status?username=aestheticgirl3854`);
    const accountData = await accountResponse.text();
    
    if (accountResponse.ok && accountData.startsWith('{')) {
      const account = JSON.parse(accountData);
      console.log('✅ Account info retrieved');
      console.log(`   👤 Connected: ${account.connected}`);
      console.log(`   📅 Connected At: ${account.connectedAt || 'Unknown'}`);
    } else {
      console.log('❌ Account info failed');
    }
    
    // Test 3: Simulate a real upload request
    console.log('\n3️⃣ Testing TikTok upload simulation...');
    const uploadResponse = await fetch(`${VERCEL_URL}/api/upload-to-tiktok`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'aestheticgirl3854',
        postData: {
          caption: 'Test upload from debug script',
          images: ['https://picsum.photos/1080/1920?random=999'],
          hashtags: ['test', 'debug']
        }
      })
    });
    
    const uploadData = await uploadResponse.text();
    console.log(`📤 Upload Response Status: ${uploadResponse.status}`);
    
    if (uploadResponse.ok && uploadData.startsWith('{')) {
      const upload = JSON.parse(uploadData);
      console.log('✅ Upload endpoint working');
      console.log(`   📊 Success: ${upload.success}`);
      console.log(`   🆔 Post ID: ${upload.postId || 'None'}`);
      console.log(`   📝 Message: ${upload.message || 'None'}`);
      console.log(`   🔍 Full Response:`, JSON.stringify(upload, null, 2));
    } else {
      console.log('❌ Upload endpoint failed');
      console.log('Response:', uploadData.substring(0, 500) + '...');
    }
    
    // Test 4: Check recent uploads in database
    console.log('\n4️⃣ Checking recent uploads in database...');
    const postsResponse = await fetch(`${VERCEL_URL}/api/generated-posts`);
    const postsData = await postsResponse.text();
    
    if (postsResponse.ok && postsData.startsWith('[')) {
      const posts = JSON.parse(postsData);
      console.log(`✅ Found ${posts.length} posts in database`);
      
      // Show last 3 posts
      const recentPosts = posts.slice(-3);
      recentPosts.forEach((post, index) => {
        console.log(`   ${index + 1}. Post ID: ${post.platform_post_id || 'None'}`);
        console.log(`      📅 Posted: ${post.posted_at || 'Not posted'}`);
        console.log(`      📊 Status: ${post.status || 'Unknown'}`);
        console.log(`      👤 Account: ${post.account_username || 'Unknown'}`);
      });
    } else {
      console.log('❌ Failed to get posts from database');
      console.log('Response:', postsData.substring(0, 200) + '...');
    }
    
  } catch (error) {
    console.error('❌ Error during debug:', error.message);
  }
  
  console.log('\n🎯 Debug Summary:');
  console.log('1. Check the Network tab in your browser when uploading');
  console.log('2. Look for any error messages in the responses above');
  console.log('3. Verify your TikTok access token is valid and not expired');
  console.log('4. Check if the post actually appears in your TikTok drafts');
}

testTikTokUploadDebug(); 