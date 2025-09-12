import fetch from 'node-fetch';
import pLimit from 'p-limit';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
// Accept both naming variants from Render dashboard
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // Fail fast with actionable message for Render logs
  const missing = [
    !SUPABASE_URL && 'SUPABASE_URL',
    !SUPABASE_SERVICE_ROLE_KEY && 'SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE'
  ].filter(Boolean).join(', ');
  throw new Error(`Supabase configuration missing: ${missing}. Set these env vars on Render for the worker.`);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const STILL_LIMIT = parseInt(process.env.STILL_CONCURRENCY || '3', 10);
const VIDEO_LIMIT = parseInt(process.env.VIDEO_CONCURRENCY || '1', 10);

async function log(job_id, level, message, data) {
  await supabase.from('job_logs').insert({ job_id, level, message, data });
}

async function setJob(job_id, patch) {
  await supabase.from('jobs').update(patch).eq('id', job_id);
}

async function addAsset(job_id, kind, url) {
  await supabase.from('job_assets').insert({ job_id, kind, url });
}

async function fetchMoodboards(username, limit = 5) {
  const base = process.env.VERCEL_BASE || '';
  const r = await fetch(base.replace(/\/$/, '') + '/api/posts/by-embeddings', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, limit })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'moodboards failed');
  return j.moodboards;
}

async function buildCharacter(persona) {
  // TODO: call FLUX T2I + I2I here, persist to storage, return URLs
  return { baseUrl: null, variants: [] };
}

async function composeStill(characterUrl, moodboardUrl) {
  // TODO: call Gemini compose here, persist, return URL
  return null;
}

async function makeVideo(stillUrl) {
  // TODO: call Higgsfield image2video here, persist, return URL
  return null;
}

async function processJob(job) {
  const job_id = job.id;
  try {
    await setJob(job_id, { status: 'running', started_at: new Date().toISOString(), step: 'moodboards' });
    const moodboards = await fetchMoodboards(job.username, 5);
    await log(job_id, 'info', 'moodboards', { count: moodboards.length });

    await setJob(job_id, { step: 'character' });
    const character = await buildCharacter(job.payload?.persona || null);
    if (character.baseUrl) await addAsset(job_id, 'character_base', character.baseUrl);
    for (const v of character.variants || []) await addAsset(job_id, 'character_variant', v);

    await setJob(job_id, { step: 'stills' });
    const stillLimit = pLimit(STILL_LIMIT);
    const stills = (await Promise.all(moodboards.map(mb => stillLimit(() => composeStill(character.baseUrl, mb))))).filter(Boolean);
    for (const s of stills) await addAsset(job_id, 'still', s);

    await setJob(job_id, { step: 'videos' });
    const videoLimit = pLimit(VIDEO_LIMIT);
    const videos = (await Promise.all(stills.map(s => videoLimit(() => makeVideo(s))))).filter(Boolean);
    for (const v of videos) await addAsset(job_id, 'video', v);

    await setJob(job_id, { status: 'completed', step: 'done', finished_at: new Date().toISOString() });
    await log(job_id, 'info', 'completed', { stills: stills.length, videos: videos.length });
  } catch (e) {
    const retries = (job.retries || 0) + 1;
    const retryable = retries < 3;
    await log(job_id, 'error', 'pipeline failed', { error: e.message, stack: e.stack });
    await setJob(job_id, retryable ? { status: 'queued', retries } : { status: 'failed', error: e.message });
  }
}

async function poll() {
  const { data: rows } = await supabase
    .from('jobs')
    .select('*')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(3);
  for (const r of rows || []) await processJob(r);
}

async function main() {
  if (!process.env.VERCEL_BASE) console.warn('VERCEL_BASE not set - /api/posts/by-embeddings will fail');
  while (true) {
    await poll();
    await new Promise(r => setTimeout(r, 1500));
  }
}

main().catch(err => { console.error(err); process.exit(1); });


