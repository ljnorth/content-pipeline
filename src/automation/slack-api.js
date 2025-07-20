import { Logger } from '../utils/logger.js';

export class SlackAPI {
  constructor() {
    this.logger = new Logger();
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
    this.channel = process.env.SLACK_CHANNEL || '#content-pipeline';
    this.enabled = !!this.webhookUrl;

    this.logger.info(`🔗 Slack API initialized - ${this.enabled ? 'Enabled' : 'Disabled (no webhook URL)'}`);
  }

  /**
   * Send an array of generated content results to Slack.
   */
  async sendPostsToSlack(generatedContent) {
    if (!this.enabled) {
      this.logger.warn('⚠️ Slack integration disabled - no webhook URL configured');
      return { success: false, error: 'Slack webhook URL not configured' };
    }

    const results = [];

    for (const accountResult of generatedContent.results) {
      if (!accountResult.success) {
        results.push({ account: accountResult.account, success: false, error: 'Generation failed' });
        continue;
      }
      results.push(await this.sendAccountPosts(accountResult));
    }

    return { success: true, results };
  }

  /**
   * Send every post for a single account.
   */
  async sendAccountPosts(accountResult) {
    const { account, posts } = accountResult;
    this.logger.info(`📤 Sending ${posts.length} posts for @${account} to Slack`);

    const uploads = [];
    for (const post of posts) {
      try {
        uploads.push(await this.sendPostToSlack(account, post));
      } catch (error) {
        this.logger.error(`❌ Failed to send post ${post.postNumber}: ${error.message}`);
        uploads.push({ postNumber: post.postNumber, success: false, error: error.message });
      }
    }
    return { account, success: true, uploads };
  }

  /**
   * Send a single post to Slack via webhook.
   */
  async sendPostToSlack(accountUsername, post) {
    const payload = this.buildSlackPayload(accountUsername, post);

    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
    }

    this.logger.info(`✅ Sent post ${post.postNumber} for @${accountUsername} to Slack`);
    return { postNumber: post.postNumber, success: true };
  }

  /**
   * Construct a rich Slack message payload for a generated post.
   */
  buildSlackPayload(accountUsername, post) {
    const attachment = {
      color: '#667eea',
      title: `Generated Post for @${accountUsername}`,
      text: `*Caption:*\n${post.caption}`,
      footer: 'Content Pipeline',
      ts: Math.floor(Date.now() / 1000),
      fields: [
        { title: 'Post', value: post.postNumber.toString(), short: true },
        { title: 'Images', value: post.images.length.toString(), short: true },
        { title: 'Aesthetic', value: post.images[0]?.aesthetic || 'N/A', short: true }
      ]
    };

    if (post.hashtags?.length) {
      attachment.fields.push({ title: 'Hashtags', value: post.hashtags.join(' '), short: false });
    }

    const imageUrls = post.images.slice(0, 3).map(img => img.imagePath);
    if (imageUrls.length) {
      attachment.image_url = imageUrls[0];
      if (imageUrls.length > 1) {
        attachment.fields.push({ title: 'More Images', value: imageUrls.slice(1).join('\n'), short: false });
      }
    }

    return {
      channel: this.channel,
      username: 'Content Pipeline Bot',
      icon_emoji: ':sparkles:',
      attachments: [attachment]
    };
  }
} 