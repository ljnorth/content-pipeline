import { EnhancedSlackAPI } from '../src/slack/enhanced.js';

export default async function handler(req, res) {
  try {
    const slack = new EnhancedSlackAPI();
    const response = {
      slackEnabled: slack.enabled,
      hasWebhookEnv: !!process.env.SLACK_WEBHOOK_URL,
      slackChannel: slack.channel,
      previewBaseUrl: process.env.PREVIEW_BASE_URL || 'https://www.easypost.fun',
      nodeEnv: process.env.NODE_ENV || 'undefined',
      hasInfluencerApiBase: !!process.env.INFLUENCER_API_BASE,
      hasContentPipelineApiBase: !!process.env.CONTENT_PIPELINE_API_BASE,
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseAnonKey: !!process.env.SUPABASE_ANON_KEY,
      hasSupabaseServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    };
    res.json(response);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}


