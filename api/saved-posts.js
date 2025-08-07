import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const { name, caption = '', images = [], owner_email, overwrite = false } = req.body || {};
      if (!owner_email) return res.status(401).json({ error: 'owner_email required' });
      if (!name || !images.length) return res.status(400).json({ error: 'name and images are required' });

      if (overwrite) {
        await supabase.from('saved_posts').delete().eq('owner_email', owner_email).eq('name', name);
      }

      const { data, error } = await supabase
        .from('saved_posts')
        .insert({ owner_email, name, caption, images })
        .select('id')
        .single();
      if (error) throw error;
      return res.json({ success: true, id: data.id });
    }

    if (req.method === 'GET') {
      const { owner_email, limit = 50, offset = 0, search = '' } = req.query || {};
      if (!owner_email) return res.status(401).json({ error: 'owner_email required' });
      let query = supabase.from('saved_posts').select('id,name,created_at,images', { count: 'exact' }).eq('owner_email', owner_email).order('created_at', { ascending: false }).range(Number(offset), Number(offset) + Number(limit) - 1);
      if (search) query = query.ilike('name', `%${search}%`);
      const { data, count, error } = await query;
      if (error) throw error;
      return res.json({ items: data || [], total: count || 0 });
    }

    res.setHeader('Allow', 'GET,POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}


