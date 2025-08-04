import dotenv from 'dotenv';
import { UnifiedSmartContentGenerator } from './src/stages/unified-smart-content-generator.js';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function generatePostForSlack() {
  console.log('🚀 Generating Post for Slack with Preview System...\n');

  const generator = new UnifiedSmartContentGenerator();

  try {
    // Use the available account profile
    const accountUsername = 'aestheticgirl3854';
    
    console.log(`📝 Generating post for @${accountUsername}...`);
    console.log(`🎯 Using account profile with cover slide uniqueness...`);
    console.log(`📊 Target: 10 unique images (1 cover slide + 9 additional)\n`);
    
    const result = await generator.generateUltimateContent(accountUsername, {
      postCount: 1,
      imageCount: 10, // Changed from 5 to 10 to meet target
      useHookSlides: true,
      ensureVariety: true
    });

    console.log('\n✅ Post generated successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Account: @${accountUsername}`);
    console.log(`   - Posts generated: ${result.summary.totalPosts}`);
    console.log(`   - Images per post: ${result.posts[0].images.length}`);
    console.log(`   - Unique cover slides used: ${result.summary.uniqueCoverSlidesUsed}`);
    console.log(`   - Total cost: $${result.summary.totalCost.toFixed(4)}`);

    // Get the generated post
    const post = result.posts[0];
    
    // Verify we have 10 images
    if (post.images.length !== 10) {
      console.log(`⚠️ Warning: Generated ${post.images.length} images instead of 10`);
    } else {
      console.log(`✅ Perfect! Generated exactly 10 images as requested`);
    }
    
    // Step 6: Create preview batch
    const batchId = `ultimate_${Date.now()}_${accountUsername}`;
    console.log(`\n📋 Creating preview batch: ${batchId}`);
    
    const { data: previewBatch, error: previewError } = await supabase
      .from('preview_batches')
      .insert({
        preview_id: batchId,
        account_username: accountUsername,
        posts: [post],
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

    // Step 8: Send to Slack using proper Slack API
    console.log('\n📤 Sending to Slack with interactive buttons...');
    
    const { SlackAPI } = await import('./src/slack/index.js');
    const slackAPI = new SlackAPI();
    
    if (!slackAPI.enabled) {
      throw new Error('Slack integration not configured - check SLACK_WEBHOOK_URL');
    }

    const payload = slackAPI.buildSlackPayload(accountUsername, post, previewData);
    const slackResult = await slackAPI.sendToSlack(payload);

    console.log('✅ Post sent to Slack successfully!');
    console.log('\n🎉 Content generation and Slack delivery complete!');
    console.log('\n🔗 Preview Links:');
    console.log(`   View: ${previewData.previewUrl}`);
    console.log(`   Download: ${previewData.downloadUrl}`);
    console.log('\n📱 Check your Slack for the interactive message with 10 unique images!');

  } catch (error) {
    console.error('❌ Failed to generate or send post:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the generation and Slack delivery
generatePostForSlack(); 