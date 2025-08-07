import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

function groupByDay(rows, column) {
  const map = new Map();
  for (const r of rows || []) {
    const d = new Date(r[column]);
    if (isNaN(d)) continue;
    const key = d.toISOString().slice(0,10);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].sort((a,b)=> a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));
}

export default async function handler(req, res) {
  try {
    const days = Math.max(7, Math.min(90, Number(req.query.days || 30)));
    const since = new Date(Date.now() - days*24*60*60*1000).toISOString();

    const { data: posts } = await supabase
      .from('posts')
      .select('created_at')
      .gte('created_at', since)
      .limit(20000);

    const { data: images } = await supabase
      .from('images')
      .select('created_at')
      .gte('created_at', since)
      .limit(20000);

    res.json({
      days,
      postsByDay: groupByDay(posts, 'created_at'),
      imagesByDay: groupByDay(images, 'created_at')
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}


