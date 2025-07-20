#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

const VERCEL_URL = 'https://easypost.fun';

async function testVercelAPI() {
  console.log('🧪 Testing Vercel API Fix...\n');
  
  try {
    // Test 1: Generated Posts endpoint
    console.log('1️⃣ Testing /api/generated-posts...');
    const postsResponse = await fetch(`${VERCEL_URL}/api/generated-posts`);
    const postsData = await postsResponse.text();
    
    if (postsResponse.ok && postsData.startsWith('[')) {
      console.log('✅ Generated posts endpoint working - returns JSON array');
    } else {
      console.log('❌ Generated posts endpoint failed - returns HTML or error');
      console.log('Response:', postsData.substring(0, 200) + '...');
    }
    
    // Test 2: Account Profiles endpoint
    console.log('\n2️⃣ Testing /api/account-profiles...');
    const profilesResponse = await fetch(`${VERCEL_URL}/api/account-profiles`);
    const profilesData = await profilesResponse.text();
    
    if (profilesResponse.ok && profilesData.startsWith('[')) {
      console.log('✅ Account profiles endpoint working - returns JSON array');
    } else {
      console.log('❌ Account profiles endpoint failed - returns HTML or error');
      console.log('Response:', profilesData.substring(0, 200) + '...');
    }
    
    // Test 3: TikTok Status endpoint
    console.log('\n3️⃣ Testing /api/accounts/aestheticgirl3854/tiktok-status...');
    const tiktokResponse = await fetch(`${VERCEL_URL}/api/accounts/aestheticgirl3854/tiktok-status`);
    const tiktokData = await tiktokResponse.text();
    
    if (tiktokResponse.ok && tiktokData.startsWith('{')) {
      console.log('✅ TikTok status endpoint working - returns JSON object');
    } else {
      console.log('❌ TikTok status endpoint failed - returns HTML or error');
      console.log('Response:', tiktokData.substring(0, 200) + '...');
    }
    
    // Test 4: Main page
    console.log('\n4️⃣ Testing main page...');
    const mainResponse = await fetch(VERCEL_URL);
    const mainData = await mainResponse.text();
    
    if (mainResponse.ok && mainData.includes('<!DOCTYPE html>')) {
      console.log('✅ Main page working - returns HTML');
    } else {
      console.log('❌ Main page failed');
    }
    
    console.log('\n🎯 Summary:');
    console.log('If you see ✅ for all API endpoints, the fix worked!');
    console.log('If you see ❌ for API endpoints, you need to redeploy to Vercel.');
    console.log('\n📝 Next steps:');
    console.log('1. Commit and push these changes to your repository');
    console.log('2. Redeploy on Vercel dashboard');
    console.log('3. Run this test again to verify the fix');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testVercelAPI(); 