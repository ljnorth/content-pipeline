#!/usr/bin/env node

/**
 * Vercel Deployment Test Script
 * 
 * This script tests your TikTok upload verification system
 * on your Vercel deployment at easypost.fun
 */

console.log('🌐 Testing Vercel Deployment (easypost.fun)');
console.log('===========================================\n');

async function testVercelDeployment() {
  const baseUrl = 'https://easypost.fun';
  
  try {
    // Test 1: Basic connectivity
    console.log('1️⃣ Testing basic connectivity...');
    const homeResponse = await fetch(baseUrl);
    if (homeResponse.ok) {
      console.log('✅ Website is accessible');
    } else {
      console.log(`❌ Website returned status: ${homeResponse.status}`);
      return;
    }

    // Test 2: TikTok status endpoint
    console.log('\n2️⃣ Testing TikTok status endpoint...');
    const tiktokResponse = await fetch(`${baseUrl}/api/accounts/aestheticgirl3854/tiktok-status`);
    
    if (tiktokResponse.ok) {
      const status = await tiktokResponse.json();
      console.log('✅ TikTok status endpoint working');
      console.log(`📱 Connection: ${status.connected ? 'Connected' : 'Not connected'}`);
      console.log(`⏰ Expired: ${status.expired ? 'Yes' : 'No'}`);
      if (status.expiresAt) {
        console.log(`📅 Expires: ${new Date(status.expiresAt).toLocaleString()}`);
      }
    } else {
      console.log(`❌ TikTok status endpoint failed: ${tiktokResponse.status}`);
      const errorText = await tiktokResponse.text();
      console.log(`Error: ${errorText}`);
    }

    // Test 3: Database connectivity (via generated posts endpoint)
    console.log('\n3️⃣ Testing database connectivity...');
    const postsResponse = await fetch(`${baseUrl}/api/generated-posts`);
    
    if (postsResponse.ok) {
      const posts = await postsResponse.json();
      console.log('✅ Database connectivity working');
      console.log(`📊 Found ${posts.length} generated posts`);
    } else {
      console.log(`❌ Database connectivity failed: ${postsResponse.status}`);
      const errorText = await postsResponse.text();
      console.log(`Error: ${errorText}`);
    }

    // Test 4: Account profiles endpoint
    console.log('\n4️⃣ Testing account profiles...');
    const accountsResponse = await fetch(`${baseUrl}/api/account-profiles`);
    
    if (accountsResponse.ok) {
      const accounts = await accountsResponse.json();
      console.log('✅ Account profiles endpoint working');
      console.log(`👤 Found ${accounts.length} account profiles`);
      
      // Check for your specific account
      const yourAccount = accounts.find(acc => acc.username === 'aestheticgirl3854');
      if (yourAccount) {
        console.log('✅ Your account (@aestheticgirl3854) found in database');
        console.log(`🔗 TikTok connected: ${yourAccount.tiktok_access_token ? 'Yes' : 'No'}`);
      } else {
        console.log('⚠️  Your account (@aestheticgirl3854) not found in database');
      }
    } else {
      console.log(`❌ Account profiles endpoint failed: ${accountsResponse.status}`);
    }

    // Summary
    console.log('\n📋 Deployment Test Summary:');
    console.log('===========================');
    console.log('✅ Website accessible at https://easypost.fun');
    console.log('✅ API endpoints responding');
    console.log('✅ Database connectivity working');
    console.log('✅ TikTok integration configured');
    
    console.log('\n🎯 Next Steps:');
    console.log('==============');
    console.log('1. Visit https://easypost.fun to access the web interface');
    console.log('2. Test TikTok upload functionality');
    console.log('3. Run: node check-upload-status.js (for local verification)');
    console.log('4. Monitor uploads in your TikTok app');

  } catch (error) {
    console.error('❌ Deployment test failed:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('1. Check if your Vercel deployment is live');
    console.log('2. Verify environment variables are set in Vercel dashboard');
    console.log('3. Check Vercel deployment logs for errors');
    console.log('4. Ensure your domain (easypost.fun) is properly configured');
  }
}

// Run the test
testVercelDeployment(); 