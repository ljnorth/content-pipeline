import fetch from 'node-fetch';
import pLimit from 'p-limit';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FluxClient } from '../src/integrations/flux.js';
import { GeminiClient } from '../src/integrations/gemini.js';
import { HiggsfieldClient } from '../src/integrations/higgsfield.js';
import { ReplicateClient } from '../src/integrations/replicate.js';
import { SupabaseStorage } from '../src/utils/supabase-storage.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  const missing = [
    !SUPABASE_URL && 'SUPABASE_URL',
    !SUPABASE_SERVICE_ROLE_KEY && 'SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE'
  ].filter(Boolean).join(', ');
  throw new Error(`Supabase configuration missing: ${missing}. Set these env vars on Render for the worker.`);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const storage = new SupabaseStorage();
const flux = new FluxClient();
const gemini = new GeminiClient({ baseUrl: process.env.GEMINI_API_BASE, apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || 'nanobanana' });
const higgs = new HiggsfieldClient({});
const replicate = new ReplicateClient({});

const STILL_LIMIT = parseInt(process.env.STILL_CONCURRENCY || '3', 10);
const VIDEO_LIMIT = parseInt(process.env.VIDEO_CONCURRENCY || '1', 10);

async function log(job_id, level, message, data) { await supabase.from('job_logs').insert({ job_id, level, message, data }); }
async function setJob(job_id, patch) { await supabase.from('jobs').update(patch).eq('id', job_id); }
async function addAsset(job_id, kind, url) { await supabase.from('job_assets').insert({ job_id, kind, url }); }

async function getProfile(username){
  const { data } = await supabase
    .from('account_profiles')
    .select('influencer_soul_id, flux_variants, flux_variants_upscaled, anchor_stills, influencer_traits')
    .eq('username', username)
    .single();
  return data || {};
}

async function updateProfile(username, patch){
  await supabase
    .from('account_profiles')
    .update(patch)
    .eq('username', username);
}

async function fetchMoodboards(username, limit = 5) {
  const base = process.env.VERCEL_BASE || '';
  const ep = base.replace(/\/$/, '') + '/api/content/moodboards-from-generator';
  const r = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, count: limit }) });
  const j = await r.json(); if (!r.ok) throw new Error(j.error || 'moodboards failed');
  return j.moodboards;
}

function personaToPrompt(persona){
  const gender = persona?.gender || persona?.preferredGender || 'any';
  const hair = persona?.hair || '';
  const hairColor = persona?.hairColor || '';
  const eye = persona?.eyeColor || '';
  const skinTone = persona?.skinTone || '';
  const ethnicity = persona?.ethnicity || '';
  const age = persona?.age || '';
  const height = persona?.height_cm ? `${persona.height_cm}cm` : '';
  const weight = persona?.weight_kg ? `${persona.weight_kg}kg` : '';
  const style = persona?.stylePreset || 'streetwear monochrome';
  return `Portrait of the same person (${gender}), ${age} ${height} ${weight}, consistent identity, do not change face/hair/skin tone. Hair: ${hair} ${hairColor}. Eyes: ${eye}. Ethnicity: ${ethnicity}. Skin tone: ${skinTone}. Outfit: ${style}. 85mm portrait quality.`;
}

async function uploadBufferAsPng(buffer, username, folder, filename = 'image.png', bucket = storage.assetsBucket){
  const tmpDir = path.join('/tmp', `worker-${Date.now()}`);
  try { fs.mkdirSync(tmpDir, { recursive: true }); } catch(_) {}
  const filePath = path.join(tmpDir, filename);
  fs.writeFileSync(filePath, buffer);
  const up = await storage.uploadImage(filePath, username, folder, filename, bucket);
  try { fs.unlinkSync(filePath); } catch(_) {}
  return up.publicUrl;
}

