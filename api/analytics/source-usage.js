import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  try {
    const { limit = 50 } = req.query || {};
    const { data, error } = await supabase
      .from('image_usage')
      .select('source_username, used_count, last_used')
      .order('used_count', { ascending: false })
      .limit(Number(limit));
    if (error) throw error;
    return res.json(data || []);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}


