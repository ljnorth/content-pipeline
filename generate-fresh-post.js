#!/usr/bin/env node

/**
 * Generate Fresh Post for Slack Preview
 * 
 * This script generates a fresh post using the ultimate pipeline
 * and pushes it to Slack with working preview links.
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function generateFreshPost() {
  try {
    console.log('🎨 Generating fresh post for aestheticgirl3854...');
    
    // Create a mock post with fresh content
    const freshPost = {
      postNumber: 1,
      theme: 'Streetwear Aesthetic',
      images: [
        {
          id: 'fresh_img_1',
          imagePath: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=400&fit=crop',
          aesthetic: 'Streetwear',
          colors: ['black', 'white', 'gray'],
          season: 'fall',
          occasion: 'casual'
        },
        {
          id: 'fresh_img_2', 
          imagePath: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&h=400&fit=crop',
          aesthetic: 'Streetwear',
          colors: ['brown', 'beige', 'cream'],
          season: 'fall',
          occasion: 'casual'
        },
        {
          id: 'fresh_img_3',
          imagePath: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&h=400&fit=crop',
          aesthetic: 'Streetwear',
          colors: ['navy', 'white', 'blue'],
          season: 'fall',
          occasion: 'casual'
        }
      ],
      caption: "fall streetwear vibes ✨\n\ncozy oversized sweaters, vintage denim, and chunky sneakers are my go-to this season 🍂\n\nperfect for those crisp autumn days when you want to look cute but stay comfy\n\n#fallfashion #streetwear #aesthetic #fashiongirl #outfitinspo #autumnvibes #casualstyle #fashionblogger",
      hashtags: ['fallfashion', 'streetwear', 'aesthetic', 'fashiongirl', 'outfitinspo', 'autumnvibes', 'casualstyle', 'fashionblogger'],
      strategy: {
        theme: 'Streetwear Aesthetic',
        targetAudience: '16-20 year old girls',
        aestheticFocus: ['streetwear', 'casual'],
        colorPalette: ['earth tones', 'neutrals'],
        performanceGoals: {
          engagementRate: 0.08,
          reachTarget: 5000
        }
      }
    };

    console.log('📝 Created fresh post with 3 images');
    console.log(`📸 Images: ${freshPost.images.length} aesthetic streetwear photos`);
    console.log(`📝 Caption: ${freshPost.caption.substring(0, 100)}...`);
    console.log(`🏷️ Hashtags: ${freshPost.hashtags.join(', ')}`);

    // Create preview batch
    const batchId = `fresh_${Date.now()}_aestheticgirl3854`;
    console.log(`\n📋 Creating preview batch: ${batchId}`);
    
    const { data: previewBatch, error: previewError } = await supabase
      .from('preview_batches')
      .insert({
        preview_id: batchId,
        account_username: 'aestheticgirl3854',
        posts: [freshPost],
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      })
      .select()
      .single();

    if (previewError) {
      throw new Error(`Failed to create preview batch: ${previewError.message}`);
    }

    console.log('✅ Preview batch created successfully');

    // Create preview data
    const previewData = {
      previewUrl: `https://easypost.fun/postpreview/${batchId}`,
      downloadUrl: `https://easypost.fun/postpreview/download/${batchId}`
    };

    console.log(`🎨 Preview URL: ${previewData.previewUrl}`);
    console.log(`📥 Download URL: ${previewData.downloadUrl}`);

    // Send to Slack
    console.log('\n📤 Sending to Slack...');
    
    const { SlackAPI } = require('./src/slack/index.js');
    const slackAPI = new SlackAPI();
    
    if (!slackAPI.enabled) {
      throw new Error('Slack integration not configured - check SLACK_WEBHOOK_URL');
    }

    const payload = slackAPI.buildSlackPayload('aestheticgirl3854', freshPost, previewData);
    const result = await slackAPI.sendToSlack(payload);

    console.log('✅ Post sent to Slack successfully!');
    console.log('\n🎉 Fresh post generation complete!');
    console.log('\n🔗 Preview Links:');
    console.log(`   View: ${previewData.previewUrl}`);
    console.log(`   Download: ${previewData.downloadUrl}`);
    console.log('\n📱 Check your Slack for the new message with preview buttons!');

    return { success: true, previewData, result };

  } catch (error) {
    console.error('❌ Error generating fresh post:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  generateFreshPost()
    .then(result => {
      console.log('\n🎉 Success!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Failed:', error.message);
      process.exit(1);
    });
}

module.exports = { generateFreshPost }; 