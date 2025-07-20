import { Logger } from '../utils/logger.js';
import { SupabaseClient } from '../database/supabase-client.js';
import { SupabaseStorage } from '../utils/supabase-storage.js';

export class DatabaseStorage {
  constructor() {
    this.logger = new Logger();
    this.db = new SupabaseClient();
    this.storage = new SupabaseStorage();
    
    // Validate database connection
    if (!this.db || !this.db.client) {
      throw new Error('Failed to initialize Supabase client');
    }
  }

  async process(posts) {
    this.logger.info(`💾 Storing ${posts.length} posts in database`);
    
    if (!Array.isArray(posts) || posts.length === 0) {
      this.logger.info(`⚠️ No posts to store`);
      return { successCount: 0, errorCount: 0 };
    }
    
    let successCount = 0;
    let errorCount = 0;

    for (const post of posts) {
      try {
        this.logger.info(`💾 Processing post ${post?.post_id || 'unknown'} for storage`);
        await this.storePost(post);
        successCount++;
        this.logger.info(`✅ Successfully stored post ${post?.post_id || 'unknown'}`);
      } catch (error) {
        this.logger.error(`❌ Failed to store post ${post?.post_id || 'unknown'}: ${error.message}`);
        this.logger.error(`❌ Post data: ${JSON.stringify(post, null, 2)}`);
        errorCount++;
      }
    }

    this.logger.info(`✅ Database storage complete: ${successCount} successful, ${errorCount} failed`);
    return { successCount, errorCount };
  }

  async storePost(post) {
    try {
      // Validate required fields
      if (!post || !post.post_id || !post.username) {
        throw new Error('Missing required post data: post_id and username are required');
      }

      // Store the main post metadata
      const postData = {
        username: post.username,
        post_id: post.post_id,
        post_timestamp: post.post_timestamp || new Date().toISOString(),
        like_count: post.like_count || 0,
        comment_count: post.comment_count || 0,
        view_count: post.view_count || 0,
        save_count: post.save_count || 0,
        engagement_rate: post.engagement_rate || 0,
        video_path: post.video_path || null,
        text: post.text || '',
        web_video_url: post.web_video_url || null,
        created_at: post.created_at || new Date().toISOString()
      };

      // Insert or update the post
      const { error: postError } = await this.db.client
        .from('posts')
        .upsert(postData, { onConflict: 'post_id' });

      if (postError) {
        throw new Error(`Post upsert failed: ${postError.message}`);
      }

      // Store individual images if any
      if (post.image_paths && post.image_paths.length > 0) {
        for (let i = 0; i < post.image_paths.length; i++) {
          const localImagePath = post.image_paths[i];
          const analysis = post.image_analyses ? post.image_analyses[i] : null;
          
          // Upload image to Supabase Storage (REQUIRED - no fallback)
          const filename = localImagePath.split('/').pop();
          const { publicUrl, storagePath } = await this.storage.uploadImage(
            localImagePath,
            post.username,
            post.post_id,
            filename
          );
          
          this.logger.info(`✅ Uploaded image to storage: ${filename} -> ${publicUrl}`);
          
          const imageData = {
            post_id: post.post_id,
            username: post.username,
            image_path: publicUrl, // Always use public URL from storage
            image_index: i + 1,
            image_type: this.getImageType(localImagePath),
            aesthetic: analysis?.aesthetic || null,
            colors: Array.isArray(analysis?.colors) ? analysis.colors : null,
            season: analysis?.season || null,
            occasion: analysis?.occasion || null,
            additional: Array.isArray(analysis?.additional) ? analysis.additional : null,
            created_at: new Date().toISOString()
          };

          const { error: imageError } = await this.db.client
            .from('images')
            .upsert(imageData, { onConflict: 'post_id,image_index' });

          if (imageError) {
            this.logger.error(`❌ Failed to store image ${i + 1} for post ${post.post_id}: ${imageError.message}`);
          }
        }

        this.logger.info(`✅ Stored ${post.image_paths.length} images for post ${post.post_id}`);
      }

      // Update account last_scraped timestamp
      await this.updateAccountScraped(post.username);

      this.logger.info(`✅ Successfully stored post ${post.post_id} with ${post.image_paths?.length || 0} images`);

    } catch (error) {
      this.logger.error(`❌ Database storage failed for post ${post.post_id}: ${error.message}`);
      throw error;
    }
  }

  async updateAccountScraped(username) {
    try {
      const { error } = await this.db.client
        .from('accounts')
        .update({ 
          last_scraped: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('username', username);

      if (error) {
        this.logger.error(`❌ Failed to update account ${username} last_scraped: ${error.message}`);
      }
    } catch (error) {
      this.logger.error(`❌ Error updating account ${username}: ${error.message}`);
    }
  }

  getImageType(imagePath) {
    if (imagePath.includes('slide_')) {
      return 'slideshow';
    } else if (imagePath.includes('_image')) {
      return 'single';
    } else {
      return 'unknown';
    }
  }
}
