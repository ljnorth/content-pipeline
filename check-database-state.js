import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkDatabaseState() {
  console.log('🔍 Checking actual database state...');
  
  // Check for NULL values (never processed)
  const { count: nullCount, error: nullError } = await supabase
    .from('images')
    .select('*', { count: 'exact', head: true })
    .is('is_cover_slide', null);
    
  // Check for false values (processed, not hook slides)
  const { count: falseCount, error: falseError } = await supabase
    .from('images')
    .select('*', { count: 'exact', head: true })
    .eq('is_cover_slide', false);
    
  // Check for true values (processed, are hook slides)
  const { count: trueCount, error: trueError } = await supabase
    .from('images')
    .select('*', { count: 'exact', head: true })
    .eq('is_cover_slide', true);
    
  console.log('📊 Database state:');
  console.log('  🔍 Never processed (NULL):', nullCount || 'Error');
  console.log('  ❌ Processed, not hook slides (false):', falseCount || 'Error');
  console.log('  ✅ Processed, are hook slides (true):', trueCount || 'Error');
  
  // Show some sample records
  const { data: samples, error: sampleError } = await supabase
    .from('images')
    .select('post_id, is_cover_slide, cover_slide_text')
    .limit(5);
    
  if (!sampleError && samples) {
    console.log('\n📋 Sample records:');
    samples.forEach(img => {
      const status = img.is_cover_slide === null ? 'NULL' : img.is_cover_slide ? 'TRUE' : 'FALSE';
      console.log(`  ${status}: ${img.post_id} - ${img.cover_slide_text || 'null'}`);
    });
  }
}

checkDatabaseState().catch(console.error); 