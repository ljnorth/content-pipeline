import { SupabaseClient } from '../src/database/supabase-client.js';
import { TikTokAPI } from '../src/automation/tiktok-api.js';

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
    // Initialize database connection and TikTok API
    const db = new SupabaseClient();
    const tiktokAPI = new TikTokAPI();
    
    if (req.method === 'POST') {
      const { username, postData } = req.body;
      
      if (!username || !postData) {
        return res.status(400).json({ error: 'Username and postData are required' });
      }
      
      console.log(`📤 Uploading post to TikTok for @${username}...`);
      
      // Check if account is connected to TikTok
      const { data: profile, error: profileError } = await db.client
        .from('account_profiles')
        .select('tiktok_access_token')
        .eq('username', username)
        .eq('is_active', true)
        .single();
      
      if (profileError || !profile || !profile.tiktok_access_token) {
        return res.status(400).json({ 
          error: 'Account not connected to TikTok. Please connect first.' 
        });
      }
      
      // Create post object for TikTok API
      const post = {
        postNumber: 1,
        caption: postData.caption,
        hashtags: postData.hashtags || [],
        images: postData.images.map((imageUrl, index) => ({
          id: `image_${index}`,
          imagePath: imageUrl
        })),
        accountUsername: username
      };
      
      // Upload to TikTok
      const uploadResult = await tiktokAPI.realUploadPost(username, post);
      
      if (uploadResult.success) {
        // Save to database
        const { error: dbError } = await db.client
          .from('generated_posts')
          .insert({
            account_username: username,
            platform_post_id: uploadResult.publishId,
            caption: uploadResult.caption,
            hashtags: uploadResult.hashtags,
            posted_at: uploadResult.uploadedAt,
            status: uploadResult.status,
            platform: 'tiktok'
          });
        
        if (dbError) {
          console.error('Database save error:', dbError);
        }
        
        res.status(200).json({
          success: true,
          postId: uploadResult.publishId,
          message: 'Post uploaded to TikTok drafts successfully',
          status: uploadResult.status,
          uploadedAt: uploadResult.uploadedAt
        });
      } else {
        res.status(500).json({
          success: false,
          error: uploadResult.error || 'Upload failed'
        });
      }
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
    
  } catch (error) {
    console.error('TikTok upload error:', error);
    res.status(500).json({ error: error.message });
  }
} 