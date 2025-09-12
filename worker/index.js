import fetch from 'node-fetch';
import pLimit from 'p-limit';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
// Accept both naming variants from Render dashboard
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
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
  const ep = base.replace(/\/$/, '') + '/api/content/moodboards-from-generator';
  console.log(`[worker] fetchMoodboards -> ${ep} username=${username} limit=${limit}`);
  const r = await fetch(ep, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, count: limit })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'moodboards failed');
  return j.moodboards;
}

async function buildCharacter(persona) {
  console.log('[worker] buildCharacter (stub)');
  return { baseUrl: null, variants: [] };
}

async function composeStill(characterUrl, moodboardUrl) {
  console.log('[worker] composeStill (stub)', { characterUrl: !!characterUrl, moodboardUrl });
  return null;
}

async function makeVideo(stillUrl) {
  console.log('[worker] makeVideo (stub)', { stillUrl });
  return null;
}

async function processJob(job) {
  const job_id = job.id;
  const outputs = (job.payload && job.payload.outputs) || { moodboards: true, stills: true, videos: true };
  console.log('[worker] processing job', { job_id, username: job.username, outputs });
  try {
    await setJob(job_id, { status: 'running', started_at: new Date().toISOString(), step: 'moodboards' });
    const moodboards = await fetchMoodboards(job.username, 5);
    await log(job_id, 'info', 'moodboards', { count: moodboards.length });
    console.log('[worker] moodboards fetched', { job_id, count: moodboards.length });
    if (outputs.moodboards) {
      for (const url of moodboards) {
        await addAsset(job_id, 'moodboard', url);
      }
      console.log('[worker] moodboards saved', { job_id, count: moodboards.length });
    }

    if (!outputs.stills && !outputs.videos) {
      await setJob(job_id, { status: 'completed', step: 'done', finished_at: new Date().toISOString() });
      await log(job_id, 'info', 'completed', { moodboards: (outputs.moodboards ? moodboards.length : 0), stills: 0, videos: 0 });
      console.log('[worker] completed (moodboards only)', { job_id });
      return;
    }

    await setJob(job_id, { step: 'character' });
    const character = (outputs.stills || outputs.videos) ? await buildCharacter(job.payload?.persona || null) : { baseUrl: null, variants: [] };
    if (character.baseUrl) await addAsset(job_id, 'character_base', character.baseUrl);
    for (const v of character.variants || []) await addAsset(job_id, 'character_variant', v);

    let stills = [];
    if (outputs.stills) {
      await setJob(job_id, { step: 'stills' });
      const stillLimit = pLimit(STILL_LIMIT);
      stills = (await Promise.all(moodboards.map(mb => stillLimit(() => composeStill(character.baseUrl, mb))))).filter(Boolean);
      for (const s of stills) await addAsset(job_id, 'still', s);
      console.log('[worker] stills saved', { job_id, count: stills.length });
    }

    if (outputs.videos) {
      await setJob(job_id, { step: 'videos' });
      const videoLimit = pLimit(VIDEO_LIMIT);
      const videos = (await Promise.all(stills.map(s => videoLimit(() => makeVideo(s))))).filter(Boolean);
      for (const v of videos) await addAsset(job_id, 'video', v);
      await setJob(job_id, { status: 'completed', step: 'done', finished_at: new Date().toISOString() });
      await log(job_id, 'info', 'completed', { moodboards: (outputs.moodboards ? moodboards.length : 0), stills: stills.length, videos: videos.length });
      console.log('[worker] completed (with videos)', { job_id, videos: videos.length });
    } else {
      await setJob(job_id, { status: 'completed', step: 'done', finished_at: new Date().toISOString() });
      await log(job_id, 'info', 'completed', { moodboards: (outputs.moodboards ? moodboards.length : 0), stills: stills.length, videos: 0 });
      console.log('[worker] completed (no videos)', { job_id, stills: stills.length });
    }
  } catch (e) {
    const retries = (job.retries || 0) + 1;
    const retryable = retries < 3;
    await log(job_id, 'error', 'pipeline failed', { error: e.message, stack: e.stack });
    await setJob(job_id, retryable ? { status: 'queued', retries } : { status: 'failed', error: e.message });
    console.error('[worker] failed', { job_id, error: e.message });
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
  console.log('[worker] starting poll loop');
  if (!process.env.VERCEL_BASE) console.warn('VERCEL_BASE not set - generator-based moodboards API call may fail');
  while (true) {
    await poll();
    await new Promise(r => setTimeout(r, 1500));
  }
}

main().catch(err => { console.error(err); process.exit(1); });


