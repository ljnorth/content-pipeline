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
  DISCOVER_OWNED_POSTS: 'discover_owned_posts',
  FETCH_POST_METRICS: 'fetch_post_metrics',
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
    // Run incremental ingest directly inside the worker
    const { ContentAcquirer } = await import('../stages/content-acquirer.js');
    const { DatabaseStorage } = await import('../stages/database-storage.js');
    const db = new SupabaseClient();

    // Fetch active source accounts
    const { data: sources } = await db.client.from('accounts').select('username, last_scraped, active').eq('active', true);
    if (!sources || sources.length === 0) return { accounts: 0, newPosts: 0 };

    // Build account descriptors with simple metadata
    const accounts = [];
    for (const s of sources){
      // Count existing posts for this source (best-effort)
      let count = 0; let latest = null;
      try{
        const { count: c } = await db.client.from('posts').select('*', { count:'exact', head:true }).eq('username', s.username);
        count = c || 0;
        const { data: recent } = await db.client.from('posts').select('created_at').eq('username', s.username).order('created_at', { ascending:false }).limit(1);
        latest = recent && recent[0] ? recent[0].created_at : null;
      }catch(_){ /* ignore */ }
      accounts.push({ username: s.username, isNew: false, existingPostCount: count, latestPostTimestamp: latest });
    }

    const acquirer = new ContentAcquirer();
    const storage = new DatabaseStorage();
    const posts = await acquirer.process(accounts);
    const storeRes = await storage.process(posts);
    return { accounts: accounts.length, scrapedPosts: posts.length, stored: storeRes.successCount, errors: storeRes.errorCount };
  },

  async [JobTypes.WEEKLY_INGEST](run){
    // Same as daily_ingest but can be scheduled weekly
    const { ContentAcquirer } = await import('../stages/content-acquirer.js');
    const { DatabaseStorage } = await import('../stages/database-storage.js');
    const db = new SupabaseClient();

    const { data: sources } = await db.client.from('accounts').select('username, last_scraped, active').eq('active', true);
    if (!sources || sources.length === 0) return { accounts: 0, newPosts: 0 };

    // Treat sources with zero posts as new (full scrape), others delta
    const accounts = [];
    for (const s of sources){
      let count = 0; let latest = null;
      try{
        const { count: c } = await db.client.from('posts').select('*', { count:'exact', head:true }).eq('username', s.username);
        count = c || 0;
        const { data: recent } = await db.client.from('posts').select('created_at').eq('username', s.username).order('created_at', { ascending:false }).limit(1);
        latest = recent && recent[0] ? recent[0].created_at : null;
      }catch(_){ /* ignore */ }
      accounts.push({ username: s.username, isNew: count === 0, existingPostCount: count, latestPostTimestamp: latest });
    }

    const acquirer = new ContentAcquirer();
    const storage = new DatabaseStorage();
    const posts = await acquirer.process(accounts);
    const storeRes = await storage.process(posts);
    return { accounts: accounts.length, scrapedPosts: posts.length, stored: storeRes.successCount, errors: storeRes.errorCount };
  },

  async [JobTypes.DISCOVER_OWNED_POSTS](run){
    const { SupabaseClient } = await import('../database/supabase-client.js');
    const { ApifyClient } = await import('apify-client');
    const db = new SupabaseClient();
    const apify = new ApifyClient({ token: process.env.APIFY_TOKEN });
    const { data: accounts } = await db.client
      .from('account_profiles')
      .select('username')
      .eq('is_active', true);
    let discovered = 0;
    for (const acc of (accounts||[])){
      // First try without '@', then fallback with '@' if empty
      const baseInput = {
        excludePinnedPosts: false,
        profileSorting: 'byDate',
        resultsPerPage: 50,
        profileScrapeSections: ['videos'],
        shouldDownloadVideos: false,
        shouldDownloadSlideshowImages: false
      };
      let items = [];
      for (const handle of [acc.username, `@${acc.username}`]){
        const input = { ...baseInput, profiles: [handle] };
        const runRes = await apify.actor('clockworks~tiktok-scraper').call(input);
        if (runRes.status !== 'SUCCEEDED') continue;
        const res = await apify.dataset(runRes.defaultDatasetId).listItems();
        items = res.items || [];
        if (items.length > 0) break;
      }
      for (const item of (items||[])){
        const postId = item.id;
        const url = item.shareUrl || item.webVideoUrl || '';
        const postedAt = item.createTimeISO ? new Date(item.createTimeISO).toISOString() : null;
        const { error } = await db.client
          .from('owned_posts')
          .upsert({ account_username: acc.username, platform: 'tiktok', platform_post_id: postId, url, caption: item.text || '', posted_at: postedAt }, { onConflict: 'platform,platform_post_id' });
        if (!error) discovered++;
      }
    }
    return { accounts: (accounts||[]).length, discovered };
  },

  async [JobTypes.FETCH_POST_METRICS](run){
    const { SupabaseClient } = await import('../database/supabase-client.js');
    const { ApifyClient } = await import('apify-client');
    const db = new SupabaseClient();
    const apify = new ApifyClient({ token: process.env.APIFY_TOKEN });
    const now = new Date();
    const sixtyDaysAgo = new Date(now.getTime() - 60*24*3600*1000);
    const mode = (run.payload && run.payload.mode) || 'daily'; // 'daily' or 'weekly'
    const cutoff = mode === 'daily' ? sixtyDaysAgo.toISOString() : null;
    let fetched = 0;
    // Pull posts to refresh
    let q = db.client.from('owned_posts').select('platform_post_id, account_username, posted_at').order('posted_at', { ascending: false });
    if (cutoff){ q = q.gte('posted_at', cutoff); } else { q = q.lt('posted_at', sixtyDaysAgo.toISOString()); }
    const { data: posts } = await q.limit(1000);
    for (const p of (posts||[])){
      const input = { postIds: [p.platform_post_id], shouldDownloadVideos: false, shouldDownloadSlideshowImages: false };
      try{
        const runRes = await apify.actor('clockworks~tiktok-scraper').call(input);
        if (runRes.status !== 'SUCCEEDED') continue;
        const { items } = await apify.dataset(runRes.defaultDatasetId).listItems();
        const it = (items||[])[0];
        if (!it) continue;
        const metrics = {
          platform: 'tiktok',
          platform_post_id: p.platform_post_id,
          collected_at: new Date().toISOString().slice(0,10),
          views: it.playCount || 0,
          likes: it.diggCount || 0,
          comments: it.commentCount || 0,
          shares: it.shareCount || 0,
          saves: it.saveCount || 0
        };
        await db.client.from('post_metrics').upsert(metrics, { onConflict: 'platform,platform_post_id,collected_at' });
        fetched++;
      }catch(_){ /* continue */ }
    }
    return { posts: (posts||[]).length, fetched };
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
      // enqueue follow-up only if there isn't already a queued wash_images job
      const { count: queuedCount } = await db.client
        .from('job_runs')
        .select('*', { count: 'exact', head: true })
        .eq('job_type', JobTypes.WASH_IMAGES)
        .eq('status', 'queued');
      if ((queuedCount || 0) === 0){
        const q = new DbQueue();
        await q.enqueue(JobTypes.WASH_IMAGES, { batch, idempotency_key: `wash_images:${Date.now()}`, force: true }, {});
      }
    }

    return { washed, remaining: count || 0 };
  },

  async [JobTypes.RUN_ONCE](run){ return { echo: run.payload || {} }; }
};


