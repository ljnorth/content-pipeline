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
      const { data: posts, error } = await db.client
        .from('generated_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching generated posts:', error);
        return res.status(500).json({ error: 'Failed to fetch generated posts' });
      }

      res.status(200).json(posts || []);
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
    
  } catch (error) {
    console.error('Generated posts endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
} 