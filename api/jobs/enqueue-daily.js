import { SupabaseClient } from '../../src/database/supabase-client.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ error: 'Method not allowed' });
    }
    // Optional auth token
    const token = process.env.ENQUEUE_TOKEN;
    if (token && req.headers['x-enqueue-token'] !== token) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const db = new SupabaseClient();
    const { data: profiles, error } = await db.client
      .from('account_profiles')
      .select('username, content_strategy')
      .eq('is_active', true);
    if (error) return res.status(500).json({ error: error.message });
    const active = (profiles||[]).filter(p => p.content_strategy?.autogenEnabled);
    let count = 0;
    for (const p of active) {
      const { error: ie } = await db.client
        .from('jobs')
        .insert({ username: p.username, payload: { outputs: { moodboards:true, stills:true, videos:true } }, status:'queued' });
      if (!ie) count++;
    }
    return res.status(200).json({ count });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}


