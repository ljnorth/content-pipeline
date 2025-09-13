import { SupabaseClient } from '../../src/database/supabase-client.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const { username, outputs, action, locations, count } = req.body || {};
    if (!username) return res.status(400).json({ error: 'username is required' });

    const db = new SupabaseClient();
    const payload = { outputs: outputs || { moodboards: true, stills: true, videos: true }, action, locations, count };
    const { data, error } = await db.client
      .from('jobs')
      .insert({ username, payload, status: 'queued' })
      .select('id')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ job_id: data.id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}


