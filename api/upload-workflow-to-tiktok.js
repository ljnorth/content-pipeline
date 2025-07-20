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
      const { accountUsername, posts } = req.body;
      
      if (!accountUsername || !posts || !Array.isArray(posts)) {
        return res.status(400).json({ error: 'accountUsername and posts array are required' });
      }
      
      console.log(`📤 Uploading ${posts.length} posts to TikTok for @${accountUsername}`);
      
      // Check if account is connected to TikTok
      const { data: profile, error: profileError } = await db.client
        .from('account_profiles')
        .select('tiktok_access_token')
        .eq('username', accountUsername)
        .eq('is_active', true)
        .single();
      
      if (profileError || !profile || !profile.tiktok_access_token) {
        return res.status(400).json({ 
          error: 'Account not connected to TikTok. Please connect first.' 
        });
      }
      
      const uploads = [];
      
      for (const post of posts) {
        try {
          console.log(`📤 Uploading post ${post.postNumber} for @${accountUsername}...`);
          
          const uploadResult = await tiktokAPI.realUploadPost(accountUsername, post);
          
          if (uploadResult.success) {
            // Save to database
            const { error: dbError } = await db.client
              .from('generated_posts')
              .insert({
                account_username: accountUsername,
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
            
            uploads.push({
              postNumber: post.postNumber,
              success: true,
              publishId: uploadResult.publishId,
              status: uploadResult.status,
              uploadedAt: uploadResult.uploadedAt
            });
            
            console.log(`✅ Uploaded post ${post.postNumber} to TikTok`);
          } else {
            console.error(`❌ Failed to upload post ${post.postNumber}: ${uploadResult.error}`);
            uploads.push({
              postNumber: post.postNumber,
              success: false,
              error: uploadResult.error
            });
          }
        } catch (error) {
          console.error(`❌ Error uploading post ${post.postNumber}: ${error.message}`);
          uploads.push({
            postNumber: post.postNumber,
            success: false,
            error: error.message
          });
        }
      }
      
      const successfulUploads = uploads.filter(upload => upload.success).length;
      
      console.log(`✅ Uploaded ${successfulUploads}/${posts.length} posts to TikTok`);
      
      res.status(200).json({
        success: true,
        uploads,
        totalPosts: posts.length,
        successfulUploads
      });
      
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
    
  } catch (error) {
    console.error('Upload workflow to TikTok error:', error);
    res.status(500).json({ error: error.message });
  }
} 