async function buildCharacter(persona, username) {
  try {
    if (!process.env.FLUX_PRO_API_KEY || !process.env.FLUX_API_BASE) {
      console.warn('[worker] FLUX env missing; skipping character');
      return { baseUrl: null, variants: [] };
    }
    // Reuse existing character unless forced via env FORCE_BUILD
    try {
      const profExisting = await getProfile(username);
      const force = String(process.env.FORCE_BUILD || '').toLowerCase() === 'true';
      if (!force && profExisting?.flux_variants && (profExisting.flux_variants.base || (profExisting.flux_variants.variants||[]).length)){
        return { baseUrl: profExisting.flux_variants.base || null, variants: profExisting.flux_variants.variants || [] };
      }
    } catch(_){}

    const idPrompt = personaToPrompt(persona || {});
    const neg = process.env.IDENTITY_LOCK_NEGATIVE || 'different person, face swap, identity drift, age change, beard, mustache, different ethnicity, different hair color, wig, hat, eye color change, skin tone shift, artifacts, extra fingers, duplicate face, low-res';
    const seed = process.env.FLUX_SEED ? Number(process.env.FLUX_SEED) : undefined;

    // Generate base (remote URL), then store into Supabase (assets bucket)
    const t2i = await flux.textToImage({ prompt: idPrompt, negative: neg, seed });
    const baseRemote = t2i.url;
    const baseBuf = Buffer.from(await fetch(baseRemote).then(r=>r.arrayBuffer()));
    const baseUrl = await uploadBufferAsPng(baseBuf, username, 'character/base', 'base.png', storage.assetsBucket);

    const poses = ['front', '3/4 left', '3/4 right', 'profile left', 'profile right'];
    const zooms = ['headshot', 'torso', 'full body'];
    const bgs = ['bedroom', 'closet', 'mirror', 'window light', 'neutral'];
    const outfits = ['streetwear monochrome', 'athleisure set', 'denim + tee', 'blazer + jeans', 'summer dress'];

    const variants = [];
    const total = 25;
    for (let i=0;i<total;i++){
      const p = poses[i % poses.length];
      const z = zooms[Math.floor(i/poses.length) % zooms.length];
      const bg = bgs[i % bgs.length];
      const outfit = outfits[i % outfits.length];
      const vPrompt = `${idPrompt}; identity lock; pose: ${p}; framing: ${z}; background: ${bg}; outfit: ${outfit}`;
      try {
        const res = await flux.imageToImage({ image_url: baseRemote, prompt: vPrompt, negative: neg, strength: 0.35, seed });
        const vRemote = res.url;
        const vBuf = Buffer.from(await fetch(vRemote).then(r=>r.arrayBuffer()));
        const vUrl = await uploadBufferAsPng(vBuf, username, 'character/variants', `v_${i+1}.png`, storage.assetsBucket);
        variants.push(vUrl);
      } catch(e){ console.warn('[worker] FLUX i2i failed', e.message); }
    }
    try { await updateProfile(username, { flux_variants: { base: baseUrl, variants } }); } catch(_){ }
    return { baseUrl, variants };
  } catch (e) {
    console.error('[worker] buildCharacter error', e.message);
    return { baseUrl: null, variants: [] };
  }
}

async function composeStill(characterUrl, moodboardUrl, username) {
  try {
    if (!process.env.GEMINI_API_KEY) { console.warn('[worker] GEMINI env missing; skipping still'); return null; }
    if (!characterUrl) return null;
    const prompt = 'show this subject wearing the clothes while making outfit/get ready with me content in their bedroom';
    const res = await gemini.generateFromImagesAndPrompt({ images: [ { url: characterUrl }, { url: moodboardUrl } ], prompt, mimeType: 'image/png' });
    const buf = Buffer.from(res.base64, 'base64');
    const url = await uploadBufferAsPng(buf, username, `try-on`, `t_${Date.now()}.png`, storage.outputsBucket);
    return url;
  } catch (e) { console.error('[worker] composeStill error', e.message); return null; }
}

async function generateAnchorStillsForSoul(soul_id, username, locations, job_id){
  const saved = [];
  for (const loc of locations){
    const prompt = `portrait of the subject in the ${loc}`;
    const img = await higgs.generateImageFromSoul({ soul_id, prompt, aspect_ratio:'3:4', resolution:'1080p' });
    const url = img?.image_url;
    if (url){
      const b = await fetch(url).then(r=>r.arrayBuffer());
      const fileUrl = await uploadBufferAsPng(Buffer.from(b), username, `character/anchors`, `${loc}.png`, storage.assetsBucket);
      saved.push({ location: loc, url: fileUrl });
      await addAsset(job_id, 'still', fileUrl);
    }
  }
  if (saved.length === 0) throw new Error('No anchor stills generated');
  return saved;
}

