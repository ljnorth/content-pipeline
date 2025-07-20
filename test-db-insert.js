import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Testing Database Insert...');
console.log('URL:', supabaseUrl);
console.log('Service Role Key exists:', !!supabaseServiceRoleKey);

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function testInsert() {
  try {
    console.log('\n📝 Testing database insert...');
    
    // First, let's insert a test account
    const testUsername = 'test_account_' + Date.now();
    
    console.log('📤 Inserting test account...');
    const { data: accountData, error: accountError } = await supabase
      .from('accounts')
      .insert([{
        username: testUsername,
        url: 'https://example.com/test',
        last_scraped: new Date().toISOString()
      }])
      .select();

    if (accountError) {
      console.error('❌ Account insert failed:', accountError);
      return false;
    }

    console.log('✅ Account insert successful!');
    console.log('📊 Account data:', accountData);

    // Now insert a test post
    const testPostId = 'test_post_' + Date.now();
    
    console.log('📤 Inserting test post...');
    const { data: postData, error: postError } = await supabase
      .from('posts')
      .insert([{
        username: testUsername,
        post_id: testPostId,
        post_timestamp: new Date().toISOString(),
        like_count: 100,
        comment_count: 10,
        view_count: 1000,
        save_count: 5,
        engagement_rate: 0.15,
        text: 'This is a test post to verify database insertion',
        web_video_url: 'https://example.com/video.mp4'
      }])
      .select();

    if (postError) {
      console.error('❌ Post insert failed:', postError);
      // Clean up account
      await supabase.from('accounts').delete().eq('username', testUsername);
      return false;
    }

    console.log('✅ Post insert successful!');
    console.log('📊 Post data:', postData);

    // Now try to retrieve the inserted post
    console.log('\n🔍 Retrieving inserted post...');
    const { data: retrievedData, error: retrieveError } = await supabase
      .from('posts')
      .select('*')
      .eq('post_id', testPostId)
      .single();

    if (retrieveError) {
      console.error('❌ Retrieve failed:', retrieveError);
      // Clean up
      await supabase.from('posts').delete().eq('post_id', testPostId);
      await supabase.from('accounts').delete().eq('username', testUsername);
      return false;
    }

    console.log('✅ Retrieve successful!');
    console.log('📊 Retrieved data:', retrievedData);

    // Test image insert
    console.log('\n📤 Testing image insert...');
    const { data: imageData, error: imageError } = await supabase
      .from('images')
      .insert([{
        username: testUsername,
        post_id: testPostId,
        image_path: 'test/image.jpg',
        image_index: 1,
        image_type: 'frame',
        aesthetic: 'minimalist',
        colors: ['#000000', '#ffffff'],
        season: 'spring',
        occasion: 'casual',
        analysis: { test: 'analysis data' },
        additional: { test: 'additional data' }
      }])
      .select();

    if (imageError) {
      console.error('❌ Image insert failed:', imageError);
    } else {
      console.log('✅ Image insert successful!');
      console.log('📊 Image data:', imageData);
    }

    // Clean up - delete test data
    console.log('\n🧹 Cleaning up test data...');
    
    // Delete images first (due to foreign key constraints)
    await supabase.from('images').delete().eq('post_id', testPostId);
    
    // Delete post
    const { error: deletePostError } = await supabase
      .from('posts')
      .delete()
      .eq('post_id', testPostId);

    if (deletePostError) {
      console.error('❌ Post cleanup failed:', deletePostError);
    } else {
      console.log('✅ Post cleanup successful!');
    }

    // Delete account
    const { error: deleteAccountError } = await supabase
      .from('accounts')
      .delete()
      .eq('username', testUsername);

    if (deleteAccountError) {
      console.error('❌ Account cleanup failed:', deleteAccountError);
    } else {
      console.log('✅ Account cleanup successful!');
    }

    return true;

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return false;
  }
}

// Run the test
testInsert().then(success => {
  if (success) {
    console.log('\n🎉 Database insert test PASSED!');
    console.log('✅ Your pipeline should now work correctly.');
    console.log('\n🚀 You can now run: npm run pipeline');
  } else {
    console.log('\n❌ Database insert test FAILED!');
    console.log('🔧 Please check your Supabase configuration.');
  }
}); 