import { SupabaseClient } from './src/database/supabase-client.js';

const db = new SupabaseClient();

async function checkRemainingImages() {
  try {
    console.log('�� Checking remaining unanalyzed images...\n');
    
    // Get total images
    const { data: totalImages } = await db.client
      .from('images')
      .select('id');
    
    // Get analyzed images (have aesthetic data)
    const { data: analyzedImages } = await db.client
      .from('images')
      .select('id')
      .not('aesthetic', 'is', null);
    
    // Get unanalyzed images (no aesthetic data)
    const { data: unanalyzedImages } = await db.client
      .from('images')
      .select('id')
      .is('aesthetic', null);
    
    console.log('📊 Current Status:');
    console.log('==================');
    console.log(`✅ Total images in database: ${totalImages?.length || 0}`);
    console.log(`✅ Images analyzed: ${analyzedImages?.length || 0}`);
    console.log(`⏳ Images remaining: ${unanalyzedImages?.length || 0}`);
    
    if (unanalyzedImages?.length > 0) {
      const remainingPercent = ((unanalyzedImages.length / totalImages.length) * 100).toFixed(1);
      console.log(`�� Progress: ${(100 - remainingPercent).toFixed(1)}% complete`);
      
      // Calculate time estimate
      const avgTimePerImage = 2.5; // seconds
      const totalSeconds = unanalyzedImages.length * avgTimePerImage;
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      
      console.log(`⏱️  Estimated time remaining: ${hours}h ${minutes}m`);
      console.log(`💰 Estimated cost remaining: $${(unanalyzedImages.length * 0.00256).toFixed(2)}`);
    } else {
      console.log('🎉 All images have been analyzed!');
    }
    
  } catch (error) {
    console.error('❌ Error checking images:', error);
  }
}

checkRemainingImages(); 