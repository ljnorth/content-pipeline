import { SupabaseClient } from '../src/database/supabase-client.js';
import { ContentGenerator } from '../src/automation/content-generator.js';
import { EnhancedSlackAPI } from '../src/slack/enhanced.js';

export default async function handler(req, res) {
  try {
    const db = new SupabaseClient();
    const generator = new ContentGenerator();
    const slack = new EnhancedSlackAPI();

    const username = req.method === 'POST' ? req.body?.username : req.query?.username;

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
    for (const acc of accounts) {
      try {
        const posts = await generator.generateContentForAccount(acc);
        await slack.sendAccountConsolidated({ account: acc.username, posts });
        results.push({ account: acc.username, success: true, posts: posts.length });
      } catch (e) {
        results.push({ account: acc.username, success: false, error: e.message });
      }
    }

    res.json({ success: true, results });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}


