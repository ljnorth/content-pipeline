import { SupabaseClient } from '../database/supabase-client.js';

export class AestheticsAnalytics {
  constructor() {
    this.db = new SupabaseClient();
  }

  async analyzeAesthetics() {
    try {
      console.log('🔍 Analyzing current aesthetic variations...\n');
      
      // Get all images with aesthetics
      const { data: images, error } = await this.db.client
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

      return {
        totalImages: images.length,
        uniqueAesthetics: sortedAesthetics.length,
        aestheticCounts: aestheticCounts,
        sortedAesthetics: sortedAesthetics,
        variations: variations
      };
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      throw error;
    }
  }
} 