import { SupabaseClient } from '../src/database/supabase-client.js';
import { SlackAPI } from '../src/automation/slack-api.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { accountUsername, posts } = req.body;
    if (!accountUsername || !Array.isArray(posts)) {
      res.status(400).json({ error: 'accountUsername and posts array are required' });
      return;
    }

    const slackAPI = new SlackAPI();
    if (!slackAPI.enabled) {
      res.status(400).json({ error: 'Slack integration not configured' });
      return;
    }

    const db = new SupabaseClient();
    const uploads = [];

    for (const post of posts) {
      try {
        const result = await slackAPI.sendPostToSlack(accountUsername, post);

        // Save to DB
        await db.client.from('generated_posts').insert({
          account_username: accountUsername,
          platform_post_id: `slack_${Date.now()}`,
          caption: post.caption,
          hashtags: post.hashtags,
          platform: 'slack',
          status: 'sent',
          posted_at: new Date().toISOString()
        });

        uploads.push({ postNumber: post.postNumber, success: result.success });
      } catch (error) {
        uploads.push({ postNumber: post.postNumber, success: false, error: error.message });
      }
    }

    const successfulUploads = uploads.filter(u => u.success).length;
    res.status(200).json({ success: successfulUploads === uploads.length, uploads });
  } catch (error) {
    console.error('Slack upload error:', error);
    res.status(500).json({ error: error.message });
  }
} 