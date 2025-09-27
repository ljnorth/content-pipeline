import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function log(message) { console.log(`[${new Date().toISOString()}] ${message}`); }

function parseVector(v){
  if (Array.isArray(v)) return v;
  if (!v) return null;
  if (typeof v === 'string'){
    try{
      let s = v.trim();
      if (s.startsWith('(') && s.endsWith(')')) s = '[' + s.slice(1, -1) + ']';
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map(Number);
    }catch(_){ return null; }
  }
  return null;
}

function cosine(a,b){ let s=0; for (let i=0;i<a.length;i++) s+= a[i]*b[i]; return s; }
function dist(a,b){ return 1 - cosine(a,b); }

async function rerollWithAnchorMMR(accountUsername, count, existingImageIds){
  log(`🎨 Reroll with MMR: ${count} for @${accountUsername}`);
  const { data: anchorRow } = await supabase
    .from('account_anchors')
    .select('anchor')
    .eq('username', accountUsername)
    .single();
  const anchorVec = parseVector(anchorRow?.anchor);
  if (!anchorVec) throw new Error('No anchor available for this account');

  const kNeighbors = Math.max(200, count * 40);
  const anchorParam = `[${anchorVec.join(',')}]`;
  const { data: nn, error: rpcErr } = await supabase
    .rpc('nearest_images', { anchor: anchorParam, k: kNeighbors, include_covers: false, usernames: null });
  if (rpcErr) throw new Error(`nearest_images failed: ${rpcErr.message}`);
  if (!Array.isArray(nn) || nn.length === 0) throw new Error('No nearest candidates found');

  const exclude = new Set((existingImageIds||[]).map(Number));
  const ids = nn.filter(r => !exclude.has(Number(r.id))).map(r => r.id);
  if (!ids.length) throw new Error('No candidates after excluding existing');

  const { data: embRows } = await supabase
    .from('images')
    .select('id, embedding, aesthetic, colors, season, image_path')
    .in('id', ids);
  const pool = [];
  (embRows||[]).forEach(r => {
    const v = parseVector(r.embedding);
    if (Array.isArray(v)) {
      const d = dist(anchorVec, v);
      pool.push({ id: r.id, image_path: r.image_path, aesthetic: r.aesthetic, colors: r.colors, season: r.season, _emb: v, dist: d });
    }
  });

  const mmrLambda = 0.7;
  const minPairwiseDistance = 0.12;
  const maxAnchorDistance = 0.25;

  const filtered = pool.filter(p => !(isFinite(maxAnchorDistance) && p.dist > maxAnchorDistance));
  if (filtered.length < count) throw new Error(`Insufficient diverse candidates (${filtered.length}/${count})`);

  const selected = [];
  while (selected.length < count && filtered.length){
    let bestIdx = -1; let bestScore = -Infinity;
    for (let i=0;i<filtered.length;i++){
      const c = filtered[i];
      let maxSimToSel = 0;
      for (const s of selected){ const sim = cosine(c._emb, s._emb); if (sim > maxSimToSel) maxSimToSel = sim; }
      const anchorSim = 1 - c.dist;
      const score = mmrLambda * anchorSim - (1 - mmrLambda) * maxSimToSel;
      if (score > bestScore){ bestScore = score; bestIdx = i; }
    }
    if (bestIdx < 0) break;
    const pick = filtered.splice(bestIdx, 1)[0];
    let ok = true;
    for (const s of selected){ if (dist(pick._emb, s._emb) < minPairwiseDistance){ ok = false; break; } }
    if (ok) selected.push(pick);
  }

  if (selected.length < count) throw new Error(`Diversity constraints prevented enough selections (${selected.length}/${count})`);

  // Optional: Vision gate to ensure clothing
  let finalSel = selected;
  try {
    const { isClothingImage } = await import('../src/utils/vision.js');
    const filtered = [];
    for (const s of selected){
      const ok = await isClothingImage(s.image_path);
      if (ok) filtered.push(s);
      if (filtered.length >= count) break;
    }
    if (filtered.length) finalSel = filtered;
  } catch(_) { /* fail-open */ }

  return finalSel.slice(0, count).map(s => ({
    id: s.id,
    imagePath: s.image_path,
    image_path: s.image_path,
    aesthetic: s.aesthetic || 'mixed',
    colors: s.colors || ['neutral'],
    season: s.season || 'any',
    dist: s.dist,
    is_cover_slide: false
  }));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageIds, accountUsername, existingImageIds } = req.body;
  if (!imageIds || !accountUsername || !existingImageIds) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    log(`🔄 Instantly rerolling ${imageIds.length} images for @${accountUsername}`);
    const newImages = await rerollWithAnchorMMR(accountUsername, imageIds.length, existingImageIds);
    res.json({ success: true, replacedImageIds: imageIds, newImages });
  } catch (error) {
    log('❌ Instant reroll error: ' + error.message);
    res.status(500).json({ error: error.message });
  }
}