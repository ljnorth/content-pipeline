import { SupabaseClient } from '../src/database/supabase-client.js';
import { SlackAPI } from '../src/slack/index.js';

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

    // Store preview first
    let previewData = null;
    try {
      const previewResponse = await fetch(`https://${process.env.VERCEL_URL || 'content-pipeline.vercel.app'}/api/store-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountUsername,
          posts,
          generationId: `slack_${Date.now()}_${accountUsername}`
        })
      });

      if (previewResponse.ok) {
        previewData = await previewResponse.json();
        console.log(`✅ Preview stored: ${previewData.previewUrl}`);
      } else {
        const errorText = await previewResponse.text();
        console.warn('⚠️ Failed to store preview:', errorText);
      }
    } catch (error) {
      console.warn('⚠️ Preview storage failed:', error.message);
    }

    for (const post of posts) {
      try {
        const result = await slackAPI.sendPostToSlack(accountUsername, post, previewData);

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
    
    res.status(200).json({ 
      success: successfulUploads === uploads.length, 
      uploads,
      previewData: previewData ? {
        previewUrl: previewData.previewUrl,
        downloadUrl: previewData.downloadUrl
      } : null
    });
  } catch (error) {
    console.error('Slack upload error:', error);
    res.status(500).json({ error: error.message });
  }
} 