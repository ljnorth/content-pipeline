import { SupabaseClient } from '../../src/database/supabase-client.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const { username, limit = 5 } = req.body || {};
    if (!username) return res.status(400).json({ error: 'username is required' });

    const db = new SupabaseClient();

    // 1) Get current anchor for the account (if stored)
    let anchor = null;
    try {
      const { data: a } = await db.client
        .from('anchors')
        .select('*')
        .eq('username', username)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      anchor = a || null;
    } catch (_) {}

    // 2) Fetch nearest images by embedding similarity using a DB function, else fallback to recent
    let images = [];
    try {
      const { data, error } = await db.client
        .rpc('get_nearest_images_for_account', {
          p_username: username,
          p_limit: Math.max(1, Number(limit))
        });
      if (error) throw error;
      images = data || [];
    } catch (_) {
      const { data } = await db.client
        .from('images')
        .select('*')
        .eq('username', username)
        .order('created_at', { ascending: false })
        .limit(Math.max(1, Number(limit)));
      images = data || [];
    }

    // 3) Build moodboard URLs and minimal post metadata
    const moodboards = images.map(img => img.image_path).filter(Boolean);
    const posts = images.map(img => ({
      post_id: img.post_id,
      username: img.username,
      image_path: img.image_path,
      aesthetic: img.aesthetic || null,
      dist: img.dist || null
    }));

    return res.status(200).json({ moodboards, posts, anchor });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}


