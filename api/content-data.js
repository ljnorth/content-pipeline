import { SupabaseClient } from '../src/database/supabase-client.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Initialize database connection
    const db = new SupabaseClient();
    
    if (req.method === 'GET') {
      const { postId, type = 'info' } = req.query;
      
      if (!postId) {
        return res.status(400).json({ error: 'PostId is required' });
      }
      
      if (type === 'info') {
        // Get post metadata from Supabase database
        const { data: post, error } = await db.client
          .from('posts')
          .select('*')
          .eq('post_id', postId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            return res.status(404).json({ error: 'Post not found' });
          }
          throw error;
        }

        res.setHeader('Content-Type', 'application/json');
        res.status(200).json(post);
      } else if (type === 'images') {
        // Get images for this post from Supabase database
        const { data: images, error } = await db.client
          .from('images')
          .select('*')
          .eq('post_id', postId);

        if (error) {
          throw error;
        }

        res.setHeader('Content-Type', 'application/json');
        res.status(200).json(images || []);
      } else {
        return res.status(400).json({ error: 'Invalid type parameter. Use "info" or "images"' });
      }
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
    
  } catch (error) {
    console.error('Content data endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
} 