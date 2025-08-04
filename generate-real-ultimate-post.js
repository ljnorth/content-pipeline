#!/usr/bin/env node

/**
 * Generate Real Ultimate Post
 * 
 * This script runs the actual ultimate content generation pipeline
 * to get real images from the database instead of placeholder images.
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function generateRealUltimatePost() {
  try {
    console.log('🚀 Generating REAL ultimate content for aestheticgirl3854...');
    
    // Step 1: Get real images from the database
    console.log('📸 Fetching real images from database...');
    
    let { data: images, error: imagesError } = await supabase
      .from('images')
      .select('*')
      .eq('aesthetic', 'streetwear')
      .limit(50); // Get more images to ensure we have enough unique ones

    if (imagesError) {
      throw new Error(`Failed to fetch images: ${imagesError.message}`);
    }

    if (!images || images.length === 0) {
      console.log('⚠️ No streetwear images found, trying any aesthetic...');
      const { data: anyImages, error: anyError } = await supabase
        .from('images')
        .select('*')
        .limit(50);

      if (anyError || !anyImages || anyImages.length === 0) {
        throw new Error('No images found in database. Please run the content pipeline first.');
      }
      
      console.log(`✅ Found ${anyImages.length} images from database`);
      images = anyImages;
    } else {
      console.log(`✅ Found ${images.length} streetwear images from database`);
    }

    // Step 2: Get account profile
    console.log('👤 Getting account profile...');
    
    const { data: accountProfile, error: profileError } = await supabase
      .from('account_profiles')
      .select('*')
      .eq('username', 'aestheticgirl3854')
      .single();

    if (profileError || !accountProfile) {
      throw new Error('Account profile not found for aestheticgirl3854');
    }

    console.log(`✅ Account profile loaded: ${accountProfile.target_audience?.age || 'general'} audience`);

    // Step 3: Get performance themes
    console.log('🎯 Getting performance themes...');
    
    const { data: themes, error: themesError } = await supabase
      .from('discovered_themes')
      .select('*')
      .gte('performance_score', 70)
      .limit(5);

    if (themesError) {
      console.log('⚠️ No performance themes found, using default theme');
    }

    // Step 4: Create real post with 10 unique database images
    console.log('🔄 Selecting 10 unique images...');
    
    // Shuffle images to ensure variety and avoid duplicates
    const shuffledImages = images.sort(() => Math.random() - 0.5);
    
    // Take first 10 unique images
    const selectedImages = shuffledImages.slice(0, 10).map((img, index) => ({
      id: img.id,
      imagePath: img.image_path || img.imagePath,
      aesthetic: img.aesthetic || 'Streetwear',
      colors: img.colors || ['neutral'],
      season: img.season || 'fall',
      occasion: img.occasion || 'casual'
    }));

    console.log(`📸 Selected ${selectedImages.length} unique images from database`);
    console.log(`🆔 Image IDs: ${selectedImages.map(img => img.id).join(', ')}`);

    // Step 5: Generate caption using account profile
    const caption = generateCaption(accountProfile, selectedImages, themes?.[0]);
    
    const realPost = {
      postNumber: 1,
      theme: themes?.[0]?.theme_name || 'Streetwear Aesthetic',
      images: selectedImages,
      caption: caption,
      hashtags: extractHashtags(caption),
      strategy: {
        theme: themes?.[0]?.theme_name || 'Streetwear Aesthetic',
        targetAudience: accountProfile.target_audience,
        aestheticFocus: accountProfile.content_strategy?.aestheticFocus || ['streetwear'],
        colorPalette: accountProfile.content_strategy?.colorPalette || ['earth tones'],
        performanceGoals: accountProfile.performance_goals
      }
    };

    console.log('📝 Generated real post with database images');
    console.log(`📸 Images: ${realPost.images.length} unique images from database`);
    console.log(`📝 Caption: ${realPost.caption.substring(0, 100)}...`);
    console.log(`🏷️ Hashtags: ${realPost.hashtags.join(', ')}`);

    // Step 6: Create preview batch
    const batchId = `real_ultimate_${Date.now()}_aestheticgirl3854`;
    console.log(`\n📋 Creating preview batch: ${batchId}`);
    
    const { data: previewBatch, error: previewError } = await supabase
      .from('preview_batches')
      .insert({
        preview_id: batchId,
        account_username: 'aestheticgirl3854',
        posts: [realPost],
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      })
      .select()
      .single();

    if (previewError) {
      throw new Error(`Failed to create preview batch: ${previewError.message}`);
    }

    console.log('✅ Preview batch created successfully');

    // Step 7: Create preview data
    const previewData = {
      previewUrl: `https://easypost.fun/postpreview/${batchId}`,
      downloadUrl: `https://easypost.fun/postpreview/download/${batchId}`
    };

    console.log(`🎨 Preview URL: ${previewData.previewUrl}`);
    console.log(`📥 Download URL: ${previewData.downloadUrl}`);

    // Step 8: Send to Slack
    console.log('\n📤 Sending to Slack...');
    
    const { SlackAPI } = require('./src/slack/index.js');
    const slackAPI = new SlackAPI();
    
    if (!slackAPI.enabled) {
      throw new Error('Slack integration not configured - check SLACK_WEBHOOK_URL');
    }

    const payload = slackAPI.buildSlackPayload('aestheticgirl3854', realPost, previewData);
    const result = await slackAPI.sendToSlack(payload);

    console.log('✅ Post sent to Slack successfully!');
    console.log('\n🎉 REAL ultimate post generation complete!');
    console.log('\n🔗 Preview Links:');
    console.log(`   View: ${previewData.previewUrl}`);
    console.log(`   Download: ${previewData.downloadUrl}`);
    console.log('\n📱 Check your Slack for the new message with 10 unique database images!');

    return { success: true, previewData, result };

  } catch (error) {
    console.error('❌ Error generating real ultimate post:', error.message);
    throw error;
  }
}

function generateCaption(accountProfile, images, theme) {
  const audience = accountProfile.target_audience?.age || '16-20';
  const aesthetic = accountProfile.content_strategy?.aestheticFocus?.[0] || 'streetwear';
  
  const themeText = theme ? `inspired by ${theme.theme_name.toLowerCase()}` : '';
  
  return `${aesthetic} vibes for ${audience} year olds ✨\n\n` +
         `perfect for those days when you want to look cute but stay comfy ${themeText}\n\n` +
         `#${aesthetic} #fashiongirl #outfitinspo #aesthetic #streetwear #fashionblogger #casualstyle`;
}

function extractHashtags(caption) {
  const hashtagRegex = /#(\w+)/g;
  const matches = caption.match(hashtagRegex);
  return matches ? matches.map(tag => tag.substring(1)) : [];
}

// Run if called directly
if (require.main === module) {
  generateRealUltimatePost()
    .then(result => {
      console.log('\n🎉 Success!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Failed:', error.message);
      process.exit(1);
    });
}

module.exports = { generateRealUltimatePost }; 