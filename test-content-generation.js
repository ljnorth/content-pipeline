#!/usr/bin/env node

/**
 * Test Content Generation
 * 
 * This script tests the simplified content generation that works
 * with only the basic database tables (accounts, posts, images).
 */

import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - SUPABASE_URL');
  console.error('   - SUPABASE_ANON_KEY');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function testContentGeneration() {
  console.log('🧪 Testing Content Generation');
  console.log('=============================');
  console.log('');

  try {
    // Test 1: Check if basic tables exist and have data
    console.log('📊 Test 1: Checking database tables...');
    
    const { data: images, error: imagesError } = await supabase
      .from('images')
      .select('id, image_path, username, post_id')
      .limit(5);
    
    if (imagesError) {
      console.error('❌ Error accessing images table:', imagesError.message);
      return;
    }
    
    console.log(`✅ Images table accessible: ${images?.length || 0} images found`);
    
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('id, post_id, username')
      .limit(5);
    
    if (postsError) {
      console.error('❌ Error accessing posts table:', postsError.message);
      return;
    }
    
    console.log(`✅ Posts table accessible: ${posts?.length || 0} posts found`);
    
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, username')
      .limit(5);
    
    if (accountsError) {
      console.error('❌ Error accessing accounts table:', accountsError.message);
      return;
    }
    
    console.log(`✅ Accounts table accessible: ${accounts?.length || 0} accounts found`);
    console.log('');

    // Test 2: Check if optional tables exist (should be graceful if they don't)
    console.log('📊 Test 2: Checking optional tables...');
    
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('account_profiles')
        .select('username')
        .limit(1);
      
      if (profilesError) {
        console.log('ℹ️ account_profiles table does not exist (this is okay)');
      } else {
        console.log(`✅ account_profiles table exists: ${profiles?.length || 0} profiles found`);
      }
    } catch (err) {
      console.log('ℹ️ account_profiles table does not exist (this is okay)');
    }
    
    try {
      const { data: generatedPosts, error: generatedPostsError } = await supabase
        .from('generated_posts')
        .select('id')
        .limit(1);
      
      if (generatedPostsError) {
        console.log('ℹ️ generated_posts table does not exist (this is okay)');
      } else {
        console.log(`✅ generated_posts table exists: ${generatedPosts?.length || 0} posts found`);
      }
    } catch (err) {
      console.log('ℹ️ generated_posts table does not exist (this is okay)');
    }
    console.log('');

    // Test 3: Simulate content generation logic
    console.log('🎨 Test 3: Simulating content generation...');
    
    if (!images || images.length === 0) {
      console.log('⚠️ No images found - cannot test content generation');
      return;
    }
    
    // Simulate the content generation process
    const accountUsername = 'test_account';
    const postCount = 1;
    const imageCount = 3;
    
    console.log(`🎯 Generating ${postCount} post(s) with ${imageCount} images each for @${accountUsername}`);
    
    // Select random images
    const shuffled = [...images].sort(() => 0.5 - Math.random());
    const selectedImages = shuffled.slice(0, imageCount);
    
    console.log(`📸 Selected ${selectedImages.length} images:`, selectedImages.map(img => img.id));
    
    // Generate simple theme
    const themes = generateSimpleThemes();
    const theme = themes[0];
    
    console.log(`🎨 Using theme: ${theme.name}`);
    
    // Generate content
    const { caption, hashtags } = generateSimpleContent(selectedImages, theme, 1);
    
    console.log(`✍️ Generated caption: ${caption.substring(0, 100)}...`);
    console.log(`🏷️ Generated hashtags: ${hashtags.slice(0, 5).join(' ')}...`);
    console.log('');

    // Test 4: Summary
    console.log('📋 Test Summary:');
    console.log('✅ Basic tables (accounts, posts, images) are accessible');
    console.log('✅ Content generation logic works with basic data');
    console.log('✅ Optional tables are handled gracefully');
    console.log('');
    console.log('🎉 Content generation should work in production!');
    console.log('');
    console.log('🔧 Next steps:');
    console.log('   1. Deploy your app to Vercel');
    console.log('   2. Test the /api/generate-simple-content endpoint');
    console.log('   3. Run your content pipeline to populate more data');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Generate simple themes (same as in the API)
function generateSimpleThemes() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const dayOfWeek = now.getDay();
  
  const themes = [];
  
  if (month >= 8 && month <= 9) {
    themes.push({
      name: 'Back to School',
      keywords: ['back to school', 'school outfit', 'campus style'],
      hashtags: ['#backtoschool', '#schooloutfit', '#campusstyle', '#studentfashion'],
      description: 'Back to school outfit inspiration'
    });
  }
  
  if (month >= 6 && month <= 8) {
    themes.push({
      name: 'Summer Style',
      keywords: ['summer', 'beach day', 'vacation outfit'],
      hashtags: ['#summer', '#beachday', '#vacationoutfit', '#summerstyle'],
      description: 'Perfect summer and vacation outfits'
    });
  }
  
  if (themes.length === 0) {
    themes.push({
      name: 'Fashion Inspiration',
      keywords: ['fashion', 'style', 'outfit'],
      hashtags: ['#fashion', '#style', '#outfit', '#fashioninspo'],
      description: 'Fashion inspiration and style tips'
    });
  }
  
  return themes;
}

// Generate simple content (same as in the API)
function generateSimpleContent(images, theme, postNumber) {
  const imageCount = images.length;
  
  let caption = '';
  
  if (imageCount === 1) {
    caption = `${theme.description} ✨ Perfect for ${theme.keywords[0]}!`;
  } else {
    caption = `${theme.description} ✨ ${imageCount} amazing looks for ${theme.keywords[0]}!`;
  }
  
  if (postNumber === 1) {
    caption += ' Which one is your favorite? 👀';
  } else {
    caption += ' Save this for later! 📌';
  }
  
  const hashtags = [
    ...theme.hashtags,
    '#fashion',
    '#style',
    '#outfit',
    '#fashioninspo',
    '#trending',
    '#viral'
  ];
  
  caption += `\n\n${hashtags.join(' ')}`;
  
  return {
    caption,
    hashtags
  };
}

// Run the test
testContentGeneration().catch(console.error); 