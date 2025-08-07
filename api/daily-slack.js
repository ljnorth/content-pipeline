import { EnhancedSlackAPI } from '../src/slack/enhanced.js';
import { SupabaseClient } from '../src/database/supabase-client.js';
import { ContentGenerator } from '../src/automation/content-generator.js';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  try {
    const db = new SupabaseClient();
    const slack = new EnhancedSlackAPI();
    const generator = new ContentGenerator();

    // Find accounts with autogen enabled
    const { data: accounts } = await db.client
      .from('account_profiles')
      .select('username, content_strategy, owner_slack_id, owner_display_name')
      .eq('is_active', true);

    const enabled = (accounts || []).filter(a => a?.content_strategy?.autogenEnabled === true);

    const results = [];
    for (const acc of enabled) {
      try {
        // build a minimal account object the generator can use
        const account = { username: acc.username };
        const posts = await generator.generateContentForAccount(account);
        results.push({ account: acc.username, success: true, posts: posts.length });

        // send consolidated to Slack and store preview
        await slack.sendAccountConsolidated({ account: acc.username, posts });
      } catch (e) {
        results.push({ account: acc.username, success: false, error: e.message });
      }
    }

    res.json({ success: true, count: results.length, results });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}


