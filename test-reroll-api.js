import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testRerollAPI() {
  console.log('🧪 Testing Reroll API...\n');

  try {
    // Get the latest batch
    const { data: batches, error: batchError } = await supabase
      .from('preview_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (batchError || !batches || batches.length === 0) {
      console.error('❌ No batches found');
      return;
    }

    const batch = batches[0];
    console.log(`📋 Testing with batch: ${batch.preview_id}`);
    console.log(`👤 Account: ${batch.account_username}`);
    console.log(`📸 Images: ${batch.posts[0].images.length}`);

    // Select first 2 images to reroll
    const imagesToReroll = batch.posts[0].images.slice(0, 2).map(img => img.id);
    console.log(`🔄 Will reroll images: ${imagesToReroll.join(', ')}`);

    // Test the reroll API
    const response = await fetch('http://localhost:3000/api/reroll-images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        batchId: batch.preview_id,
        imageIds: imagesToReroll,
        accountUsername: batch.account_username
      })
    });

    const result = await response.json();
    console.log('\n📊 Reroll Result:');
    console.log('Success:', result.success);
    console.log('Replaced Image IDs:', result.replacedImageIds);
    console.log('New Image IDs:', result.newImageIds);
    console.log('Reroll Count:', result.rerollCount);

    if (result.success) {
      console.log('✅ Reroll API test successful!');
    } else {
      console.log('❌ Reroll API test failed:', result.error);
    }

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testRerollAPI(); 