async function makeVideo(stillUrl, username) {
  try {
    if (!process.env.HIGGSFIELD_API_KEY_ID || !process.env.HIGGSFIELD_API_SECRET) { console.warn('[worker] HIGGSFIELD env missing; skipping video'); return null; }
    const prompt = 'show this subject wearing the clothes while making outfit/get ready with me content in their bedroom';
    const gen = await higgs.generateImageToVideo({ prompt, image_url: stillUrl, duration: 8, aspect_ratio: '9:16', resolution: '1080p' });
    // Best-effort: if API returns final url inline, prefer it; else return generation id URL
    const remote = gen?.url || gen?.video_url || null;
    if (!remote) return null;
    try{
      const b = await fetch(remote).then(r=>r.arrayBuffer());
      const url = await uploadBufferAsPng(Buffer.from(b), username, 'videos', `v_${Date.now()}.mp4`, storage.outputsBucket);
      return url;
    }catch(_){ return remote; }
  } catch (e) { console.error('[worker] makeVideo error', e.message); return null; }
}

async function processJob(job) {
  const job_id = job.id;
  const outputs = (job.payload && job.payload.outputs) || { moodboards: true, stills: true, videos: true };
  const action = job.payload && job.payload.action;
  try {
    // Action-specific lightweight jobs
    if (action === 'build_character'){
      await setJob(job_id, { status:'running', step:'character', started_at: new Date().toISOString() });
      const character = await buildCharacter(job.payload?.persona || null, job.username);
      if (character.baseUrl) await addAsset(job_id, 'character_base', character.baseUrl);
      for (const v of character.variants || []) await addAsset(job_id, 'character_variant', v);
      await setJob(job_id, { status:'completed', step:'done', finished_at: new Date().toISOString() });
      await log(job_id, 'info', 'build_character', { base: !!character.baseUrl, variants: (character.variants||[]).length });
      return;
    }

    if (action === 'video'){
      await setJob(job_id, { status:'running', step:'videos', started_at: new Date().toISOString() });
      // Use last still from assets or fallback to character base
      const { data: assets } = await supabase.from('job_assets').select('*').eq('job_id', job_id).order('id', { ascending: false });
      const still = (assets||[]).find(a=>a.kind==='still')?.url || (assets||[]).find(a=>a.kind==='character_base')?.url || null;
      if (!still) throw new Error('No still or character_base found in job assets');
      const v = await makeVideo(still, job.username);
      if (v) await addAsset(job_id, 'video', v);
      await setJob(job_id, { status:'completed', step:'done', finished_at: new Date().toISOString() });
      await log(job_id, 'info', 'video', { url: v||null });
      return;
    }

    if (action === 'upscale_variants'){
      await setJob(job_id, { status:'running', step:'upscale_variants', started_at: new Date().toISOString() });
      const prof = await getProfile(job.username);
      let base = prof?.flux_variants?.base || null;
      let variants = Array.isArray(prof?.flux_variants?.variants) ? prof.flux_variants.variants : [];
      // Fallback: load from storage if DB missing
      if ((!base || variants.length === 0)){
        try{
          const prefixBase = `${job.username}/character/base`;
          const baseList = await storage.listFiles(prefixBase, storage.assetsBucket);
          if (Array.isArray(baseList) && baseList.length){
            const name = baseList.find(f=>f.name)?.name;
            if (name) base = storage.getPublicUrl(`${prefixBase}/${name}`, storage.assetsBucket);
          }
          const prefixVar = `${job.username}/character/variants`;
          const varList = await storage.listFiles(prefixVar, storage.assetsBucket);
          if (Array.isArray(varList)){
            variants = varList.map(v => storage.getPublicUrl(`${prefixVar}/${v.name}`, storage.assetsBucket)).filter(Boolean);
          }
        }catch(_){ /* ignore */ }
      }
      if (!base || variants.length === 0) throw new Error('No flux_variants to upscale');

      const codeformerVer = process.env.REPLICATE_CODEFORMER_VERSION || 'cc4956dd26fa5a7185d5660cc9100fab1b8070a1d1654a8bb5eb6d443b020bb2';
      const realesrganVer = process.env.REPLICATE_REALESRGAN_VERSION || 'f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa';
      let fidelity = Number(process.env.CODEFORMER_FIDELITY ?? 0.1);
      if (!Number.isFinite(fidelity)) fidelity = 0.1;
      if (fidelity < 0) fidelity = 0; if (fidelity > 1) fidelity = 1;
      const scale = Number(process.env.REALESRGAN_SCALE ?? 2);
      await log(job_id, 'info', 'upscale settings', { fidelity, scale });

      const all = [base, ...variants];
      const upscaled = [];
      for (const src of all){
        try{
          const cf = await replicate.runVersion(codeformerVer, { image: src, codeformer_fidelity: fidelity });
          let es;
          try{
            es = await replicate.runVersion(realesrganVer, { image: cf, scale });
          }catch(e){
            if (/max size that fits in GPU memory/i.test(e.message)){
              await log(job_id, 'info', 'realesrgan retry with scale=1', { src });
              es = await replicate.runVersion(realesrganVer, { image: cf, scale: 1 });
            } else { throw e; }
          }
          // Save to storage and track as asset, validating content type
          const res = await fetch(es);
          const ct = res.headers.get('content-type') || '';
          const buf = Buffer.from(await res.arrayBuffer());
          if (!/^image\//i.test(ct) || buf.length < 1024) throw new Error(`invalid upscaled output ct=${ct} bytes=${buf.length}`);
          const url = await uploadBufferAsPng(buf, job.username, `character/upscaled`, `u_${Date.now()}.png`, storage.assetsBucket);
          upscaled.push(url);
          await addAsset(job_id, 'character_variant_upscaled', url);
        }catch(e){ await log(job_id, 'error', 'upscale failed', { src, error: e.message }); }
      }
      // Persist to profile separately
      const up = { base: upscaled[0] || null, variants: upscaled.slice(1) };
      await updateProfile(job.username, { flux_variants_upscaled: up });
      await log(job_id, 'info', 'upscale_variants', { count: upscaled.length });
      await setJob(job_id, { status:'completed', step:'done', finished_at: new Date().toISOString() });
      return;
    }
    if (action === 'create_soul'){
      await setJob(job_id, { status:'running', step:'create_soul', started_at: new Date().toISOString() });
      const prof = await getProfile(job.username);
      const up = prof?.flux_variants_upscaled;
      const arr = [up?.base, ...(Array.isArray(up?.variants) ? up.variants : [])].filter(Boolean);
      if (arr.length === 0) throw new Error('No flux_variants_upscaled found. Run upscale_variants first.');
      const res = await higgs.createSoul({ name: `soul-${job.username}`, images: arr });
      if (!res?.soul_id) throw new Error('Higgsfield createSoul returned no soul_id');
      await updateProfile(job.username, { influencer_soul_id: res.soul_id });
      await log(job_id, 'info', 'soul created', { soul_id: res.soul_id });

      // Immediately generate anchor stills
      await setJob(job_id, { step:'anchor_stills' });
      const locations = Array.isArray(job.payload?.locations) && job.payload.locations.length>0
        ? job.payload.locations
        : ['bedroom','street','kitchen'];
      const saved = await generateAnchorStillsForSoul(res.soul_id, job.username, locations, job_id);
      await updateProfile(job.username, { anchor_stills: saved });
      await log(job_id, 'info', 'anchor_stills', { count: saved.length });
      await setJob(job_id, { status:'completed', step:'done', finished_at: new Date().toISOString() });
      return;
    }

    if (action === 'anchor_stills'){
      await setJob(job_id, { status:'running', step:'anchor_stills', started_at: new Date().toISOString() });
      const prof = await getProfile(job.username);
      const soul = prof?.influencer_soul_id;
      if (!soul) throw new Error('influencer_soul_id missing. Create Soul first.');
      const locations = Array.isArray(job.payload?.locations) && job.payload.locations.length>0 ? job.payload.locations : ['bedroom','street','kitchen'];
      const saved = [];
      for (const loc of locations){
        const prompt = `portrait of the subject in the ${loc}`;
        const img = await higgs.generateImageFromSoul({ soul_id: soul, prompt, aspect_ratio:'3:4', resolution:'1080p' });
        const url = img?.image_url;
        if (url){
          const b = await fetch(url).then(r=>r.arrayBuffer());
          const fileUrl = await uploadBufferAsPng(Buffer.from(b), job.username, `anchor-stills/${Date.now()}`);
          saved.push({ location: loc, url: fileUrl });
          await addAsset(job_id, 'still', fileUrl);
        }
      }
      if (saved.length === 0) throw new Error('No anchor stills generated');
      await updateProfile(job.username, { anchor_stills: saved });
      await log(job_id, 'info', 'anchor_stills', { count: saved.length });
      await setJob(job_id, { status:'completed', step:'done', finished_at: new Date().toISOString() });
      return;
    }

    if (action === 'try_on'){
      await setJob(job_id, { status:'running', step:'try_on', started_at: new Date().toISOString() });
      const prof = await getProfile(job.username);
      const anchor = Array.isArray(prof?.anchor_stills) && prof.anchor_stills[0]?.url ? prof.anchor_stills[0].url : null;
      if (!anchor) throw new Error('No anchor_stills available. Generate anchors first.');
      const count = Math.max(1, Number(job.payload?.count || 5));
      const moodboards = await fetchMoodboards(job.username, count);
      const stillLimit = pLimit(STILL_LIMIT);
      const stills = (await Promise.all(moodboards.map(mb => stillLimit(() => composeStill(anchor, mb, job.username))))).filter(Boolean);
      for (const s of stills) await addAsset(job_id, 'still', s);
      await log(job_id, 'info', 'try_on', { moodboards: moodboards.length, stills: stills.length });
      await setJob(job_id, { status:'completed', step:'done', finished_at: new Date().toISOString() });
      return;
    }

    await setJob(job_id, { status: 'running', started_at: new Date().toISOString(), step: 'moodboards' });
    const moodboards = await fetchMoodboards(job.username, 5);
    await log(job_id, 'info', 'moodboards', { count: moodboards.length });
    if (outputs.moodboards) for (const url of moodboards) await addAsset(job_id, 'moodboard', url);

    if (!outputs.stills && !outputs.videos) { await setJob(job_id, { status: 'completed', step: 'done', finished_at: new Date().toISOString() }); await log(job_id, 'info', 'completed', { moodboards: moodboards.length, stills: 0, videos: 0 }); return; }

    await setJob(job_id, { step: 'character' });
    const character = (outputs.stills || outputs.videos) ? await buildCharacter(job.payload?.persona || null, job.username) : { baseUrl: null, variants: [] };
    if (character.baseUrl) await addAsset(job_id, 'character_base', character.baseUrl);
    for (const v of character.variants || []) await addAsset(job_id, 'character_variant', v);

    let stills = [];
    if (outputs.stills) {
      await setJob(job_id, { step: 'stills' });
      const stillLimit = pLimit(STILL_LIMIT);
      stills = (await Promise.all(moodboards.map(mb => stillLimit(() => composeStill(character.baseUrl || character.variants?.[0] || null, mb, job.username))))).filter(Boolean);
      for (const s of stills) await addAsset(job_id, 'still', s);
    }

    if (outputs.videos) {
      await setJob(job_id, { step: 'videos' });
      const videoLimit = pLimit(VIDEO_LIMIT);
      const videos = (await Promise.all((stills.length ? stills : [character.baseUrl]).filter(Boolean).map(s => videoLimit(() => makeVideo(s))))).filter(Boolean);
      for (const v of videos) await addAsset(job_id, 'video', v);
      await setJob(job_id, { status: 'completed', step: 'done', finished_at: new Date().toISOString() });
      await log(job_id, 'info', 'completed', { moodboards: moodboards.length, stills: stills.length, videos: videos.length });
    } else {
      await setJob(job_id, { status: 'completed', step: 'done', finished_at: new Date().toISOString() });
      await log(job_id, 'info', 'completed', { moodboards: moodboards.length, stills: stills.length, videos: 0 });
    }
  } catch (e) {
    const retries = (job.retries || 0) + 1; const retryable = retries < 3;
    await log(job_id, 'error', 'pipeline failed', { error: e.message, stack: e.stack });
    await setJob(job_id, retryable ? { status: 'queued', retries } : { status: 'failed', error: e.message });
  }
}

async function poll() {
  const { data: rows } = await supabase.from('jobs').select('*').eq('status', 'queued').order('created_at', { ascending: true }).limit(3);
  for (const r of rows || []) await processJob(r);
}

async function main() {
  if (!process.env.VERCEL_BASE) console.warn('VERCEL_BASE not set - generator-based moodboards API call may fail');
  while (true) { await poll(); await new Promise(r => setTimeout(r, 1500)); }
}

main().catch(err => { console.error(err); process.exit(1); });


