import dotenv from 'dotenv';
import { SupabaseClient } from './src/database/supabase-client.js';

// Load environment variables
dotenv.config();

const db = new SupabaseClient();

async function checkImageSchema() {
  try {
    console.log('🔍 Checking current images table schema...\n');
    
    // Get sample image to see current schema
    const { data: images } = await db.client
      .from('images')
      .select('*')
      .limit(1);
    
    if (images && images.length > 0) {
      console.log('📊 Current images table fields:');
      console.log('===============================');
      Object.keys(images[0]).forEach(key => {
        const value = images[0][key];
        const type = typeof value;
        const isNull = value === null ? ' (null)' : '';
        console.log(`  ✓ ${key}: ${type}${isNull}`);
      });
    }
    
    // Get total count
    const { count } = await db.client
      .from('images')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\n📈 Total images in database: ${count}`);
    
    // Check if hook slide fields exist
    console.log('\n🎯 Checking for hook slide fields...');
    const hookFields = ['is_hook_slide', 'hook_confidence', 'hook_theme', 'hook_text'];
    const existingFields = Object.keys(images?.[0] || {});
    
    hookFields.forEach(field => {
      const exists = existingFields.includes(field);
      console.log(`  ${exists ? '✅' : '❌'} ${field}: ${exists ? 'EXISTS' : 'MISSING'}`);
    });
    
    // Check for background color fields
    console.log('\n🎨 Checking for background color fields...');
    const bgFields = ['primary_bg_color', 'bg_type', 'bg_brightness', 'suitable_for_matching'];
    
    bgFields.forEach(field => {
      const exists = existingFields.includes(field);
      console.log(`  ${exists ? '✅' : '❌'} ${field}: ${exists ? 'EXISTS' : 'MISSING'}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkImageSchema(); 