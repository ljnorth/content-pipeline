import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

console.log('🔍 Testing Supabase Connection...');
console.log('URL:', supabaseUrl);
console.log('Key exists:', !!supabaseAnonKey);
console.log('Key starts with:', supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + '...' : 'N/A');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  try {
    // Test 1: Check if we can access storage
    console.log('\n📦 Testing storage access...');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      console.error('❌ Storage access failed:', bucketError.message);
      console.error('Full error:', bucketError);
      return;
    }
    
    console.log('✅ Storage access successful!');
    console.log('📁 Available buckets:', buckets.map(b => b.name));
    
    // Test 2: Check if fashion-images bucket exists
    const fashionBucket = buckets.find(b => b.name === 'fashion-images');
    if (fashionBucket) {
      console.log('✅ fashion-images bucket found!');
      console.log('📋 Bucket details:', {
        name: fashionBucket.name,
        id: fashionBucket.id,
        public: fashionBucket.public,
        created_at: fashionBucket.created_at
      });
      
      // Test 3: Try to list files in the bucket
      console.log('\n📄 Testing bucket file listing...');
      const { data: files, error: listError } = await supabase.storage
        .from('fashion-images')
        .list();
      
      if (listError) {
        console.error('❌ Cannot list files:', listError.message);
        console.error('Full error:', listError);
      } else {
        console.log(`✅ Bucket accessible! Found ${files.length} files/directories`);
        if (files.length > 0) {
          console.log('📄 Sample files:');
          files.slice(0, 5).forEach(file => {
            console.log(`   - ${file.name} (${file.metadata?.size || 'N/A'} bytes)`);
          });
        } else {
          console.log('📁 Bucket is empty (no files found)');
        }
      }
    } else {
      console.log('❌ fashion-images bucket not found');
      console.log('💡 Available buckets:', buckets.map(b => b.name));
      console.log('💡 You may need to create the fashion-images bucket in your Supabase dashboard');
    }
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    console.error('Full error:', error);
  }
}

testConnection(); 