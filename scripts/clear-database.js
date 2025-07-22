import { SupabaseClient } from '../src/database/supabase-client.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const db = new SupabaseClient();

async function clearDatabase() {
  try {
    console.log('🗑️ Clearing database...\n');
    
    // Clear tables in order (respecting foreign key constraints)
    const tables = [
      'generated_posts',
      'hook_slides', 
      'background_colors',
      'images',
      'posts',
      'accounts'
    ];
    
    for (const table of tables) {
      console.log(`🗑️ Clearing ${table}...`);
      const { error } = await db.client
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all but dummy record
      
      if (error) {
        console.error(`❌ Error clearing ${table}:`, error);
      } else {
        console.log(`✅ Cleared ${table}`);
      }
    }
    
    console.log('\n🎉 Database cleared successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

clearDatabase(); 