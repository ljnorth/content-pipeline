import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Testing Service Role Key...');
console.log('URL:', supabaseUrl);
console.log('Service Role Key exists:', !!supabaseServiceRoleKey);

if (!supabaseUrl) {
  console.error('❌ SUPABASE_URL not set');
  process.exit(1);
}

if (!supabaseServiceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
  console.log('');
  console.log('🔧 To fix this:');
  console.log('1. Go to your Supabase dashboard: https://oxskatabfilwdufzqdzd.supabase.co');
  console.log('2. Go to Settings → API');
  console.log('3. Find the "service_role" key (different from anon key)');
  console.log('4. Add this to your .env file:');
  console.log('   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here');
  console.log('');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

async function testServiceRole() {
  try {
    console.log('\n=== Testing with SERVICE ROLE Key ===');
    
    // Test 1: List buckets with service role
    console.log('📦 Testing bucket listing with service role...');
    const { data: buckets, error: bucketError } = await supabaseAdmin.storage.listBuckets();
    
    if (bucketError) {
      console.error('❌ Bucket listing failed:', bucketError.message);
      console.error('Full error:', bucketError);
      return;
    }
    
    console.log('✅ Bucket listing successful!');
    console.log('📁 Found buckets:', buckets.map(b => b.name));
    
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
      
      // Test 3: List files in the bucket
      console.log('\n📄 Testing bucket file listing...');
      const { data: files, error: listError } = await supabaseAdmin.storage
        .from('fashion-images')
        .list();
      
      if (listError) {
        console.error('❌ File listing failed:', listError.message);
        console.error('Full error:', listError);
      } else {
        console.log(`✅ File listing successful! Found ${files.length} files/directories`);
        if (files.length > 0) {
          console.log('📄 Sample files:');
          files.slice(0, 5).forEach(file => {
            console.log(`   - ${file.name} (${file.metadata?.size || 'N/A'} bytes)`);
          });
        }
      }
      
      // Test 4: Test upload with service role
      console.log('\n📤 Testing upload with service role...');
      const testContent = 'Hello from service role!';
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('fashion-images')
        .upload('test-service-role.txt', testContent, {
          contentType: 'text/plain',
          upsert: true
        });
      
      if (uploadError) {
        console.error('❌ Upload failed:', uploadError.message);
        console.error('Full error:', uploadError);
      } else {
        console.log('✅ Upload successful!');
        console.log('📤 Upload result:', uploadData);
        
        // Test 5: Get public URL
        const { data: urlData } = supabaseAdmin.storage
          .from('fashion-images')
          .getPublicUrl('test-service-role.txt');
        
        console.log('🔗 Public URL:', urlData.publicUrl);
        
        // Clean up
        const { error: deleteError } = await supabaseAdmin.storage
          .from('fashion-images')
          .remove(['test-service-role.txt']);
        
        if (deleteError) {
          console.log('⚠️ Could not clean up test file:', deleteError.message);
        } else {
          console.log('🧹 Test file cleaned up');
        }
      }
      
    } else {
      console.log('❌ fashion-images bucket not found');
      console.log('💡 Available buckets:', buckets.map(b => b.name));
    }
    
  } catch (error) {
    console.error('❌ Service role test failed:', error.message);
    console.error('Full error:', error);
  }
}

testServiceRole(); 