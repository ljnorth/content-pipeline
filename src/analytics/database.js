import { SupabaseClient } from '../database/supabase-client.js';

export class DatabaseAnalytics {
  constructor() {
    this.db = new SupabaseClient();
  }

  async checkDatabaseImages() {
    try {
      console.log('🔍 Checking database images...\n');
      
      // Get all images
      const { data: images, error } = await this.db.client
        .from('images')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Error fetching images:', error);
        return;
      }
      
      console.log(`📊 Total images in database: ${images.length}\n`);
      
      // Group by storage type
      const storageImages = images.filter(img => img.image_path?.startsWith('http'));
      const localImages = images.filter(img => !img.image_path?.startsWith('http'));
      
      console.log(`✅ Storage images (public URLs): ${storageImages.length}`);
      console.log(`❌ Local path images: ${localImages.length}\n`);
      
      // Show recent images
      console.log('📝 Recent images:');
      console.log('================');
      
      const recentImages = images.slice(0, 10);
      recentImages.forEach((img, index) => {
        const isStorage = img.image_path?.startsWith('http');
        const icon = isStorage ? '✅' : '❌';
        const type = isStorage ? 'STORAGE' : 'LOCAL';
        
        console.log(`${index + 1}. ${icon} [${type}] ${img.username} - ${img.post_id}`);
        console.log(`   Path: ${img.image_path?.substring(0, 80)}...`);
        console.log(`   Created: ${new Date(img.created_at).toLocaleString()}\n`);
      });
      
      // Show post count
      const { data: posts } = await this.db.client
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });
      
      console.log(`📊 Total posts in database: ${posts?.length || 0}`);
      
      // Show account status
      const { data: accounts } = await this.db.client
        .from('accounts')
        .select('*');
      
      console.log(`📊 Total accounts in database: ${accounts?.length || 0}`);
      accounts?.forEach(acc => {
        console.log(`   - ${acc.username} (last scraped: ${acc.last_scraped ? new Date(acc.last_scraped).toLocaleString() : 'never'})`);
      });

      return {
        totalImages: images.length,
        storageImages: storageImages.length,
        localImages: localImages.length,
        totalPosts: posts?.length || 0,
        totalAccounts: accounts?.length || 0,
        recentImages: recentImages,
        accounts: accounts || []
      };
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      throw error;
    }
  }

  async getDatabaseStats() {
    try {
      const stats = {};
      
      // Count images
      const { count: imageCount } = await this.db.client
        .from('images')
        .select('*', { count: 'exact', head: true });
      
      // Count posts
      const { count: postCount } = await this.db.client
        .from('posts')
        .select('*', { count: 'exact', head: true });
      
      // Count accounts
      const { count: accountCount } = await this.db.client
        .from('accounts')
        .select('*', { count: 'exact', head: true });
      
      // Count hook slides
      const { count: hookSlideCount } = await this.db.client
        .from('hook_slides')
        .select('*', { count: 'exact', head: true });
      
      // Count generated posts
      const { count: generatedPostCount } = await this.db.client
        .from('generated_posts')
        .select('*', { count: 'exact', head: true });

      return {
        images: imageCount || 0,
        posts: postCount || 0,
        accounts: accountCount || 0,
        hookSlides: hookSlideCount || 0,
        generatedPosts: generatedPostCount || 0
      };
      
    } catch (error) {
      console.error('❌ Error getting database stats:', error.message);
      throw error;
    }
  }
} 