import { EnhancedSlackAPI } from '../slack/enhanced.js';
import { SupabaseClient } from '../database/supabase-client.js';

async function getContentGenerator(){
  const mod = await import('./content-generator.js');
  return new mod.ContentGenerator();
}

export const JobTypes = {
  DAILY_GENERATE: 'daily_generate',
  DAILY_INGEST: 'daily_ingest',
  WEEKLY_INGEST: 'weekly_ingest',
  WASH_IMAGES: 'wash_images',
  RUN_ONCE: 'run_once'
};

export const JobHandlers = {
  async [JobTypes.DAILY_GENERATE](run){
    const db = new SupabaseClient();
    const slack = new EnhancedSlackAPI();
    const generator = await getContentGenerator();
    // New run context to reduce cross-account duplicates
    generator.runContext = { usedImageIds: new Set() };
    const { data: accounts } = await db.client
      .from('account_profiles')
      .select('username, content_strategy')
      .eq('is_active', true);
    const enabled = (accounts||[]).filter(a => a?.content_strategy?.autogenEnabled === true);
    for (const acc of enabled){
      try {
        const posts = await generator.generateContentForAccount({ username: acc.username }, { selectionMode: (acc?.content_strategy?.selectionMode)||'rerollish' });
        if (Array.isArray(posts) && posts.length > 0){
          try {
            await slack.sendAccountConsolidated({ account: acc.username, posts });
          } catch (slackErr) {
            console.warn(`[${new Date().toISOString()}] ⚠️ Slack send failed for ${acc.username}: ${slackErr.message}`);
          }
        } else {
          console.warn(`[${new Date().toISOString()}] ⚠️ No posts generated for ${acc.username}; skipping Slack send.`);
        }
      } catch (genErr) {
        console.error(`[${new Date().toISOString()}] ❌ Generation failed for ${acc.username}: ${genErr.message}`);
      }
    }
    return { accounts: enabled.length };
  },

  async [JobTypes.DAILY_INGEST](run){
    const base = process.env.PUBLIC_BASE_URL || 'https://www.easypost.fun';
    const r = await fetch(`${base}/api/ingest?mode=all&dryRun=false`);
    if (!r.ok) throw new Error(`ingest failed ${r.status}`);
    return { ok: true };
  },

  async [JobTypes.WEEKLY_INGEST](run){
    const base = process.env.PUBLIC_BASE_URL || 'https://www.easypost.fun';
    const r = await fetch(`${base}/api/ingest?mode=all&dryRun=false`);
    if (!r.ok) throw new Error(`weekly ingest failed ${r.status}`);
    return { ok: true };
  },

  async [JobTypes.WASH_IMAGES](run){
    const { ImageSanitiser } = await import('../stages/image-sanitiser.js');
    const { SupabaseClient } = await import('../database/supabase-client.js');
    const { DbQueue } = await import('./queue-db.js');
    const db = new SupabaseClient();
    const washer = new ImageSanitiser();
    const batch = parseInt((run.payload && run.payload.batch) || '500', 10);
    const maxMs = parseInt(process.env.WASH_MAX_MS || '60000', 10);
    const start = Date.now();
    let washed = 0;

    while (Date.now() - start < maxMs){
      const { data: rows } = await db.client
        .from('images')
        .select('id, image_path, username, post_id')
        .eq('washed', false)
        .limit(batch);
      if (!rows || rows.length === 0) break;
      for (const row of rows){
        try { await washer.washImageRecord(row); washed++; } catch(e){ /* continue */ }
      }
      if (rows.length < batch) break; // likely finished
    }

    // Check remaining and auto-enqueue another batch if needed
    const { count } = await db.client
      .from('images')
      .select('*', { count: 'exact', head: true })
      .eq('washed', false);

    if ((count || 0) > 0){
      const q = new DbQueue();
      await q.enqueue(JobTypes.WASH_IMAGES, { batch, idempotency_key: `wash_images:${Date.now()}`, force: true }, {});
    }

    return { washed, remaining: count || 0 };
  },

  async [JobTypes.RUN_ONCE](run){ return { echo: run.payload || {} }; }
};


