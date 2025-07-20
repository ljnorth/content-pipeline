#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

const VERCEL_URL = 'https://content-pipeline-906oe1bt0-ljs-projects-156bff16.vercel.app';

async function testWorkflowGeneration() {
  console.log('🧪 Testing Workflow Generation (Real Images vs Placeholders)...\n');
  
  try {
    // Test workflow generation
    console.log('1️⃣ Testing /api/generate-workflow-content...');
    const response = await fetch(`${VERCEL_URL}/api/generate-workflow-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountUsername: 'aestheticgirl3854',
        postCount: 1,
        imageCount: 3
      })
    });
    
    const data = await response.text();
    
    if (response.ok && data.startsWith('{')) {
      const parsed = JSON.parse(data);
      console.log('✅ Workflow generation working - returns JSON');
      
      // Check if images are real or placeholder
      if (parsed.generation && parsed.generation.posts) {
        const post = parsed.generation.posts[0];
        if (post.images && post.images.length > 0) {
          const firstImage = post.images[0];
          console.log(`   📊 Post ID: ${parsed.generation.id}`);
          console.log(`   👤 Account: ${parsed.generation.accountUsername}`);
          console.log(`   🖼️  First image URL: ${firstImage.imagePath}`);
          
          // Check if it's a placeholder or real image
          if (firstImage.imagePath.includes('picsum.photos')) {
            console.log('   ❌ STILL USING PLACEHOLDER IMAGES (picsum.photos)');
            console.log('   🔧 The fix did not work - still using placeholder images');
          } else if (firstImage.imagePath.includes('supabase.co') || firstImage.imagePath.includes('storage.googleapis.com')) {
            console.log('   ✅ USING REAL DATABASE IMAGES!');
            console.log('   🎉 The fix worked - now using real images from database');
          } else {
            console.log('   ❓ Unknown image source - check the URL');
          }
        } else {
          console.log('   ❌ No images found in the response');
        }
      } else {
        console.log('   ❌ No posts found in the response');
      }
    } else {
      console.log('❌ Workflow generation failed - returns HTML or error');
      console.log('Response:', data.substring(0, 200) + '...');
    }
    
  } catch (error) {
    console.error('❌ Error testing workflow generation:', error.message);
  }
}

testWorkflowGeneration(); 