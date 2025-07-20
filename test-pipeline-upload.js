import { SupabaseStorage } from './src/utils/supabase-storage.js';
import fs from 'fs';
import path from 'path';

async function testPipelineUpload() {
  console.log('🔍 Testing Pipeline-Style Upload...');
  
  try {
    const storage = new SupabaseStorage();
    
    // Use the exact same path format as your pipeline
    const localImagePath = '/Users/LavanceNorthington/content pipeline/temp/my.darling.g/7164867785338670342/7164867785338670342_frame_001.jpg';
    
    console.log('📁 Testing with pipeline path:', localImagePath);
    
    // Check if file exists
    if (!fs.existsSync(localImagePath)) {
      console.error('❌ File not found:', localImagePath);
      console.log('🔍 Let\'s check what files exist:');
      
      const dir = path.dirname(localImagePath);
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        console.log('📁 Files in directory:', files);
      } else {
        console.log('❌ Directory doesn\'t exist:', dir);
      }
      return;
    }
    
    console.log('✅ File exists');
    console.log('📊 File size:', fs.statSync(localImagePath).size, 'bytes');
    
    // Extract filename exactly like the pipeline does
    const filename = localImagePath.split('/').pop();
    console.log('📝 Extracted filename:', filename);
    
    // Test upload exactly like the pipeline
    console.log('📤 Uploading with pipeline parameters...');
    const result = await storage.uploadImage(
      localImagePath,
      'my.darling.g',
      '7164867785338670342',
      filename
    );
    
    console.log('✅ Upload successful!');
    console.log('🔗 Public URL:', result.publicUrl);
    console.log('📁 Storage path:', result.storagePath);
    
    // Test listing to see if it appears
    console.log('\n📋 Checking if file appears in bucket...');
    const files = await storage.listFiles('my.darling.g');
    console.log('📄 Files under my.darling.g:', files);
    
    // Clean up
    console.log('\n🧹 Cleaning up test file...');
    await storage.deleteImage(result.storagePath);
    console.log('✅ Cleanup complete!');
    
  } catch (error) {
    console.error('❌ Pipeline upload test failed:', error.message);
    console.error('🔍 Full error:', error);
    console.error('🔍 Error stack:', error.stack);
  }
}

testPipelineUpload(); 