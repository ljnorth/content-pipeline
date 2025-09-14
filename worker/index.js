import fetch from 'node-fetch';
import sharp from 'sharp';
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
const MAX_ESRGAN_INPUT_PIXELS = Number(process.env.MAX_ESRGAN_INPUT_PIXELS || 2096704);

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

// Ensure an image is under the ESRGAN input pixel cap. If too large, downscale proportionally.
async function ensureUnderPixelCap(imageUrl, username, job_id){
  try{
    const buf = Buffer.from(await fetch(imageUrl).then(r=>r.arrayBuffer()));
    const meta = await sharp(buf).metadata();
    const w = meta.width || 0; const h = meta.height || 0;
    const pixels = w * h;
    if (pixels > MAX_ESRGAN_INPUT_PIXELS && w > 0 && h > 0){
      const factor = Math.sqrt(MAX_ESRGAN_INPUT_PIXELS / pixels);
      const newW = Math.max(1, Math.floor(w * factor));
      const newH = Math.max(1, Math.floor(h * factor));
      const resized = await sharp(buf).resize(newW, newH, { fit: 'inside' }).png().toBuffer();
      const url = await uploadBufferAsPng(resized, username, 'character/tmp', `r_${Date.now()}.png`, storage.assetsBucket);
      if (job_id) await log(job_id, 'info', 'esrgan_preresize', { original: { w, h, pixels }, resized: { w: newW, h: newH, pixels: newW*newH } });
      return url;
    }
    return imageUrl;
  }catch(e){ if (job_id) await log(job_id, 'error', 'esrgan_preresize_failed', { error: e.message }); return imageUrl; }
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
      await setJob(job_id, { status:'completed', step:'skipped', finished_at: new Date().toISOString() });
      await log(job_id, 'info', 'upscale disabled', { reason: 'step removed' });
      return;
    }
    if (action === 'create_soul'){
      await setJob(job_id, { status:'running', step:'create_soul', started_at: new Date().toISOString() });
      // Pull exclusively from storage variants (no DB, no base)
      const prefixVar = `${job.username}/character/variants`;
      const varList = await storage.listFiles(prefixVar, storage.assetsBucket);
      const arr = Array.isArray(varList)
        ? varList.map(v => storage.getPublicUrl(`${prefixVar}/${v.name}`, storage.assetsBucket)).filter(Boolean)
        : [];
      const source = 'storage-variants-only';
      if (arr.length === 0) throw new Error('No flux_variants found. Run character build first.');
      const reqBody = { name: `soul-${job.username}`, input_images: arr.map(u => ({ type: 'url', image_url: u })) };
      await log(job_id, 'info', 'higgs_create_soul_request', {
        method: 'POST',
        url: `${higgs.baseUrl}/custom-references`,
        mode: higgs.mode,
        headerKeys: Object.keys(higgs.headers || {}),
        hasApiKey: Boolean((higgs.headers||{})['hf-api-key'] || (higgs.headers||{}).Authorization),
        hasSecret: Boolean((higgs.headers||{})['hf-secret']),
        body: reqBody
      });
      const res = await higgs.createSoul({ name: `soul-${job.username}`, images: arr });
      const refId = res?.soul_id || res?.id || res?.reference_id || res?.referenceId || null;
      if (!refId) throw new Error('Higgsfield createSoul returned no reference id');
      // Poll status until ready
      const start = Date.now();
      const deadlineMs = 30 * 60 * 1000; // 30 minutes max
      let ready = false; let lastStatus = null;
      while (!ready && Date.now() - start < deadlineMs){
        try{
          const st = await higgs.getCustomReference(refId);
          lastStatus = st?.status || st?.state || st?.training_status || JSON.stringify(st||{});
          await log(job_id, 'info', 'soul status', { id: refId, status: lastStatus });
          if (String(lastStatus).toLowerCase() === 'ready' || String(lastStatus).toLowerCase() === 'completed'){
            ready = true; break;
          }
        }catch(e){ await log(job_id, 'error', 'soul status poll failed', { id: refId, error: e.message }); }
        await new Promise(r => setTimeout(r, 10000));
      }
      if (!ready) throw new Error('Higgsfield soul training did not complete in time');
      const soul_id = refId;
      await updateProfile(job.username, { influencer_soul_id: soul_id });
      await log(job_id, 'info', 'soul created', { soul_id, source, images: arr.length, endpoint: 'custom-references' });

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


