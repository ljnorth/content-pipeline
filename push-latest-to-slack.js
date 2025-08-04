const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function pushLatestToSlack() {
  try {
    console.log('🔍 Getting latest generated posts for aestheticgirl3854...');
    
    // Get the most recent generation from generated_posts table
    const { data, error } = await supabase
      .from('generated_posts')
      .select('*')
      .eq('account_username', 'aestheticgirl3854')
      .order('created_at', { ascending: false })
      .limit(5); // Get up to 5 recent posts from the same generation

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('No generated posts found for aestheticgirl3854');
    }

    console.log(`✅ Found ${data.length} recent posts`);
    console.log(`📅 Latest created: ${data[0].created_at}`);
    console.log(`🆔 Generation ID: ${data[0].generation_id}`);

    // Group posts by generation_id and get the most recent generation
    const generationGroups = {};
    data.forEach(post => {
      if (!generationGroups[post.generation_id]) {
        generationGroups[post.generation_id] = [];
      }
      generationGroups[post.generation_id].push(post);
    });

    // Get the most recent generation (first in sorted order)
    const latestGenerationId = Object.keys(generationGroups)[0];
    const latestPosts = generationGroups[latestGenerationId];

    console.log(`📝 Using generation: ${latestGenerationId} (${latestPosts.length} posts)`);

    // Convert to Slack API format
    const posts = latestPosts.map((postData, index) => ({
      postNumber: postData.post_number || (index + 1),
      theme: postData.strategy?.theme || 'Generated Content',
      images: (postData.images || []).map(img => ({
        id: img.id,
        imagePath: img.imagePath || img.image_path,
        aesthetic: img.aesthetic || 'N/A'
      })),
      caption: postData.caption || 'No caption',
      hashtags: postData.hashtags || [],
      strategy: postData.strategy || {}
    }));

    console.log(`\n📤 Creating preview batch and pushing ${posts.length} posts to Slack...`);
    
    // Initialize Slack API
    const { SlackAPI } = require('./src/slack/index.js');
    const slackAPI = new SlackAPI();
    
    if (!slackAPI.enabled) {
      throw new Error('Slack integration not configured - check SLACK_WEBHOOK_URL');
    }

    // Create preview batch first
    let previewData = null;
    try {
      console.log('📋 Creating preview batch...');
      const { data: previewBatch, error: previewError } = await supabase
        .from('preview_batches')
        .insert({
          preview_id: `slack_${Date.now()}_aestheticgirl3854`,
          account_username: 'aestheticgirl3854',
          posts: posts,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
        })
        .select()
        .single();

      if (!previewError && previewBatch) {
        previewData = {
          previewUrl: `https://easypost.fun/postpreview/${previewBatch.preview_id}`,
          downloadUrl: `https://easypost.fun/postpreview/download/${previewBatch.preview_id}`
        };
        console.log(`✅ Preview created: ${previewData.previewUrl}`);
      } else {
        console.warn('⚠️ Failed to create preview batch:', previewError?.message);
      }
    } catch (error) {
      console.warn('⚠️ Preview creation failed:', error.message);
    }

    // Send each post to Slack with preview data
    const results = [];
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      console.log(`📤 Sending post ${post.postNumber} to Slack...`);
      
      try {
        const payload = slackAPI.buildSlackPayload('aestheticgirl3854', post, previewData);
        const result = await slackAPI.sendToSlack(payload);
        results.push({ post: post.postNumber, success: true, result });
        console.log(`✅ Post ${post.postNumber} sent successfully`);
      } catch (error) {
        console.error(`❌ Failed to send post ${post.postNumber}:`, error.message);
        results.push({ post: post.postNumber, success: false, error: error.message });
      }
    }

    console.log('\n📊 Results:');
    const successCount = results.filter(r => r.success).length;
    console.log(`✅ ${successCount}/${results.length} posts sent successfully`);
    
    if (previewData) {
      console.log(`\n🎨 Preview Links:`);
      console.log(`   View: ${previewData.previewUrl}`);
      console.log(`   Download: ${previewData.downloadUrl}`);
    }

    return { success: successCount === posts.length, results, previewData };

  } catch (error) {
    console.error('❌ Error pushing to Slack:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  pushLatestToSlack()
    .then(result => {
      console.log('\n🎉 Push to Slack completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Push to Slack failed:', error.message);
      process.exit(1);
    });
}

module.exports = { pushLatestToSlack }; 