import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkHookSlides() {
  console.log('🔍 Checking for hook slides in database...');
  
  // Check for actual hook slides (is_cover_slide = true)
  const { data, error } = await supabase
    .from('images')
    .select('post_id, is_cover_slide, cover_slide_text')
    .eq('is_cover_slide', true)
    .limit(10);
    
  if (error) {
    console.log('❌ Database error:', error.message);
  } else {
    console.log('✅ Hook slides found in database:', data?.length || 0);
    data?.forEach(img => {
      console.log(`  📸 ${img.post_id}: "${img.cover_slide_text}"`);
    });
  }
  
  // Check recent processed images (both true and false)
  const { data: recent, error: recentError } = await supabase
    .from('images')
    .select('post_id, is_cover_slide, cover_slide_text')
    .not('is_cover_slide', 'is', null)
    .order('post_id', { ascending: false })
    .limit(10);
    
  if (!recentError && recent) {
    console.log('\n📋 Recent hook slide checks:');
    recent.forEach(img => {
      const status = img.is_cover_slide ? '✅ HOOK SLIDE' : '❌ Not hook slide';
      console.log(`  ${status}: ${img.post_id} - "${img.cover_slide_text || 'null'}"`);
    });
  }
  
  // Check how many total images have been processed
  const { count, error: countError } = await supabase
    .from('images')
    .select('*', { count: 'exact', head: true })
    .not('is_cover_slide', 'is', null);
    
  if (!countError) {
    console.log(`\n📊 Total images processed for hook slides: ${count}`);
  }
  
  // Check how many are still unprocessed
  const { count: unprocessedCount, error: unprocessedError } = await supabase
    .from('images')
    .select('*', { count: 'exact', head: true })
    .is('is_cover_slide', null);
    
  if (!unprocessedError) {
    console.log(`📊 Images still unprocessed: ${unprocessedCount}`);
  }
}

checkHookSlides().catch(console.error);
