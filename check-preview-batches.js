import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkPreviewBatches() {
  try {
    console.log('🔍 Checking preview batches...');
    
    // Check if our preview batch exists
    const { data, error } = await supabase
      .from('preview_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      console.log('❌ No preview batches found in database');
      return;
    }

    console.log(`✅ Found ${data.length} preview batches:`);
    data.forEach((batch, i) => {
      console.log(`\n${i+1}. ID: ${batch.preview_id}`);
      console.log(`   Account: ${batch.account_username}`);
      console.log(`   Created: ${batch.created_at}`);
      console.log(`   Posts: ${batch.posts?.length || 0}`);
      console.log(`   Preview URL: https://easypost.fun/postpreview/${batch.preview_id}`);
      
      // Check the structure of posts data
      if (batch.posts && batch.posts.length > 0) {
        const firstPost = batch.posts[0];
        console.log(`   First post structure:`);
        console.log(`     - postNumber: ${firstPost.postNumber}`);
        console.log(`     - images: ${firstPost.images?.length || 0}`);
        console.log(`     - caption: ${firstPost.caption ? 'Yes' : 'No'}`);
      }
    });

    // Test one specific batch
    if (data.length > 0) {
      const latestBatch = data[0];
      console.log(`\n🔍 Testing latest batch: ${latestBatch.preview_id}`);
      
      // Try to fetch it the same way the API does
      const { data: testBatch, error: testError } = await supabase
        .from('preview_batches')
        .select('*')
        .eq('preview_id', latestBatch.preview_id)
        .single();

      if (testError) {
        console.log(`❌ Test fetch failed: ${testError.message}`);
      } else {
        console.log(`✅ Test fetch successful - batch found`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkPreviewBatches(); 