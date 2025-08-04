import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkColumnDefaults() {
  console.log('🔍 Investigating what happened when we added the new columns...');
  
  // Check if the column was added with a default value that auto-populated existing rows
  const { data: sample, error } = await supabase
    .from('images')
    .select('post_id, is_cover_slide, cover_slide_text')
    .order('post_id')
    .limit(10);
    
  if (!error && sample) {
    console.log('📋 Sample of existing records:');
    sample.forEach(img => {
      const status = img.is_cover_slide === null ? 'NULL' : img.is_cover_slide ? 'TRUE' : 'FALSE';
      console.log(`  ${status}: ${img.post_id} - text: ${img.cover_slide_text || 'null'}`);
    });
  }
  
  console.log('\n🤔 Analysis:');
  console.log('When we ran: ALTER TABLE public.images ADD COLUMN IF NOT EXISTS is_cover_slide BOOLEAN DEFAULT false;');
  console.log('This likely set ALL existing rows to false automatically.');
  console.log('So the 7,940 false values are NOT from processing - they are from the default value!');
  
  console.log('\n💡 Solution:');
  console.log('We need to reset ALL existing images to NULL so we can properly track what has been processed.');
  console.log('Only the 48 images we manually reset are currently NULL and ready for processing.');
}

checkColumnDefaults().catch(console.error); 