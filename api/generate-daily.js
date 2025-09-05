import { SupabaseClient } from '../src/database/supabase-client.js';
import { EnhancedSlackAPI } from '../src/slack/enhanced.js';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const db = new SupabaseClient();
    const slack = new EnhancedSlackAPI();

    const username = req.method === 'POST' ? req.body?.username : req.query?.username;
    const previewFlag = req.method === 'POST' ? (req.body?.preview ?? req.query?.preview) : req.query?.preview;
    const preview = String(previewFlag).toLowerCase() === '1' || String(previewFlag).toLowerCase() === 'true';

    let accounts = [];
    if (username) {
      accounts = [{ username }];
    } else {
      // All enabled accounts
      const { data } = await db.client
        .from('account_profiles')
        .select('username, content_strategy')
        .eq('is_active', true);
      accounts = (data || []).filter(a => a?.content_strategy?.autogenEnabled).map(a => ({ username: a.username }));
    }

    const results = [];

    const useFallback = !process.env.OPENAI_API_KEY;
    const mod = await import('../src/automation/content-generator.js');
    const { ContentGenerator } = mod;
    const generator = new ContentGenerator();
    const supabaseLite = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    // Helper: simple random images selector
    async function pickRandomImages(count) {
      const { data: rows } = await supabaseLite.from('images').select('*').limit(5000);
      const arr = rows || [];
      // shuffle
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr.slice(0, count).map((img, idx) => ({
        id: img.id,
        imagePath: img.image_path,
        image_path: img.image_path,
        aesthetic: img.aesthetic || 'mixed',
        is_cover_slide: idx === 0
      }));
    }

    for (const acc of accounts) {
      try {
        let posts;
        // Always use curated/anchor selection; if OpenAI is missing, run in preview mode to skip captions
        const effectivePreview = preview || useFallback;
        posts = await generator.generateContentForAccount(acc, { preview: effectivePreview });

        // If preview mode, skip Slack and just return posts
        if (preview) {
          results.push({ account: acc.username, success: true, posts: posts.length, preview: true, postsData: posts });
        } else if (useFallback) {
          // No captions without OpenAI; return result instead of Slack so users can preview
          results.push({ account: acc.username, success: true, posts: posts.length, fallback: true, postsData: posts });
        } else if (!slack.enabled) {
          results.push({ account: acc.username, success: false, posts: posts.length, fallback: useFallback, error: 'Slack webhook not configured' });
        } else {
          const slackResult = await slack.sendAccountConsolidated({ account: acc.username, posts });
          results.push({
            account: acc.username,
            success: slackResult?.success === true,
            posts: posts.length,
            fallback: useFallback,
            slack: slackResult
          });
        }
      } catch (e) {
        results.push({ account: acc.username, success: false, error: e.message });
      }
    }

    res.json({ success: true, results });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}


