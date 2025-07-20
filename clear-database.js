import { SupabaseClient } from './src/database/supabase-client.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const db = new SupabaseClient();

async function clearDatabase() {
  try {
    console.log('🧹 Clearing database for fresh pipeline run...\n');
    
    // Get current counts
    const { data: images } = await db.client.from('images').select('id');
    const { data: posts } = await db.client.from('posts').select('id');
    
    console.log(`📊 Current database state:`);
    console.log(`   - Images: ${images?.length || 0}`);
    console.log(`   - Posts: ${posts?.length || 0}\n`);
    
    if (!images?.length && !posts?.length) {
      console.log('✅ Database is already empty!');
      return;
    }
    
    // Confirm deletion
    console.log('⚠️  This will DELETE ALL images and posts from the database.');
    console.log('   Account records will be preserved.\n');
    
    // Delete images first (due to foreign key constraints)
    console.log('🗑️  Deleting images...');
    const { error: imagesError } = await db.client
      .from('images')
      .delete()
      .neq('id', 0); // Delete all records
    
    if (imagesError) {
      console.error('❌ Failed to delete images:', imagesError);
      return;
    }
    
    // Delete posts
    console.log('🗑️  Deleting posts...');
    const { error: postsError } = await db.client
      .from('posts')
      .delete()
      .neq('id', 0); // Delete all records
    
    if (postsError) {
      console.error('❌ Failed to delete posts:', postsError);
      return;
    }
    
    console.log('✅ Database cleared successfully!\n');
    
    // Verify deletion
    const { data: remainingImages } = await db.client.from('images').select('id');
    const { data: remainingPosts } = await db.client.from('posts').select('id');
    
    console.log(`📊 After cleanup:`);
    console.log(`   - Images: ${remainingImages?.length || 0}`);
    console.log(`   - Posts: ${remainingPosts?.length || 0}\n`);
    
    if (remainingImages?.length === 0 && remainingPosts?.length === 0) {
      console.log('🎉 Database is now ready for a fresh pipeline run!');
      console.log('   You can now run the full pipeline from the web UI.');
    } else {
      console.log('⚠️  Some records may still remain. Check manually.');
    }
    
  } catch (error) {
    console.error('❌ Error clearing database:', error.message);
  }
}

clearDatabase(); 