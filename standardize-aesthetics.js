import { SupabaseClient } from './src/database/supabase-client.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const db = new SupabaseClient();

// Standardized aesthetic taxonomy
const AESTHETIC_MAPPING = {
  // Streetwear variations
  'streetwear': ['Streetwear', 'Casual Streetwear', 'casual streetwear', 'Eclectic Streetwear', 'eclectic streetwear', 'edgy streetwear'],
  
  // Casual variations  
  'casual': ['Casual', 'casual', 'Casual Chic', 'casual chic', 'Chic Casual', 'Eclectic Casual', 'Glamorous Casual', 'edgy casual', 'feminine casual'],
  
  // Downtown/Urban
  'urban': ['downtown boy', 'downtown girl'],
  
  // Vintage variations
  'vintage': ['Casual Vintage', 'Eclectic Vintage', 'retro'],
  
  // Chic variations
  'chic': ['edgy chic', 'Edgy Chic', 'feminine chic', 'Eclectic Chic', 'playful chic', 'grunge chic'],
  
  // Y2K variations
  'y2k': ['Y2K', 'Y2K Glam'],
  
  // Grunge
  'grunge': ['Casual Grunge'],
  
  // Athleisure/Sporty
  'athleisure': ['Athleisure', 'Casual Sporty'],
  
  // Minimalist
  'minimalist': ['minimalist', 'Floral Minimalism'],
  
  // Floral
  'floral': ['Floral', 'floral', 'Floral Elegance'],
  
  // Preppy
  'preppy': ['preppy'],
  
  // Glamorous
  'glamorous': ['Glamorous Western'],
  
  // Coastal
  'coastal': ['coastal'],
  
  // Lingerie
  'lingerie': ['lingerie']
};

// Create reverse mapping for quick lookup
const REVERSE_MAPPING = {};
Object.entries(AESTHETIC_MAPPING).forEach(([standard, variations]) => {
  variations.forEach(variation => {
    REVERSE_MAPPING[variation] = standard;
  });
});

async function standardizeAesthetics() {
  try {
    console.log('🔄 Standardizing aesthetic variations...\n');
    
    // Get all images with aesthetics
    const { data: images, error } = await db.client
      .from('images')
      .select('id, aesthetic')
      .not('aesthetic', 'is', null);
    
    if (error) {
      console.error('❌ Error fetching images:', error);
      return;
    }
    
    console.log(`📊 Found ${images.length} images with aesthetics\n`);
    
    // Group images by what they'll be standardized to
    const standardizationGroups = {};
    const unmapped = [];
    
    images.forEach(img => {
      const standardized = REVERSE_MAPPING[img.aesthetic];
      if (standardized) {
        if (!standardizationGroups[standardized]) {
          standardizationGroups[standardized] = [];
        }
        standardizationGroups[standardized].push(img);
      } else {
        unmapped.push(img);
      }
    });
    
    console.log('📋 Standardization plan:');
    console.log('=======================');
    
    Object.entries(standardizationGroups).forEach(([standard, imgs]) => {
      const variations = [...new Set(imgs.map(img => img.aesthetic))];
      console.log(`✅ ${standard} (${imgs.length} images)`);
      console.log(`   From: ${variations.join(', ')}\n`);
    });
    
    if (unmapped.length > 0) {
      console.log('⚠️  Unmapped aesthetics (will keep as-is):');
      const unmappedAesthetics = [...new Set(unmapped.map(img => img.aesthetic))];
      unmappedAesthetics.forEach(aesthetic => {
        const count = unmapped.filter(img => img.aesthetic === aesthetic).length;
        console.log(`   - ${aesthetic} (${count} images)`);
      });
      console.log('');
    }
    
    // Ask for confirmation
    console.log('🤔 Do you want to proceed with standardization? (y/n)');
    console.log('   This will update the database with standardized aesthetic names.');
    
    // For now, let's just show the plan. In production, you'd want user input here.
    console.log('\n📝 To proceed, run: node standardize-aesthetics.js --execute');
    
    // If --execute flag is passed, actually do the updates
    if (process.argv.includes('--execute')) {
      console.log('\n🚀 Executing standardization...');
      
      let updatedCount = 0;
      
      for (const [standard, imgs] of Object.entries(standardizationGroups)) {
        console.log(`\n📝 Updating ${imgs.length} images to "${standard}"...`);
        
        const imageIds = imgs.map(img => img.id);
        
        // Update in batches of 100
        for (let i = 0; i < imageIds.length; i += 100) {
          const batch = imageIds.slice(i, i + 100);
          
          const { error: updateError } = await db.client
            .from('images')
            .update({ aesthetic: standard })
            .in('id', batch);
          
          if (updateError) {
            console.error(`❌ Error updating batch: ${updateError.message}`);
          } else {
            updatedCount += batch.length;
            console.log(`   ✅ Updated ${batch.length} images`);
          }
        }
      }
      
      console.log(`\n🎉 Standardization complete!`);
      console.log(`   - Updated: ${updatedCount} images`);
      console.log(`   - Unmapped: ${unmapped.length} images (kept as-is)`);
      
      // Show final summary
      const finalAesthetics = [...new Set([
        ...Object.keys(standardizationGroups),
        ...unmapped.map(img => img.aesthetic)
      ])];
      
      console.log(`   - Total unique aesthetics: ${finalAesthetics.length} (down from 40)`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

standardizeAesthetics(); 