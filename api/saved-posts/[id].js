import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  const { id } = req.query;
  try {
    if (req.method === 'GET') {
      const { owner_email } = req.query || {};
      if (!owner_email) return res.status(401).json({ error: 'owner_email required' });
      const { data, error } = await supabase.from('saved_posts').select('*').eq('id', id).eq('owner_email', owner_email).single();
      if (error) throw error;
      return res.json(data);
    }
    if (req.method === 'DELETE') {
      const { owner_email } = req.query || {};
      if (!owner_email) return res.status(401).json({ error: 'owner_email required' });
      const { error } = await supabase.from('saved_posts').delete().eq('id', id).eq('owner_email', owner_email);
      if (error) throw error;
      return res.json({ success: true });
    }
    res.setHeader('Allow', 'GET,DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}


