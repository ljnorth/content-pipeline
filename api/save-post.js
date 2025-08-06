import { SupabaseClient } from '../src/database/supabase-client.js';

const db = new SupabaseClient();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { post, accountUsername } = req.body;

  if (!post || !accountUsername) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    console.log(`💾 Saving post for @${accountUsername}`);

    // Generate a unique batch ID
    const batchId = `saved_${Date.now()}_${accountUsername}`;

    // Create the batch object
    const batch = {
      preview_id: batchId,
      account_username: accountUsername,
      posts: [post],
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // Expires in 7 days
    };

    // Save to database
    const { data, error } = await db.client
      .from('preview_batches')
      .insert(batch)
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to save post:', error);
      return res.status(500).json({ error: 'Failed to save post' });
    }

    console.log(`✅ Successfully saved post with ID: ${batchId}`);

    res.json({
      success: true,
      batchId: batchId,
      savedPost: data
    });

  } catch (error) {
    console.error('❌ Save post error:', error);
    res.status(500).json({ error: error.message });
  }
}