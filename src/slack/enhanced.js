import { Logger } from '../utils/logger.js';
import { SupabaseClient } from '../database/supabase-client.js';

export class EnhancedSlackAPI {
  constructor() {
    this.logger = new Logger();
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
    this.channel = process.env.SLACK_CHANNEL || '#content-pipeline';
    this.previewBaseUrl = process.env.PREVIEW_BASE_URL || 'https://easypost.fun';
    this.enabled = !!this.webhookUrl;
    this.db = new SupabaseClient();

    this.logger.info(`🔗 Enhanced Slack API initialized - ${this.enabled ? 'Enabled' : 'Disabled (no webhook URL)'}`);
  }

  /**
   * Send consolidated posts to Slack with preview links
   */
  async sendConsolidatedPosts(generatedContent) {
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
      results.push(await this.sendAccountConsolidated(accountResult));
    }

    return { success: true, results };
  }

  /**
   * Send consolidated posts for a single account as one rich message
   */
  async sendAccountConsolidated(accountResult) {
    const { account, posts } = accountResult;
    this.logger.info(`📤 Sending consolidated batch for @${account} (${posts.length} posts) to Slack`);

    try {
      // Generate unique batch ID
      const batchId = `batch_${Date.now()}_${account}`;
      
      // Store batch data in live database
      await this.storeBatchData(batchId, account, posts);
      
      // Get account profile for owner tagging
      let accountProfile = null;
      try {
        const { SupabaseClient } = await import('../database/supabase-client.js');
        const db = new SupabaseClient();
        const { data } = await db.client
          .from('account_profiles')
          .select('owner_slack_id, owner_display_name')
          .eq('username', account)
          .single();
        accountProfile = data;
      } catch (profileError) {
        this.logger.warn(`⚠️ Could not fetch account profile for @${account}: ${profileError.message}`);
      }
      
      // Create consolidated Slack message
      const payload = await this.buildConsolidatedPayload(account, posts, batchId, accountProfile);

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
      }

      this.logger.info(`✅ Sent consolidated batch for @${account} to Slack`);
      return { 
        account, 
        success: true, 
        batchId,
        previewUrl: `${this.previewBaseUrl}/postpreview/${batchId}`,
        postsCount: posts.length 
      };

    } catch (error) {
      this.logger.error(`❌ Failed to send consolidated batch for @${account}: ${error.message}`);
      return { account, success: false, error: error.message };
    }
  }

  /**
   * Store batch data directly in database
   */
  async storeBatchData(batchId, accountUsername, posts) {
    try {
      // Store batch data in database for persistence
      const batchData = {
        preview_id: batchId,
        account_username: accountUsername,
        posts: posts,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      };

      // Insert or update batch data
      const { error } = await this.db.client
        .from('preview_batches')
        .upsert(batchData, { onConflict: 'preview_id' });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      this.logger.info(`✅ Stored batch ${batchId} for preview`);
      return { 
        success: true, 
        batchId,
        previewUrl: `${this.previewBaseUrl}/postpreview/${batchId}`
      };
    } catch (error) {
      this.logger.warn(`⚠️ Could not store batch in preview system: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build consolidated Slack message payload
   */
  async buildConsolidatedPayload(accountUsername, posts, batchId, accountProfile = null) {
    const totalImages = posts.reduce((sum, post) => sum + post.images.length, 0);
    const aesthetics = [...new Set(posts.map(post => post.images[0]?.aesthetic).filter(a => a))];
    const previewUrl = `${this.previewBaseUrl}/postpreview/${batchId}`;

    // Get owner tag if account profile has owner info
    const ownerTag = accountProfile?.owner_slack_id ? `<@${accountProfile.owner_slack_id}> ` : '';

    // Create post summaries for the Slack message
    const postSummaries = posts.map(post => {
      const caption = post.caption.length > 80 
        ? post.caption.substring(0, 80) + '...' 
        : post.caption;
      const imageCount = post.images.length;
      const aesthetic = post.images[0]?.aesthetic || 'Mixed';
      
      return `*Post ${post.postNumber}:* ${caption}\n` +
             `   📸 ${imageCount} images • 🎨 ${aesthetic}`;
    }).join('\n\n');

    const attachment = {
      color: '#667eea',
      title: `🎨 Content Generated for @${accountUsername}`,
      title_link: previewUrl,
      text: `${ownerTag}Generated ${posts.length} posts with ${totalImages} total images\n\n${postSummaries}`,
      footer: 'Content Pipeline • Click title to view full preview',
      ts: Math.floor(Date.now() / 1000),
      fields: [
        { 
          title: 'Posts Generated', 
          value: posts.length.toString(), 
          short: true 
        },
        { 
          title: 'Total Images', 
          value: totalImages.toString(), 
          short: true 
        },
        { 
          title: 'Aesthetics', 
          value: aesthetics.join(', ') || 'Mixed', 
          short: true 
        },
        { 
          title: 'Live Preview', 
          value: `<${previewUrl}|View & Download All>`, 
          short: true 
        }
      ],
      actions: [
        {
          type: 'button',
          text: '👀 View Preview',
          url: previewUrl,
          style: 'primary'
        },
        {
          type: 'button', 
          text: '📥 Download All',
          url: `${previewUrl.replace('/postpreview/', '/api/postpreview/download/')}`,
          style: 'default'
        }
      ]
    };

    // Add first image as thumbnail if available
    if (posts[0]?.images?.[0]?.imagePath) {
      attachment.thumb_url = posts[0].images[0].imagePath;
    }

    return {
      channel: this.channel,
      username: 'Content Pipeline Bot',
      icon_emoji: '🎨',
      attachments: [attachment]
    };
  }

  /**
   * Legacy batch storage methods (kept for compatibility)
   */
  static batchStorage = new Map();

  static storeBatch(batchId, accountUsername, posts) {
    this.batchStorage.set(batchId, {
      batchId,
      accountUsername,
      posts,
      createdAt: new Date().toISOString(),
      totalImages: posts.reduce((sum, post) => sum + post.images.length, 0)
    });
  }

  static getBatch(batchId) {
    return this.batchStorage.get(batchId);
  }

  static getAllBatches() {
    return Array.from(this.batchStorage.values()).sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  async sendPostsIndividually(accountResult) {
    const { account, posts } = accountResult;
    if (!this.enabled) return { account, success: false, error: 'Slack not configured' };

    const batchId = `batch_${Date.now()}_${account}`;
    
    // Store batch data in live system
    try {
      await this.storeBatchData(batchId, account, posts);
    } catch (e) {
      this.logger.warn('⚠️ Could not store batch in preview system: ' + e.message);
    }

    let successCount = 0;
    const uploads = [];
    for (const post of posts) {
      try {
        const payload = this.buildSinglePostPayload(account, post, batchId);
        const response = await fetch(this.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`Slack error ${response.status}`);
        successCount++;
        uploads.push({ postNumber: post.postNumber, success: true });
      } catch (err) {
        this.logger.error(`Post ${post.postNumber} failed: ${err.message}`);
        uploads.push({ postNumber: post.postNumber, success: false, error: err.message });
      }
    }

    return { account, success: successCount === posts.length, uploads, batchId };
  }

  buildSinglePostPayload(accountUsername, post, batchId) {
    const previewUrl = `${this.previewBaseUrl}/postpreview/${batchId}`;
    const captionPreview = post.caption.length > 150 ? post.caption.substring(0, 147) + '…' : post.caption;

    const attachment = {
      color: '#764ba2',
      title: `Post ${post.postNumber} for @${accountUsername}`,
      title_link: `${previewUrl}#post${post.postNumber}`,
      text: `${captionPreview}\n\n📸 ${post.images.length} images • 🎨 ${post.images[0]?.aesthetic || 'Mixed'}`,
      footer: 'Content Pipeline – click title for full preview',
      ts: Math.floor(Date.now() / 1000),
      fields: [
        { title: 'Images', value: post.images.length.toString(), short: true },
        { title: 'Hashtags', value: post.hashtags.length.toString(), short: true }
      ],
      actions: [
        {
          type: 'button',
          text: '👀 View Preview',
          url: `${previewUrl}#post${post.postNumber}`,
          style: 'primary'
        },
        {
          type: 'button',
          text: '📥 Download',
          url: `${this.previewBaseUrl}/api/postpreview/download/${batchId}`,
          style: 'default'
        }
      ]
    };

    if (post.images[0]?.imagePath) attachment.thumb_url = post.images[0].imagePath;

    return {
      channel: this.channel,
      username: 'Content Pipeline Bot',
      icon_emoji: ':sparkles:',
      attachments: [attachment]
    };
  }
}

// Legacy compatibility - wrapper around enhanced API
export class SlackAPI extends EnhancedSlackAPI {
  async sendPostsToSlack(generatedContent, mode = 'individual') {
    if (mode === 'individual') {
      const results = [];
      for (const accountResult of generatedContent.results) {
        results.push(await this.sendPostsIndividually(accountResult));
      }
      return { success: results.every(r => r.success), results };
    }
    return this.sendConsolidatedPosts(generatedContent);
  }

  async sendPostToSlack(accountUsername, post) {
    // For single posts, create a mini-batch
    const batch = {
      results: [{
        success: true,
        account: accountUsername,
        posts: [post]
      }]
    };
    const result = await this.sendConsolidatedPosts(batch);
    return result.results[0];
  }
} 