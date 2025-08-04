import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testRerollAPIDirect() {
  console.log('🧪 Testing Reroll API Directly...\n');

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

    // Select first 2 images to reroll
    const imagesToReroll = batch.posts[0].images.slice(0, 2).map(img => img.id);
    console.log(`🔄 Will reroll images: ${imagesToReroll.join(', ')}`);

    // Test the reroll API by calling the functions directly
    const { rerollImages } = await import('./api/reroll-images.js');
    
    // Simulate the API call
    const mockReq = {
      body: {
        batchId: batch.preview_id,
        imageIds: imagesToReroll,
        accountUsername: batch.account_username
      }
    };

    const mockRes = {
      status: (code) => ({
        json: (data) => {
          console.log(`📊 API Response (Status ${code}):`, data);
          return data;
        }
      }),
      json: (data) => {
        console.log('📊 API Response:', data);
        return data;
      }
    };

    // Call the handler function directly
    const handler = (await import('./api/reroll-images.js')).default;
    await handler(mockReq, mockRes);

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testRerollAPIDirect(); 