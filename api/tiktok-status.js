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
      // Get username from query parameter
      const { username } = req.query;
      
      if (!username) {
        return res.status(400).json({ error: 'Username parameter is required' });
      }
      
      console.log('Checking TikTok status for:', username);
      
      const { data: profile, error } = await db.client
        .from('account_profiles')
        .select('tiktok_access_token, tiktok_refresh_token, tiktok_expires_at, tiktok_connected_at')
        .eq('username', username)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Profile not found' });
        }
        throw error;
      }

      if (!profile.tiktok_access_token) {
        return res.status(200).json({
          connected: false,
          message: 'TikTok not connected'
        });
      }

      // Check if token is expired
      const isExpired = profile.tiktok_expires_at && new Date(profile.tiktok_expires_at) < new Date();
      
      res.status(200).json({
        connected: true,
        isExpired,
        connectedAt: profile.tiktok_connected_at,
        expiresAt: profile.tiktok_expires_at,
        hasRefreshToken: !!profile.tiktok_refresh_token,
        accessToken: profile.tiktok_access_token ? 'Present' : 'Missing'
      });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
    
  } catch (error) {
    console.error('TikTok status endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
} 