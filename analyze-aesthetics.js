import { SupabaseClient } from './src/database/supabase-client.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const db = new SupabaseClient();

async function analyzeAesthetics() {
  try {
    console.log('🔍 Analyzing current aesthetic variations...\n');
    
    // Get all images with aesthetics
    const { data: images, error } = await db.client
      .from('images')
      .select('aesthetic')
      .not('aesthetic', 'is', null);
    
    if (error) {
      console.error('❌ Error fetching images:', error);
      return;
    }
    
    console.log(`📊 Total images with aesthetics: ${images.length}\n`);
    
    // Count aesthetic frequencies
    const aestheticCounts = {};
    images.forEach(img => {
      const aesthetic = img.aesthetic;
      aestheticCounts[aesthetic] = (aestheticCounts[aesthetic] || 0) + 1;
    });
    
    // Sort by frequency (most common first)
    const sortedAesthetics = Object.entries(aestheticCounts)
      .sort(([,a], [,b]) => b - a);
    
    console.log('📈 Current aesthetic variations (by frequency):');
    console.log('==============================================');
    
    sortedAesthetics.forEach(([aesthetic, count], i) => {
      const percentage = ((count / images.length) * 100).toFixed(1);
      console.log(`${i+1}. ${aesthetic} (${count} images, ${percentage}%)`);
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`   - Total unique aesthetics: ${sortedAesthetics.length}`);
    console.log(`   - Most common: ${sortedAesthetics[0][0]} (${sortedAesthetics[0][1]} images)`);
    console.log(`   - Least common: ${sortedAesthetics[sortedAesthetics.length-1][0]} (${sortedAesthetics[sortedAesthetics.length-1][1]} images)`);
    
    // Look for potential duplicates/variations
    console.log('\n🔍 Potential variations to standardize:');
    console.log('=====================================');
    
    const variations = {};
    sortedAesthetics.forEach(([aesthetic]) => {
      const base = aesthetic.toLowerCase().replace(/[^a-z]/g, '');
      if (!variations[base]) variations[base] = [];
      variations[base].push(aesthetic);
    });
    
    Object.entries(variations).forEach(([base, variants]) => {
      if (variants.length > 1) {
        console.log(`• ${base}: ${variants.join(', ')}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

analyzeAesthetics(); 