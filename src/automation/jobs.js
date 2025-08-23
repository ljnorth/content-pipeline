import { EnhancedSlackAPI } from '../slack/enhanced.js';
import { SupabaseClient } from '../database/supabase-client.js';

async function getContentGenerator(){
  const mod = await import('./content-generator.js');
  return new mod.ContentGenerator();
}

export const JobTypes = {
  DAILY_GENERATE: 'daily_generate',
  DAILY_INGEST: 'daily_ingest',
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

  async [JobTypes.RUN_ONCE](run){ return { echo: run.payload || {} }; }
};


