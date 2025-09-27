import { SupabaseClient } from '../../src/database/supabase-client.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items required' });
    const db = new SupabaseClient();
    const rows = items.map(i => ({
      url: i.url,
      title: i.title || null,
      duration_sec: i.duration_sec || null,
      vibe: i.vibe || null,
      bpm: i.bpm || null,
      gender: (['male','female','both'].includes(String(i.gender||'both'))) ? i.gender : 'both'
    }));
    const { error } = await db.client.from('meme_audio').insert(rows);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, count: rows.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}


