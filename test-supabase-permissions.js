import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

console.log('🔍 Testing Supabase Permissions & Authentication...');
console.log('URL:', supabaseUrl);
console.log('Key exists:', !!supabaseAnonKey);

// Test with anon key
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testPermissions() {
  try {
    console.log('\n=== Testing with ANON Key ===');
    
    // Test 1: Try to list buckets with anon key
    console.log('📦 Testing bucket listing with anon key...');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      console.error('❌ Bucket listing failed:', bucketError.message);
      console.error('Error code:', bucketError.status);
      console.error('Full error:', bucketError);
    } else {
      console.log('✅ Bucket listing successful!');
      console.log('📁 Found buckets:', buckets.map(b => b.name));
    }
    
    // Test 2: Try to access fashion-images bucket directly
    console.log('\n📄 Testing direct bucket access...');
    const { data: files, error: listError } = await supabase.storage
      .from('fashion-images')
      .list();
    
    if (listError) {
      console.error('❌ Direct bucket access failed:', listError.message);
      console.error('Error code:', listError.status);
      console.error('Full error:', listError);
    } else {
      console.log('✅ Direct bucket access successful!');
      console.log(`📄 Found ${files.length} files/directories`);
    }
    
    // Test 3: Try to get bucket info
    console.log('\n🔍 Testing bucket info...');
    const { data: bucketInfo, error: infoError } = await supabase.storage
      .getBucket('fashion-images');
    
    if (infoError) {
      console.error('❌ Bucket info failed:', infoError.message);
      console.error('Error code:', infoError.status);
      console.error('Full error:', infoError);
    } else {
      console.log('✅ Bucket info successful!');
      console.log('📋 Bucket details:', bucketInfo);
    }
    
    // Test 4: Test a simple upload to see what happens
    console.log('\n📤 Testing simple upload...');
    const testContent = 'Hello World';
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('fashion-images')
      .upload('test-file.txt', testContent, {
        contentType: 'text/plain',
        upsert: true
      });
    
    if (uploadError) {
      console.error('❌ Test upload failed:', uploadError.message);
      console.error('Error code:', uploadError.status);
      console.error('Full error:', uploadError);
    } else {
      console.log('✅ Test upload successful!');
      console.log('📤 Upload result:', uploadData);
      
      // Clean up test file
      const { error: deleteError } = await supabase.storage
        .from('fashion-images')
        .remove(['test-file.txt']);
      
      if (deleteError) {
        console.log('⚠️ Could not clean up test file:', deleteError.message);
      } else {
        console.log('🧹 Test file cleaned up');
      }
    }
    
    // Test 5: Check authentication status
    console.log('\n🔐 Testing authentication status...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('❌ Auth check failed:', authError.message);
    } else {
      console.log('👤 Current user:', user ? user.email : 'Anonymous');
    }
    
  } catch (error) {
    console.error('❌ Permission test failed:', error.message);
    console.error('Full error:', error);
  }
}

testPermissions(); 