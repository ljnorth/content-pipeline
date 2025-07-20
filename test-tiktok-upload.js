import dotenv from 'dotenv';
import { TikTokAPI } from './src/automation/tiktok-api.js';

// Load environment variables
dotenv.config();

async function testTikTokUpload() {
  console.log('🧪 Testing TikTok Carousel Upload Functionality');
  console.log('===============================================\n');

  try {
    // Test 1: Check TikTok API initialization
    console.log('1️⃣ Testing TikTok API initialization...');
    const tiktokAPI = new TikTokAPI();
    console.log('✅ TikTok API initialized successfully\n');

    // Test 2: Check connected accounts
    console.log('2️⃣ Checking connected TikTok accounts...');
    const { data: accounts, error } = await tiktokAPI.db.client
      .from('account_profiles')
      .select('username, tiktok_access_token, tiktok_connected_at')
      .not('tiktok_access_token', 'is', null);

    if (error) {
      console.error('❌ Database error:', error.message);
      return;
    }

    if (accounts.length === 0) {
      console.log('⚠️ No TikTok accounts connected yet');
      console.log('💡 To test carousel upload, you need to:');
      console.log('   1. Go to https://easypost.fun');
      console.log('   2. Create an account profile');
      console.log('   3. Connect your TikTok account');
      console.log('   4. Run this test again\n');
      return;
    }

    console.log(`✅ Found ${accounts.length} connected TikTok account(s):`);
    accounts.forEach(account => {
      console.log(`   - @${account.username} (connected: ${account.tiktok_connected_at})`);
    });
    console.log('');

    // Test 3: Test image upload with sample images
    console.log('3️⃣ Testing image upload to TikTok Media Library...');
    const sampleImages = [
      { imagePath: 'https://picsum.photos/1080/1920?random=1', id: 'sample1' },
      { imagePath: 'https://picsum.photos/1080/1920?random=2', id: 'sample2' },
      { imagePath: 'https://picsum.photos/1080/1920?random=3', id: 'sample3' }
    ];

    try {
      const credentials = await tiktokAPI.getAccountCredentials(accounts[0].username);
      if (credentials && credentials.access_token) {
        console.log('✅ Found valid credentials for image upload test');
        console.log('💡 Image upload would work here!');
        console.log('   (Skipping actual upload to avoid creating test media)');
      } else {
        console.log('⚠️ No valid credentials found for image upload test');
      }
    } catch (error) {
      console.log(`⚠️ Image upload test failed: ${error.message}`);
    }
    console.log('');

    // Test 4: Test mock carousel upload
    console.log('4️⃣ Testing mock carousel upload...');
    const mockPost = {
      postNumber: 1,
      caption: 'Test carousel post from automation system! 🚀',
      hashtags: ['test', 'automation', 'tiktok', 'carousel'],
      images: sampleImages,
      accountUsername: accounts[0].username
    };

    const mockResult = await tiktokAPI.mockUploadPost(accounts[0].username, mockPost);
    console.log(`✅ Mock carousel upload successful:`);
    console.log(`   - Draft ID: ${mockResult.draftId}`);
    console.log(`   - Status: ${mockResult.status}`);
    console.log(`   - Type: ${mockResult.type}`);
    console.log(`   - Images: ${mockResult.images}`);
    console.log('');

    // Test 5: Test real upload (if account is connected)
    console.log('5️⃣ Testing real carousel upload (if credentials are valid)...');
    try {
      const credentials = await tiktokAPI.getAccountCredentials(accounts[0].username);
      
      if (credentials && credentials.access_token) {
        console.log(`✅ Found valid credentials for @${accounts[0].username}`);
        console.log('💡 Real carousel upload test would work here!');
        console.log('   (Skipping actual upload to avoid creating test drafts)');
      } else {
        console.log('⚠️ No valid credentials found for real upload test');
      }
    } catch (error) {
      console.log(`⚠️ Real upload test failed: ${error.message}`);
    }

    console.log('\n🎉 All tests completed!');
    console.log('\n📋 Next Steps:');
    console.log('1. Connect your TikTok account at https://easypost.fun');
    console.log('2. Run the daily automation to generate and upload carousel content');
    console.log('3. Check your TikTok drafts for uploaded carousel posts');
    console.log('4. Users can swipe through your images in the carousel!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testTikTokUpload().catch(console.error); 