import { SupabaseClient } from '../database/supabase-client.js';

function l2Normalize(vec){
  const norm = Math.sqrt(vec.reduce((s,v)=>s+v*v,0)) || 1;
  return vec.map(v=> v / norm);
}

function cosineSim(a,b){ let s=0; for (let i=0;i<a.length;i++) s += a[i]*b[i]; return s; }

export class AnchorBuilder {
  constructor(){ this.db = new SupabaseClient(); }

  // Normalize various embedding representations (pgvector via PostgREST)
  normalizeEmbedding(e){
    if (Array.isArray(e)) return e;
    if (e == null) return null;
    if (typeof e === 'string') {
      try {
        let s = e.trim();
        // Convert "(1,2,3)" to "[1,2,3]" if needed
        if (s.startsWith('(') && s.endsWith(')')) {
          s = '[' + s.slice(1, -1) + ']';
        }
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) return arr.map(Number);
      } catch { /* ignore */ }
    }
    return null;
  }

  async getInspoWinnerImages(inspoUsernames, windowDays){
    const since = new Date(Date.now() - windowDays*24*3600*1000).toISOString();
    // Posts by inspo accounts, recent window
    const usernames = Array.from(new Set([
      ...inspoUsernames,
      ...inspoUsernames.map(u => u.startsWith('@') ? u : `@${u}`)
    ]));
    let { data: posts } = await this.db.client
      .from('posts')
      .select('post_id, username, engagement_rate, like_count, view_count, created_at')
      .in('username', usernames)
      .gte('created_at', since)
      .order('engagement_rate', { ascending: false })
      .limit(500);
    posts = posts || [];
    if (posts.length === 0) return [];
    const ids = [...new Set(posts.map(p=>p.post_id))];
    const { data: imgs } = await this.db.client
      .from('images')
      .select('id, post_id, username, image_path, embedding, is_cover_slide, cover_slide_text, uniformity_score, aesthetic, colors, season, created_at')
      .in('post_id', ids)
      .not('embedding', 'is', null)
      .limit(3000);
    const byId = Object.fromEntries(posts.map(p=>[p.post_id, p]));
    const normalized = (imgs||[]).map(r=> ({ ...r, embedding: this.normalizeEmbedding(r.embedding) }));
    return normalized.filter(r=> Array.isArray(r.embedding)).map(r=>({ ...r, _post: byId[r.post_id] })).filter(r=> !!r._post);
  }

  async computeCoverCentroid(windowDays = 180){
    const since = new Date(Date.now() - windowDays*24*3600*1000).toISOString();
    const { data: covers } = await this.db.client
      .from('images')
      .select('embedding, created_at, is_cover_slide, cover_slide_text')
      .gte('created_at', since)
      .not('embedding', 'is', null)
      .or('is_cover_slide.eq.true,cover_slide_text.not.is.null')
      .limit(3000);
    const arr = (covers||[]).filter(r=> Array.isArray(r.embedding));
    if (arr.length === 0) return null;
    const dim = arr[0].embedding.length;
    const acc = new Array(dim).fill(0);
    for (const r of arr){ const v = r.embedding; for (let i=0;i<dim;i++) acc[i]+= v[i]; }
    for (let i=0;i<dim;i++) acc[i] /= arr.length;
    return l2Normalize(acc);
  }

  weightFor(recencyIso, engagement){
    const recentSince = new Date(Date.now() - 14*24*3600*1000).toISOString();
    const wRecency = recencyIso >= recentSince ? 2.0 : 1.0;
    const perf = Number(engagement||0);
    const wPerf = 1.0 + Math.max(0, Math.min(perf, 0.1)) * 4; // up to ~1.4x
    return wRecency * wPerf;
  }

  buildWeightedMean(images){
    if (images.length === 0) return null;
    const dim = images[0].embedding.length;
    const acc = new Array(dim).fill(0);
    let tot = 0;
    for (const r of images){ const w = this.weightFor(r._post.created_at, r._post.engagement_rate); tot += w; for (let i=0;i<dim;i++) acc[i]+= r.embedding[i]*w; }
    if (tot === 0) return null;
    for (let i=0;i<dim;i++) acc[i] /= tot;
    return l2Normalize(acc);
  }

  filterCovers(images, coverCentroid, coverSimThreshold = 0.92, uniformityThreshold = 0.92){
    return images.filter(r => {
      if (r.is_cover_slide === true) return false;
      if (r.cover_slide_text) return false;
      if (typeof r.uniformity_score === 'number' && r.uniformity_score >= uniformityThreshold) return false;
      if (coverCentroid && cosineSim(l2Normalize(r.embedding), coverCentroid) >= coverSimThreshold) return false;
      return true;
    });
  }

  async buildAnchorsFromInspo(inspoUsernames, windowDays = 90){
    const raw = await this.getInspoWinnerImages(inspoUsernames, windowDays);
    const coverCentroid = await this.computeCoverCentroid();
    // Strict cover filtering first
    let clean = this.filterCovers(raw, coverCentroid);
    // If too strict (no candidates), relax: drop only explicit covers (keep uniform backgrounds/text rule off)
    if (clean.length === 0 && raw.length > 0) {
      clean = raw.filter(r => !(r.is_cover_slide === true || r.cover_slide_text));
    }
    // Last resort: use raw so an anchor can still be formed
    if (clean.length === 0) clean = raw;
    const anchor = this.buildWeightedMean(clean);
    return { anchor, coverCentroid, candidates: clean };
  }

  async loadCachedAnchor(username){
    const { data } = await this.db.client
      .from('account_anchors')
      .select('anchor, built_at, stats')
      .eq('username', username)
      .single();
    return data || null;
  }

  async saveCachedAnchor(username, anchor, stats){
    if (!Array.isArray(anchor)) return;
    await this.db.client
      .from('account_anchors')
      .upsert({ username, anchor, built_at: new Date().toISOString(), stats: stats || {} });
  }

  async nearestBySql(anchor, k = 50, usernames = null){
    // Ensure the anchor is passed in pgvector text form so PostgREST can cast it
    const vecParam = Array.isArray(anchor) ? `[${anchor.join(',')}]` : anchor;
    const { data, error } = await this.db.client.rpc('nearest_images', { anchor: vecParam, k, include_covers: false, usernames });
    if (error) { console.error('nearest_images RPC error:', error.message || error); return []; }
    return data || [];
  }
}


