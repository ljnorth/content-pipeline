import { createClient } from '@supabase/supabase-js';

export class SupabaseClient {
  constructor() {
    if (!process.env.SUPABASE_URL) {
      throw new Error('SUPABASE_URL is not set in environment variables');
    }
    
    // Use service role key if available (for admin operations), otherwise use anon key
    const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!apiKey) {
      throw new Error('Neither SUPABASE_SERVICE_ROLE_KEY nor SUPABASE_ANON_KEY is set in environment variables');
    }
    
    this.client = createClient(process.env.SUPABASE_URL, apiKey);
  }

  async getAccount(username) {
    const { data, error } = await this.client
      .from('accounts')
      .select('*')
      .eq('username', username)
      .single();
    if (error) return null;
    return data;
  }

  async upsertAccount(account) {
    const { error } = await this.client.from('accounts').upsert(account);
    if (error) throw error;
  }

  async insertImages(images) {
    const { error } = await this.client.from('images').insert(images);
    if (error) throw error;
  }

  async insertPosts(posts) {
    if (!posts.length) return;
    const { error } = await this.client
      .from('posts')
      .upsert(posts, { onConflict: 'post_id' });
    if (error) throw error;
  }

  async updateAccountScraped(username, timestamp) {
    const { error } = await this.client
      .from('accounts')
      .update({ last_scraped: timestamp })
      .eq('username', username);
    if (error) throw error;
  }

  async getAllAccounts() {
    const { data, error } = await this.client
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  }

  async deleteAccount(username) {
    const { error } = await this.client
      .from('accounts')
      .delete()
      .eq('username', username);
    if (error) throw error;
  }

  // New methods for incremental loading
  async getExistingPostIds(username) {
    const { data, error } = await this.client
      .from('posts')
      .select('post_id')
      .eq('username', username);
    if (error) throw error;
    return data ? data.map(post => post.post_id) : [];
  }

  async getLatestPostTimestamp(username) {
    const { data, error } = await this.client
      .from('posts')
      .select('post_timestamp')
      .eq('username', username)
      .order('post_timestamp', { ascending: false })
      .limit(1)
      .single();
    if (error) return null;
    return data ? data.post_timestamp : null;
  }

  async getPostCount(username) {
    const { count, error } = await this.client
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('username', username);
    if (error) throw error;
    return count || 0;
  }
} 