import { SupabaseClient } from '../src/database/supabase-client.js';

function isoDaysAgo(days){ const d = new Date(); d.setUTCDate(d.getUTCDate()-days); return d.toISOString().slice(0,10); }
function parseISO(s, fallback){ try{ return new Date(s+'T00:00:00Z'); }catch{ return fallback; } }

export default async function handler(req, res){
  try{
    const db = new SupabaseClient();
    const { username = null, days = '30', from = null, to = null } = req.query || {};

    // Resolve date window
    let dateTo = to || new Date().toISOString().slice(0,10);
    let dateFrom = from || isoDaysAgo(parseInt(days,10));
    const rangeDays = Math.max(1, Math.ceil((parseISO(dateTo) - parseISO(dateFrom))/86400000));
    const prevTo = dateFrom; // the day before current window starts
    const prevFrom = isoDaysAgo(rangeDays*2);

    // Filter by account -> collect platform_post_ids
    let postIds = null;
    if (username){
      const { data: owned } = await db.client
        .from('owned_posts')
        .select('platform_post_id')
        .eq('account_username', username);
      postIds = (owned||[]).map(r=> r.platform_post_id);
      if ((postIds||[]).length === 0){
        return res.json({
          range: { from: dateFrom, to: dateTo },
          totals: { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, engagement: 0 },
          deltas: { views: 0, engagement: 0, likes: 0, comments: 0 },
          videosTracked: 0
        });
      }
    }

    // Helper to sum for a window
    async function sumWindow(f, t){
      let q = db.client.from('post_metrics').select('views,likes,comments,shares,saves').gte('collected_at', f).lt('collected_at', t);
      if (postIds) q = q.in('platform_post_id', postIds);
      const { data } = await q;
      return (data||[]).reduce((acc, r)=>{
        acc.views += r.views||0; acc.likes += r.likes||0; acc.comments += r.comments||0; acc.shares += r.shares||0; acc.saves += r.saves||0; return acc;
      }, { views:0, likes:0, comments:0, shares:0, saves:0 });
    }

    const cur = await sumWindow(dateFrom, dateTo);
    const prev = await sumWindow(prevFrom, prevTo);
    const engagement = cur.likes + cur.comments + cur.shares + cur.saves;
    const prevEng = prev.likes + prev.comments + prev.shares + prev.saves;
    function pct(a,b){ return b>0 ? ((a-b)/b)*100 : (a>0 ? 100 : 0); }

    // videos tracked = distinct posts present for this account (or all)
    let videosTracked = 0;
    if (username){
      videosTracked = postIds.length;
    } else {
      const { count } = await db.client.from('owned_posts').select('*', { count:'exact', head:true });
      videosTracked = count || 0;
    }

    res.json({
      range: { from: dateFrom, to: dateTo },
      totals: { ...cur, engagement },
      deltas: {
        views: pct(cur.views, prev.views),
        engagement: pct(engagement, prevEng),
        likes: pct(cur.likes, prev.likes),
        comments: pct(cur.comments, prev.comments)
      },
      videosTracked
    });
  }catch(e){ res.status(500).json({ error: e.message }); }
}


