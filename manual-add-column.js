import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addColumnManually() {
  console.log('🔧 Manually adding item_preference column...');
  console.log('');
  console.log('📋 Please copy and paste this SQL into your Supabase SQL Editor:');
  console.log('');
  console.log('-- Add item_preference column for Phase 2.3');
  console.log('ALTER TABLE public.images ADD COLUMN IF NOT EXISTS item_preference TEXT DEFAULT NULL;');
  console.log('');
  console.log('-- Add index for performance');
  console.log('CREATE INDEX IF NOT EXISTS idx_images_item_preference ON public.images(item_preference);');
  console.log('');
  console.log('🌐 Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql');
  console.log('');

  // Try to test if column exists by doing a simple select
  console.log('🔍 Testing if column already exists...');
  
  try {
    const { data, error } = await supabase
      .from('images')
      .select('item_preference')
      .limit(1);

    if (error && error.code === '42703') {
      console.log('❌ Column does not exist yet - please run the SQL above');
      console.log('');
      console.log('After running the SQL, test the item preference analysis with:');
      console.log('node run-item-preference-analysis.js --limit=10');
    } else if (error) {
      console.error('❌ Unexpected error:', error);
    } else {
      console.log('✅ Column already exists! Ready to run item preference analysis.');
      console.log('');
      console.log('Run the analysis with:');
      console.log('node run-item-preference-analysis.js --limit=10');
    }

  } catch (err) {
    console.error('❌ Script error:', err.message);
  }
}

addColumnManually(); 