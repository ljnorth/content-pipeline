import { TikTokAPI } from './src/automation/tiktok-api.js';

async function testCarouselUpload() {
  console.log('🎯 Testing TikTok Carousel Upload to Drafts');
  console.log('===========================================\n');

  try {
    // Initialize TikTok API
    const tiktokAPI = new TikTokAPI();
    console.log('✅ TikTok API initialized\n');

    // Check connected accounts
    const { data: accounts, error } = await tiktokAPI.db.client
      .from('account_profiles')
      .select('username, tiktok_access_token')
      .not('tiktok_access_token', 'is', null)
      .limit(1);

    if (error || accounts.length === 0) {
      console.log('❌ No connected TikTok accounts found');
      console.log('💡 Please connect a TikTok account at https://easypost.fun first');
      return;
    }

    const account = accounts[0];
    console.log(`📱 Testing with account: @${account.username}\n`);

    // Create a sample carousel post with 3 images
    const samplePost = {
      postNumber: 1,
      caption: 'Testing carousel upload! 🚀 This is a sample post with multiple images. Swipe to see more! #test #carousel #tiktok',
      hashtags: ['test', 'carousel', 'tiktok', 'automation', 'fashion'],
      images: [
        {
          id: 'sample1',
          imagePath: 'https://picsum.photos/1080/1920?random=1',
          aesthetic: 'streetwear',
          colors: ['black', 'white'],
          season: 'fall'
        },
        {
          id: 'sample2', 
          imagePath: 'https://picsum.photos/1080/1920?random=2',
          aesthetic: 'minimalist',
          colors: ['beige', 'cream'],
          season: 'spring'
        },
        {
          id: 'sample3',
          imagePath: 'https://picsum.photos/1080/1920?random=3',
          aesthetic: 'vintage',
          colors: ['brown', 'tan'],
          season: 'fall'
        }
      ],
      accountUsername: account.username
    };

    console.log('📝 Sample post created:');
    console.log(`   - Caption: ${samplePost.caption}`);
    console.log(`   - Images: ${samplePost.images.length}`);
    console.log(`   - Hashtags: ${samplePost.hashtags.join(', ')}\n`);

    // Test real upload
    console.log('📤 Uploading carousel to TikTok drafts...');
    console.log('⚠️ This will create an actual carousel draft in your TikTok account!');
    console.log('📋 Using Content Posting API v2 with PULL_FROM_URL method\n');

    const uploadResult = await tiktokAPI.realUploadPost(account.username, samplePost);

    if (uploadResult.success) {
      console.log('🎉 Carousel upload successful!');
      console.log(`📝 Publish ID: ${uploadResult.publishId}`);
      console.log(`📱 Status: ${uploadResult.status}`);
      console.log(`🖼️ Type: ${uploadResult.type}`);
      console.log(`🖼️ Images: ${uploadResult.images}`);
      console.log(`📅 Uploaded: ${uploadResult.uploadedAt}`);
      console.log(`📄 Caption: ${uploadResult.caption}`);
      console.log(`🏷️ Hashtags: ${uploadResult.hashtags.join(', ')}`);
      
      console.log('\n🎯 Check your TikTok app for the new carousel draft!');
      console.log('📱 Go to: TikTok App → Profile → Drafts');
      console.log('💡 You should see a carousel post with 3 images');
      console.log('🔄 Users can swipe through your images in the carousel');
      console.log('📋 API Method: Content Posting API v2 with PULL_FROM_URL');
    } else {
      console.log('❌ Upload failed:', uploadResult.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testCarouselUpload(); 