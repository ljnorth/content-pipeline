import { Logger } from '../utils/logger.js';

export class SlackAPI {
  constructor() {
    this.logger = new Logger();
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
    this.channel = process.env.SLACK_CHANNEL || '#content-pipeline';
    this.enabled = !!this.webhookUrl;
    this.baseUrl = process.env.VERCEL_URL || 'https://content-pipeline.vercel.app';
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

    // Store preview first
    let previewData = null;
    try {
      previewData = await this.storePreview(account, posts);
      this.logger.info(`✅ Preview stored: ${previewData.previewUrl}`);
    } catch (error) {
      this.logger.warn(`⚠️ Failed to store preview: ${error.message}`);
    }

    const uploads = [];
    for (const post of posts) {
      try {
        uploads.push(await this.sendPostToSlack(account, post, previewData));
      } catch (error) {
        this.logger.error(`❌ Failed to send post ${post.postNumber}: ${error.message}`);
        uploads.push({ postNumber: post.postNumber, success: false, error: error.message });
      }
    }
    return { account, success: true, uploads, previewData };
  }

  /**
   * Store preview data for Slack integration
   */
  async storePreview(accountUsername, posts) {
    try {
      const response = await fetch(`${this.baseUrl}/api/store-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountUsername,
          posts,
          generationId: `slack_${Date.now()}_${accountUsername}`
        })
      });

      if (!response.ok) {
        throw new Error(`Preview storage failed: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw new Error(`Failed to store preview: ${error.message}`);
    }
  }

  /**
   * Send a single post to Slack via webhook.
   */
  async sendPostToSlack(accountUsername, post, previewData = null) {
    const payload = this.buildSlackPayload(accountUsername, post, previewData);

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
  buildSlackPayload(accountUsername, post, previewData = null) {
    const attachment = {
      color: '#667eea',
      title: `Generated Post for @${accountUsername}`,
      text: `*Caption:*\n${post.caption}`,
      footer: 'Content Pipeline • Click title to view full preview',
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

    // Add preview link if available
    if (previewData) {
      attachment.fields.push({ 
        title: 'Preview Link', 
        value: `<${previewData.previewUrl}|View Full Details & Download>`, 
        short: false 
      });
    }

    const imageUrls = post.images.slice(0, 3).map(img => img.imagePath);
    if (imageUrls.length) {
      attachment.image_url = imageUrls[0];
      if (imageUrls.length > 1) {
        attachment.fields.push({ title: 'More Images', value: imageUrls.slice(1).join('\n'), short: false });
      }
    }

    // Add action buttons if preview is available
    if (previewData) {
      attachment.actions = [
        {
          type: 'button',
          text: '👀 View Preview',
          url: previewData.previewUrl,
          style: 'primary'
        },
        {
          type: 'button',
          text: '📥 Download All',
          url: previewData.downloadUrl,
          style: 'default'
        }
      ];
    }

    return {
      channel: this.channel,
      username: 'Content Pipeline Bot',
      icon_emoji: ':sparkles:',
      attachments: [attachment]
    };
  }
} 