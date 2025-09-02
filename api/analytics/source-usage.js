import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  try {
    const { limit = 50 } = req.query || {};
    // Prefer image_usage for history; if empty, fallback to active sources
    let { data, error } = await supabase
      .from('image_usage')
      .select('source_username, used_count, last_used')
      .order('used_count', { ascending: false })
      .limit(Number(limit));
    if (error) throw error;
    if (!data || data.length === 0){
      const resp = await supabase.from('accounts').select('username, active').eq('active', true).order('username').limit(Number(limit));
      if (resp.error) throw resp.error;
      data = (resp.data||[]).map(a=>({ source_username: a.username, used_count: 0, last_used: null }));
    }
    return res.json(data || []);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}


