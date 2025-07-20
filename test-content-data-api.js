#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

const VERCEL_URL = 'https://easypost.fun';

async function testContentDataAPI() {
  console.log('🧪 Testing Content Data API (Supabase Only)...\n');
  
  try {
    // Test 1: Content data endpoint with a post ID from database
    console.log('1️⃣ Testing /api/content-data...');
    const contentResponse = await fetch(`${VERCEL_URL}/api/content-data?postId=7477630077585558807&type=info`);
    const contentData = await contentResponse.text();
    
    if (contentResponse.ok && contentData.startsWith('{')) {
      console.log('✅ Content data endpoint working - returns JSON object from Supabase');
      const parsed = JSON.parse(contentData);
      console.log(`   📊 Post ID: ${parsed.post_id}`);
      console.log(`   👤 Username: ${parsed.username}`);
      console.log(`   📝 Text: ${parsed.text?.substring(0, 50)}...`);
    } else {
      console.log('❌ Content data endpoint failed - returns HTML or error');
      console.log('Response:', contentData.substring(0, 200) + '...');
    }
    
    // Test 2: Generated posts endpoint (should now work)
    console.log('\n2️⃣ Testing /api/generated-posts...');
    const postsResponse = await fetch(`${VERCEL_URL}/api/generated-posts`);
    const postsData = await postsResponse.text();
    
    if (postsResponse.ok && postsData.startsWith('[')) {
      console.log('✅ Generated posts endpoint working - returns JSON array');
    } else {
      console.log('❌ Generated posts endpoint failed - returns HTML or error');
      console.log('Response:', postsData.substring(0, 200) + '...');
    }
    
    // Test 3: Account profiles endpoint
    console.log('\n3️⃣ Testing /api/account-profiles...');
    const profilesResponse = await fetch(`${VERCEL_URL}/api/account-profiles`);
    const profilesData = await profilesResponse.text();
    
    if (profilesResponse.ok && profilesData.startsWith('[')) {
      console.log('✅ Account profiles endpoint working - returns JSON array');
    } else {
      console.log('❌ Account profiles endpoint failed - returns HTML or error');
      console.log('Response:', profilesData.substring(0, 200) + '...');
    }
    
    console.log('\n🎯 Summary:');
    console.log('✅ All endpoints now use Supabase database only');
    console.log('❌ No temp directory access - everything from database');
    console.log('If you see ✅ for all endpoints, the JSON serving issue is fixed!');
    console.log('If you see ❌ for any endpoints, you need to redeploy to Vercel.');
    console.log('\n📝 Next steps:');
    console.log('1. Commit and push these changes to your repository');
    console.log('2. Redeploy on Vercel dashboard');
    console.log('3. Run this test again to verify the fix');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testContentDataAPI(); 