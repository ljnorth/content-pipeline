import dotenv from 'dotenv';
import { SupabaseClient } from './src/database/supabase-client.js';

dotenv.config();

async function testQuery() {
  try {
    const db = new SupabaseClient();
    
    // Test the exact query from the main script
    const { data: images, error, count } = await db.client
      .from('images')
      .select('id, image_path, post_id, username', { count: 'exact' })
      .not('image_path', 'is', null)
      .limit(10000);
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log('📊 Total images found:', count || images.length);
    console.log('📝 Sample image paths:');
    
    if (images && images.length > 0) {
      images.slice(0, 5).forEach((img, i) => {
        console.log(`  ${i+1}. ID: ${img.id}, Path: ${img.image_path.substring(0, 60)}...`);
      });
    }
    
    // Check if paths are Supabase URLs
    const supabaseUrls = images.filter(img => img.image_path?.startsWith('http'));
    const localPaths = images.filter(img => !img.image_path?.startsWith('http'));
    
    console.log(`\n📈 URL types:`);
    console.log(`  ✅ Supabase URLs: ${supabaseUrls.length}`);
    console.log(`  📁 Local paths: ${localPaths.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testQuery(); 