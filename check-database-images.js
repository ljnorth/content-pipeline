import { SupabaseClient } from './src/database/supabase-client.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const db = new SupabaseClient();

async function checkDatabaseImages() {
  try {
    console.log('🔍 Checking database images...\n');
    
    // Get all images
    const { data: images, error } = await db.client
      .from('images')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching images:', error);
      return;
    }
    
    console.log(`📊 Total images in database: ${images.length}\n`);
    
    // Group by storage type
    const storageImages = images.filter(img => img.image_path?.startsWith('http'));
    const localImages = images.filter(img => !img.image_path?.startsWith('http'));
    
    console.log(`✅ Storage images (public URLs): ${storageImages.length}`);
    console.log(`❌ Local path images: ${localImages.length}\n`);
    
    // Show recent images
    console.log('📝 Recent images:');
    console.log('================');
    
    const recentImages = images.slice(0, 10);
    recentImages.forEach((img, index) => {
      const isStorage = img.image_path?.startsWith('http');
      const icon = isStorage ? '✅' : '❌';
      const type = isStorage ? 'STORAGE' : 'LOCAL';
      
      console.log(`${index + 1}. ${icon} [${type}] ${img.username} - ${img.post_id}`);
      console.log(`   Path: ${img.image_path?.substring(0, 80)}...`);
      console.log(`   Created: ${new Date(img.created_at).toLocaleString()}\n`);
    });
    
    // Show post count
    const { data: posts } = await db.client
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });
    
    console.log(`📊 Total posts in database: ${posts?.length || 0}`);
    
    // Show account status
    const { data: accounts } = await db.client
      .from('accounts')
      .select('*');
    
    console.log(`📊 Total accounts in database: ${accounts?.length || 0}`);
    accounts?.forEach(acc => {
      console.log(`   - ${acc.username} (last scraped: ${acc.last_scraped ? new Date(acc.last_scraped).toLocaleString() : 'never'})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkDatabaseImages(); 