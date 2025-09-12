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

const STILL_LIMIT = parseInt(process.env.STILL_CONCURRENCY || '3', 10);
const VIDEO_LIMIT = parseInt(process.env.VIDEO_CONCURRENCY || '1', 10);

async function log(job_id, level, message, data) { await supabase.from('job_logs').insert({ job_id, level, message, data }); }
async function setJob(job_id, patch) { await supabase.from('jobs').update(patch).eq('id', job_id); }
async function addAsset(job_id, kind, url) { await supabase.from('job_assets').insert({ job_id, kind, url }); }

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

async function uploadBufferAsPng(buffer, username, folder){
  const tmpDir = path.join('/tmp', `worker-${Date.now()}`);
  try { fs.mkdirSync(tmpDir, { recursive: true }); } catch(_) {}
  const filePath = path.join(tmpDir, 'image.png');
  fs.writeFileSync(filePath, buffer);
  const up = await storage.uploadImage(filePath, username, folder, 'image.png');
  try { fs.unlinkSync(filePath); } catch(_) {}
  return up.publicUrl;
}

async function buildCharacter(persona, username) {
  try {
    if (!process.env.FLUX_PRO_API_KEY || !process.env.FLUX_API_BASE) {
      console.warn('[worker] FLUX env missing; skipping character');
      return { baseUrl: null, variants: [] };
    }
    const idPrompt = personaToPrompt(persona || {});
    const neg = process.env.IDENTITY_LOCK_NEGATIVE || 'different person, face swap, identity drift, age change, beard, mustache, different ethnicity, different hair color, wig, hat, eye color change, skin tone shift, artifacts, extra fingers, duplicate face, low-res';
    const seed = process.env.FLUX_SEED ? Number(process.env.FLUX_SEED) : undefined;

    const t2i = await flux.textToImage({ prompt: idPrompt, negative: neg, seed });
    const baseUrl = t2i.url;

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
        const res = await flux.imageToImage({ image_url: baseUrl, prompt: vPrompt, negative: neg, strength: 0.35, seed });
        variants.push(res.url);
      } catch(e){ console.warn('[worker] FLUX i2i failed', e.message); }
    }
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
    const url = await uploadBufferAsPng(buf, username, `influencer-stills/${Date.now()}`);
    return url;
  } catch (e) { console.error('[worker] composeStill error', e.message); return null; }
}

async function makeVideo(stillUrl) {
  try {
    if (!process.env.HIGGSFIELD_API_KEY) { console.warn('[worker] HIGGSFIELD env missing; skipping video'); return null; }
    const prompt = 'show this subject wearing the clothes while making outfit/get ready with me content in their bedroom';
    const gen = await higgs.generateImageToVideo({ prompt, image_url: stillUrl, duration: 8, aspect_ratio: '9:16', resolution: '1080p' });
    // Best-effort: if API returns final url inline, prefer it; else return generation id URL
    return gen?.url || gen?.video_url || null;
  } catch (e) { console.error('[worker] makeVideo error', e.message); return null; }
}

async function processJob(job) {
  const job_id = job.id;
  const outputs = (job.payload && job.payload.outputs) || { moodboards: true, stills: true, videos: true };
  try {
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


