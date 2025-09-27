import { SupabaseClient } from '../../src/database/supabase-client.js';
import { PostForMe } from '../../src/integrations/postforme.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { username, images, caption } = req.body || {};
    if (!username) return res.status(400).json({ error: 'username is required' });
    const arr = Array.isArray(images) ? images.filter(Boolean) : [];
    if (arr.length === 0) return res.status(400).json({ error: 'images[] is required' });

    const db = new SupabaseClient();
    const { data: prof } = await db.client
      .from('account_profiles')
      .select('postforme_instagram_account_id')
      .eq('username', username)
      .single();
    const spc = prof?.postforme_instagram_account_id;
    if (!spc) return res.status(400).json({ error: 'postforme_instagram_account_id not set for this account' });

    const pfm = new PostForMe();
    const media = arr.map(url => ({ url }));
    const out = await pfm.createPost({ caption: String(caption || ''), media, social_accounts: [spc], scheduled_at: null });
    return res.status(200).json({ success: true, post: out });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}


