import { SupabaseClient } from '../../src/database/supabase-client.js';

const db = new SupabaseClient();

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { batchId, accountUsername, posts } = req.body;

    if (!batchId || !accountUsername || !posts) {
      res.status(400).json({ error: 'Missing required fields: batchId, accountUsername, posts' });
      return;
    }

    // Store batch data in database for persistence
    const batchData = {
      batch_id: batchId,
      account_username: accountUsername,
      posts_data: posts,
      created_at: new Date().toISOString(),
      total_images: posts.reduce((sum, post) => sum + (post.images?.length || 0), 0)
    };

    // Create preview_batches table if it doesn't exist
    await db.client.rpc('create_preview_batches_table_if_not_exists', {
      table_sql: `
        CREATE TABLE IF NOT EXISTS preview_batches (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          batch_id TEXT UNIQUE NOT NULL,
          account_username TEXT NOT NULL,
          posts_data JSONB NOT NULL,
          total_images INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT now()
        );
      `
    }).catch(() => {
      // Fallback: try direct insert (table might already exist)
    });

    // Insert or update batch data
    const { error } = await db.client
      .from('preview_batches')
      .upsert(batchData, { onConflict: 'batch_id' });

    if (error) {
      console.error('Database error:', error);
      res.status(500).json({ error: 'Failed to store batch data' });
      return;
    }

    res.status(200).json({ 
      success: true, 
      batchId,
      previewUrl: `https://easypost.fun/postpreview/${batchId}`
    });

  } catch (error) {
    console.error('Store batch error:', error);
    res.status(500).json({ error: error.message });
  }
} 