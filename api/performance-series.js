import { SupabaseClient } from '../src/database/supabase-client.js';

export default async function handler(req, res){
  try{
    const db = new SupabaseClient();
    const { username = null, from = null, to = null, group = 'day' } = req.query || {};
    let q = db.client
      .from('post_metrics')
      .select('collected_at, views, platform_post_id');
    if (from) q = q.gte('collected_at', from);
    if (to) q = q.lte('collected_at', to);
    if (username){
      // filter by posts belonging to username
      const { data: ids } = await db.client
        .from('owned_posts')
        .select('platform_post_id')
        .eq('account_username', username);
      const keys = (ids||[]).map(r=> r.platform_post_id);
      if (keys.length === 0) return res.json({ series: [] });
      q = q.in('platform_post_id', keys);
    }
    const { data } = await q;
    const buckets = new Map();
    for (const r of (data||[])){
      const key = group === 'week' ? toWeek(r.collected_at) : r.collected_at;
      buckets.set(key, (buckets.get(key)||0) + (r.views||0));
    }
    const series = Array.from(buckets.entries()).sort(([a],[b])=> a.localeCompare(b)).map(([k,v])=>({ date:k, views:v }));
    res.json({ series });
  }catch(e){ res.status(500).json({ error: e.message }); }
}

function toWeek(d){
  const dt = new Date(d+'T00:00:00Z');
  const onejan = new Date(dt.getUTCFullYear(),0,1);
  const week = Math.ceil((((dt - onejan) / 86400000) + onejan.getUTCDay()+1)/7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}


