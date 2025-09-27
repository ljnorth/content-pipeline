import { SupabaseClient } from '../database/supabase-client.js';
import { Logger } from '../utils/logger.js';

export class DeliveryRouter {
  constructor() {
    this.logger = new Logger();
  }

  async dispatch(generatedContent) {
    const results = Array.isArray(generatedContent?.results) ? generatedContent.results : [];
    const db = new SupabaseClient();

    for (const accountResult of results) {
      const username = accountResult?.account;
      if (!username) continue;

      const { data: profile } = await db.client
        .from('account_profiles')
        .select('username, delivery_channel, delivery_schedule_days, postforme_instagram_account_id')
        .eq('username', username)
        .single();

      const channel = (profile?.delivery_channel || 'slack').toLowerCase();

      if (channel === 'postforme_instagram') {
        await this.deliverToInstagram(accountResult, profile);
      } else {
        await this.deliverToSlack(accountResult);
      }
    }
  }

  async deliverToSlack(accountResult) {
    const { EnhancedSlackAPI } = await import('../slack/enhanced.js');
    const slack = new EnhancedSlackAPI();
    if (!slack.enabled) throw new Error('Slack webhook not configured; delivery_channel is slack');
    await slack.sendAccountConsolidated(accountResult);
  }

  async deliverToInstagram(accountResult, profile) {
    const spfId = profile?.postforme_instagram_account_id;
    if (!spfId) throw new Error(`postforme_instagram_account_id missing for ${profile?.username}`);

    const { PostForMe } = await import('../integrations/postforme.js');
    const pfm = new PostForMe();

    const posts = Array.isArray(accountResult?.posts) ? accountResult.posts : [];
    if (!posts.length) throw new Error(`No posts to deliver for ${profile?.username}`);

    for (const post of posts) {
      const imgs = Array.isArray(post?.images) ? post.images : [];
      const media = imgs
        .map(i => i?.imagePath || i?.image_path)
        .filter(Boolean)
        .map(url => ({ url }));

      if (!media.length) throw new Error(`Post has no media for ${profile?.username}`);

      const caption = String(post?.caption || '').trim();
      const days = Number(profile?.delivery_schedule_days || 0);
      let scheduled_at = null;
      if (Number.isFinite(days) && days > 0) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        scheduled_at = d.toISOString();
      }

      const res = await pfm.createPost({
        caption,
        media,
        social_accounts: [spfId],
        scheduled_at
      });

      this.logger.info(`📤 PostForMe created post for ${profile?.username}: ${res?.id || '-'}`);
    }
  }
}



