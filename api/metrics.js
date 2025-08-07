import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  try {
    const { count: images } = await supabase.from('images').select('*', { count: 'exact', head: true });
    const { count: posts } = await supabase.from('posts').select('*', { count: 'exact', head: true });
    const { count: accounts } = await supabase.from('accounts').select('*', { count: 'exact', head: true });

    const { data: aestheticRows } = await supabase
      .from('images')
      .select('aesthetic')
      .limit(5000);

    const counts = new Map();
    (aestheticRows || []).forEach(r => {
      const k = (r.aesthetic || 'unknown').toLowerCase();
      counts.set(k, (counts.get(k) || 0) + 1);
    });

    const trending = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    res.json({ images: images || 0, posts: posts || 0, accounts: accounts || 0, trending });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}


