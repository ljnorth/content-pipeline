import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkDuplicates() {
  console.log('🔍 Checking for duplicate post_ids...');
  
  // Check how many rows exist for specific post_ids
  const testPostIds = ['7472108888821648662', '7129628226946632965', '7383702753819757856'];
  
  for (const postId of testPostIds) {
    const { count, error } = await supabase
      .from('images')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);
      
    if (!error) {
      console.log(`Post ID ${postId} - Found ${count} rows`);
    }
  }
  
  // Check total unique post_ids vs total rows
  const { data: uniquePostIds } = await supabase
    .from('images')
    .select('post_id')
    .limit(1000);
    
  if (uniquePostIds) {
    const unique = new Set(uniquePostIds.map(row => row.post_id));
    console.log('\n📊 Sample data analysis:');
    console.log(`Total rows checked: ${uniquePostIds.length}`);
    console.log(`Unique post_ids: ${unique.size}`);
    console.log(`Duplicates detected: ${uniquePostIds.length > unique.size ? 'YES' : 'NO'}`);
    
    if (uniquePostIds.length > unique.size) {
      console.log('\n⚠️  DUPLICATE POST_IDS FOUND!');
      console.log('This explains why database updates are not working as expected.');
      console.log('When we update by post_id, we are updating multiple rows at once.');
    }
  }
}

checkDuplicates().catch(console.error); 