import dotenv from 'dotenv';
import { DatabaseStorage } from './src/stages/database-storage.js';

// Load environment variables
dotenv.config();

async function testDatabaseStorage() {
  try {
    console.log('🧪 Testing database storage...');
    
    const dbStorage = new DatabaseStorage();
    
    // Test data
    const testPost = {
      username: 'test_user',
      post_id: 'test_post_123',
      post_timestamp: new Date().toISOString(),
      like_count: 100,
      comment_count: 10,
      view_count: 1000,
      save_count: 5,
      engagement_rate: 11.5,
      video_path: '/path/to/video.mp4',
      text: 'Test post content',
      web_video_url: 'https://example.com/video',
      created_at: new Date().toISOString(),
      image_paths: ['/path/to/image1.jpg', '/path/to/image2.jpg'],
      image_analyses: [
        {
          aesthetic: 'casual',
          colors: ['blue', 'white'],
          season: 'summer',
          occasion: 'everyday',
          additional: ['comfortable', 'trendy']
        },
        {
          aesthetic: 'elegant',
          colors: ['black', 'gold'],
          season: 'winter',
          occasion: 'formal',
          additional: ['sophisticated', 'classic']
        }
      ]
    };
    
    console.log('📝 Test post data:', JSON.stringify(testPost, null, 2));
    
    // Test storing the post
    const result = await dbStorage.process([testPost]);
    
    console.log('✅ Test completed successfully!');
    console.log('📊 Result:', result);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('🔍 Full error:', error);
  }
}

testDatabaseStorage(); 