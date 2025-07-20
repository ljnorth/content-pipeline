import { DatabaseStorage } from './src/stages/database-storage.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

async function testDatabaseStorage() {
  console.log('🧪 Testing Database Storage...');
  
  try {
    const dbStorage = new DatabaseStorage();
    
    // Test with a real image from temp directory
    const testPosts = [{
      username: 'my.darling.g',
      post_id: 'test-post-123',
      image_paths: ['temp/my.darling.g/7383702753819757856/7383702753819757856_slide_1.jpg'],
      image_analyses: [{
        aesthetic: 'minimalist',
        colors: ['white', 'black'],
        occasion: 'casual',
        season: 'summer'
      }]
    }];
    
    console.log('📤 Processing test post with storage upload...');
    const result = await dbStorage.process(testPosts);
    
    console.log('✅ Database storage test completed:');
    console.log('   - Success count:', result.successCount);
    console.log('   - Error count:', result.errorCount);
    
    if (result.successCount > 0) {
      console.log('✅ Storage upload and database storage working correctly!');
    } else {
      console.log('❌ Storage upload failed - this is expected behavior now (no fallback)');
    }
    
  } catch (error) {
    console.log('❌ Database storage test failed:', error.message);
    console.log('   This is expected if storage upload fails (no local fallback)');
  }
}

testDatabaseStorage(); 