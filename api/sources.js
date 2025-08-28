import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { active, username } = req.query;
      let q = supabase.from('accounts').select('*').order('username');
      if (active === 'true') q = q.eq('active', true);
      if (username) q = q.eq('username', username);
      const { data, error } = await q;
      if (error) throw error;
      return res.json(data || []);
    }
    if (req.method === 'POST') {
      const { username, url, tags = [], active = true, gender } = req.body || {};
      if (!username) return res.status(400).json({ error: 'username required' });
      // Map gender to tags (ensure dedupe)
      let nextTags = Array.isArray(tags) ? [...tags] : [];
      if (gender && (gender === 'men' || gender === 'women')) {
        if (!nextTags.includes(gender)) nextTags.push(gender);
      }
      const { error } = await supabase
        .from('accounts')
        .upsert({ username, url, tags: nextTags, active }, { onConflict: 'username' });
      if (error) throw error;
      return res.json({ success: true });
    }
    if (req.method === 'PATCH') {
      const { username, active } = req.body || {};
      if (!username) return res.status(400).json({ error: 'username required' });
      const { error } = await supabase.from('accounts').update({ active }).eq('username', username);
      if (error) throw error;
      return res.json({ success: true });
    }
    if (req.method === 'DELETE') {
      const { username } = req.query || {};
      if (!username) return res.status(400).json({ error: 'username required' });
      const { error } = await supabase.from('accounts').delete().eq('username', username);
      if (error) throw error;
      return res.json({ success: true });
    }
    res.setHeader('Allow','GET,POST,PATCH,DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}


