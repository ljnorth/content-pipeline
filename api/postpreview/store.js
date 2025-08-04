const { SupabaseClient } = require('../../src/database/supabase-client.js');

const db = new SupabaseClient();

module.exports = async function handler(req, res) {
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
      preview_id: batchId,
      account_username: accountUsername,
      posts: posts,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };

    // Table should already exist from migration

    // Insert or update batch data
    const { error } = await db.client
      .from('preview_batches')
      .upsert(batchData, { onConflict: 'preview_id' });

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
}; 