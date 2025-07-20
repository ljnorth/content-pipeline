import dotenv from 'dotenv';
import { TikTokAPI } from './src/automation/tiktok-api.js';
import { ContentGenerator } from './src/automation/content-generator.js';

// Load environment variables
dotenv.config();

async function testRealUpload() {
  console.log('🚀 Testing Real TikTok Carousel Upload with Content Generation');
  console.log('=============================================================\n');

  try {
    // Initialize APIs
    const tiktokAPI = new TikTokAPI();
    const contentGenerator = new ContentGenerator();
    
    console.log('✅ APIs initialized successfully\n');

    // Get connected accounts
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

    // Generate content for the account
    console.log('🎨 Generating content...');
    const generatedContent = await contentGenerator.generateContentForAccount(account.username, {
      postCount: 1,
      imagesPerPost: 3
    });

    if (!generatedContent.success) {
      console.log('❌ Content generation failed:', generatedContent.error);
      return;
    }

    console.log(`✅ Generated ${generatedContent.posts.length} post(s)`);
    console.log(`📸 Images per post: ${generatedContent.posts[0].images.length}\n`);

    // Test real upload
    console.log('📤 Testing real TikTok carousel upload...');
    console.log('⚠️ This will create actual carousel drafts in your TikTok account!\n');

    const uploadResult = await tiktokAPI.realUploadPost(account.username, generatedContent.posts[0]);

    if (uploadResult.success) {
      console.log('🎉 Carousel upload successful!');
      console.log(`📝 Draft ID: ${uploadResult.draftId}`);
      console.log(`📱 Status: ${uploadResult.status}`);
      console.log(`🖼️ Type: ${uploadResult.type}`);
      console.log(`🖼️ Images: ${uploadResult.images}`);
      console.log(`📅 Uploaded: ${uploadResult.uploadedAt}`);
      console.log(`📄 Caption: ${uploadResult.caption.substring(0, 100)}...`);
      console.log(`🏷️ Hashtags: ${uploadResult.hashtags.join(', ')}`);
      
      console.log('\n🎯 Check your TikTok app for the new carousel draft!');
      console.log('💡 The carousel draft will appear in your TikTok drafts section');
      console.log('📱 Users can swipe through your images in the carousel');
    } else {
      console.log('❌ Upload failed:', uploadResult.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testRealUpload().catch(console.error); 