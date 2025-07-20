import { SupabaseStorage } from './src/utils/supabase-storage.js';
import fs from 'fs';
import path from 'path';

async function testStorageUpload() {
  console.log('🔍 Testing Storage Upload with Real Image...');
  
  try {
    const storage = new SupabaseStorage();
    
    // Test with an actual image from your temp directory
    const testImagePath = './temp/my.darling.g/7129628226946632965/7129628226946632965_frame_001.jpg';
    
    if (!fs.existsSync(testImagePath)) {
      console.error('❌ Test image not found:', testImagePath);
      return;
    }
    
    console.log('📁 Found test image:', testImagePath);
    console.log('📊 File size:', fs.statSync(testImagePath).size, 'bytes');
    
    // Test upload
    console.log('📤 Uploading test image...');
    const result = await storage.uploadImage(
      testImagePath,
      'test_user',
      'test_post_123',
      'test_frame_001.jpg'
    );
    
    console.log('✅ Upload successful!');
    console.log('🔗 Public URL:', result.publicUrl);
    console.log('📁 Storage path:', result.storagePath);
    
    // Test listing files
    console.log('\n📋 Listing files in bucket...');
    const files = await storage.listFiles();
    console.log('📄 Files in bucket:', files);
    
    // Clean up
    console.log('\n🧹 Cleaning up test file...');
    await storage.deleteImage(result.storagePath);
    console.log('✅ Cleanup complete!');
    
  } catch (error) {
    console.error('❌ Storage test failed:', error.message);
    console.error('🔍 Full error:', error);
  }
}

testStorageUpload(); 