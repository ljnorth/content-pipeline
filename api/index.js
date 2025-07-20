import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Import database client
let db;
try {
  const { SupabaseClient } = await import('../src/database/supabase-client.js');
  db = new SupabaseClient();
  console.log('✅ Database connected successfully');
} catch (error) {
  console.error('❌ Database connection failed:', error);
}

// Manual CORS middleware instead of using cors package
app.use((req, res, next) => {
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, '../src/web/public')));

// Basic test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Vercel serverless function is working!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    vercel: true,
    database: db ? 'connected' : 'disconnected'
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    vercel: true,
    database: db ? 'connected' : 'disconnected'
  });
});

// Temporary migration endpoint to add TikTok columns
app.post('/api/migrate/add-tiktok-columns', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    console.log('Running TikTok columns migration...');
    
    // First, check if columns already exist
    const { data: existingColumns } = await db.client
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'account_profiles')
      .like('column_name', 'tiktok_%');
    
    const existingTikTokColumns = existingColumns?.map(col => col.column_name) || [];
    
    if (existingTikTokColumns.length > 0) {
      return res.json({ 
        success: true, 
        message: 'TikTok columns already exist',
        existingColumns: existingTikTokColumns
      });
    }
    
    // Add columns one by one using ALTER TABLE statements
    const alterQueries = [
      'ALTER TABLE account_profiles ADD COLUMN IF NOT EXISTS tiktok_access_token TEXT',
      'ALTER TABLE account_profiles ADD COLUMN IF NOT EXISTS tiktok_refresh_token TEXT', 
      'ALTER TABLE account_profiles ADD COLUMN IF NOT EXISTS tiktok_expires_at TIMESTAMP WITH TIME ZONE',
      'ALTER TABLE account_profiles ADD COLUMN IF NOT EXISTS tiktok_connected_at TIMESTAMP WITH TIME ZONE'
    ];
    
    for (const query of alterQueries) {
      const { error } = await db.client.rpc('execute_sql', { query });
      if (error) {
        console.error('Error executing:', query, error);
        return res.status(500).json({ error: 'Migration failed', details: error, query });
      }
    }
    
    console.log('Migration completed successfully');
    res.json({ 
      success: true, 
      message: 'TikTok columns added successfully'
    });
    
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: 'Migration failed', details: error.message });
  }
});

// Debug endpoint to see all profiles (including inactive)
app.get('/api/debug/all-profiles', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    console.log('=== All Profiles Debug ===');
    const { data: profiles, error } = await db.client
      .from('account_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    console.log('All profiles query - Error:', error);
    console.log('All profiles query - Data length:', profiles?.length || 0);
    
    if (error) {
      throw error;
    }
    
    res.json({
      total: profiles?.length || 0,
      active: profiles?.filter(p => p.is_active)?.length || 0,
      inactive: profiles?.filter(p => !p.is_active)?.length || 0,
      profiles: profiles || []
    });
  } catch (err) {
    console.error('Error fetching all profiles:', err);
    res.status(500).json({ error: err.message });
  }
});

// Debug endpoint to test database connection
app.get('/api/debug', async (req, res) => {
  try {
    res.json({
      message: 'Debug endpoint',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      database: db ? 'connected' : 'disconnected',
      dbError: db ? null : 'Database connection failed during initialization'
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Debug endpoint error',
      message: error.message,
      stack: error.stack
    });
  }
});

// Account profiles endpoints
app.get('/api/account-profiles', async (req, res) => {
  try {
    console.log('=== Account Profiles GET Debug ===');
    console.log('Database connected:', !!db);
    
    if (!db) {
      console.log('Database not connected');
      return res.status(500).json({ error: 'Database not connected' });
    }

    console.log('Attempting to query account_profiles table...');
    const { data: profiles, error } = await db.client
      .from('account_profiles')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    console.log('Query result - Error:', error);
    console.log('Query result - Data length:', profiles?.length || 0);
    
    if (error) {
      console.log('Supabase error details:', JSON.stringify(error, null, 2));
      throw error;
    }
    
    res.json(profiles || []);
  } catch (err) {
    console.error('Error fetching account profiles:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/account-profiles', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const { username, displayName, platform, accountType, targetAudience, contentStrategy, performanceGoals, postingSchedule } = req.body;
    
    if (!username || !displayName) {
      return res.status(400).json({ error: 'Username and display name are required' });
    }
    
    const { data, error } = await db.client
      .from('account_profiles')
      .upsert({
        username,
        display_name: displayName,
        platform,
        account_type: accountType,
        target_audience: targetAudience,
        content_strategy: contentStrategy,
        performance_goals: performanceGoals,
        posting_schedule: postingSchedule,
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      // Handle duplicate key error
      if (error.code === '23505') {
        // Check if there's an inactive profile with this username
        const { data: existingProfile } = await db.client
          .from('account_profiles')
          .select('*')
          .eq('username', username)
          .eq('is_active', false)
          .single();
        
        if (existingProfile) {
          return res.status(409).json({ 
            error: 'Profile exists but is inactive',
            message: `A profile for "${username}" exists but is inactive. Would you like to reactivate it?`,
            canReactivate: true,
            username: username
          });
        }
        
        return res.status(409).json({ 
          error: 'Profile already exists',
          message: `An active profile for "${username}" already exists.`
        });
      }
      throw error;
    }
    
    res.json(data);
  } catch (err) {
    console.error('Error creating/updating account profile:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get specific account profile
app.get('/api/account-profiles/:username', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const { username } = req.params;
    
    const { data: profile, error } = await db.client
      .from('account_profiles')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Profile not found' });
      }
      throw error;
    }
    
    res.json(profile);
  } catch (err) {
    console.error('Error fetching account profile:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update account profile
app.put('/api/account-profiles/:username', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const { username: originalUsername } = req.params;
    const { username, displayName, platform, accountType, targetAudience, contentStrategy, performanceGoals, postingSchedule } = req.body;
    
    if (!username || !displayName) {
      return res.status(400).json({ error: 'Username and display name are required' });
    }
    
    const { data, error } = await db.client
      .from('account_profiles')
      .update({
        username,
        display_name: displayName,
        platform,
        account_type: accountType,
        target_audience: targetAudience,
        content_strategy: contentStrategy,
        performance_goals: performanceGoals,
        posting_schedule: postingSchedule,
        updated_at: new Date().toISOString()
      })
      .eq('username', originalUsername)
      .eq('is_active', true)
      .select()
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Profile not found' });
      }
      throw error;
    }
    
    res.json(data);
  } catch (err) {
    console.error('Error updating account profile:', err);
    res.status(500).json({ error: err.message });
  }
});

// Reactivate account profile
app.put('/api/account-profiles/:username/reactivate', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const { username } = req.params;
    
    console.log('Reactivating profile for:', username);
    
    const { data, error } = await db.client
      .from('account_profiles')
      .update({
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('username', username)
      .eq('is_active', false)
      .select()
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Inactive profile not found' });
      }
      throw error;
    }
    
    console.log('Profile reactivated successfully:', username);
    res.json({ message: 'Profile reactivated successfully', profile: data });
  } catch (err) {
    console.error('Error reactivating account profile:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete account profile - THE MISSING ENDPOINT!
app.delete('/api/account-profiles/:username', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const { username } = req.params;
    
    const { data, error } = await db.client
      .from('account_profiles')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('username', username)
      .eq('is_active', true)
      .select()
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Profile not found' });
      }
      throw error;
    }
    
    res.json({ message: 'Profile deleted successfully' });
  } catch (err) {
    console.error('Error deleting account profile:', err);
    res.status(500).json({ error: err.message });
  }
});

// TikTok connection endpoints
app.get('/api/accounts/:username/tiktok-status', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const { username } = req.params;
    
    console.log('Checking TikTok status for:', username);
    
    // First check if the profile exists
    const { data: profile, error } = await db.client
      .from('account_profiles')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Account profile not found' });
      }
      throw error;
    }
    
    // Check if TikTok columns exist and have values
    const hasTokenColumns = profile.hasOwnProperty('tiktok_access_token');
    const isConnected = hasTokenColumns && !!profile.tiktok_access_token;
    const expiresAt = hasTokenColumns && profile.tiktok_expires_at ? new Date(profile.tiktok_expires_at) : null;
    const isExpired = expiresAt ? new Date() > expiresAt : false;
    
    console.log('TikTok status check result:', {
      username,
      hasTokenColumns,
      isConnected,
      isExpired,
      expiresAt: expiresAt?.toISOString()
    });
    
    res.json({
      connected: isConnected,
      expired: isExpired,
      expiresAt: expiresAt ? expiresAt.toISOString() : null
    });
    
  } catch (error) {
    console.error('Error checking TikTok status:', error);
    res.status(500).json({ error: 'Failed to check TikTok status' });
  }
});

// Debug endpoint with multiple TikTok OAuth URL formats
app.get('/api/tiktok/debug-auth-urls/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const state = `${username}_${Date.now()}`;
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const redirectUri = `${process.env.BASE_URL || 'https://easypost.fun'}/auth/tiktok/callback`;
    const scopes = 'user.info.basic';
    
    if (!clientKey) {
      return res.status(500).json({ error: 'TikTok client key not configured' });
    }
    
    // Multiple URL formats that developers have reported working
    const urlFormats = {
      format1_main: `https://open.tiktokapis.com/v2/oauth/authorize?client_key=${clientKey}&scope=${encodeURIComponent(scopes)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`,
      
      format2_alternate: `https://www.tiktok.com/auth/authorize/?client_key=${clientKey}&scope=${encodeURIComponent(scopes)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`,
      
      format3_business: `https://business-api.tiktok.com/portal/auth?client_key=${clientKey}&scope=${encodeURIComponent(scopes)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`
    };
    
    res.json({
      currentUsing: 'format1_main',
      allFormats: urlFormats,
      note: 'Try these URLs manually if the main one fails. Different TikTok app types may require different URLs.'
    });
    
  } catch (error) {
    console.error('Error generating debug URLs:', error);
    res.status(500).json({ error: 'Failed to generate debug URLs' });
  }
});

app.get('/api/tiktok/auth-url/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    // Generate state for security
    const state = `${username}_${Date.now()}`;
    
    // TikTok OAuth URL (using sandbox for development)
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    if (!clientKey) {
      return res.status(500).json({ error: 'TikTok client key not configured' });
    }
    
    // Clean redirect URI without query parameters
    const redirectUri = `${process.env.BASE_URL || 'https://easypost.fun'}/auth/tiktok/callback`;
    
    // TikTok sandbox requires these specific scopes
    const scopes = 'user.info.basic,video.upload';
    
    // Use TikTok v2 OAuth URL
    const authUrl = `https://www.tiktok.com/v2/auth/authorize/?` +
      `client_key=${encodeURIComponent(clientKey)}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${encodeURIComponent(state)}`;
    
    console.log('Generated TikTok SANDBOX auth URL for:', username);
    console.log('Sandbox redirect URI:', redirectUri);
    console.log('State:', state);
    console.log('Scopes:', scopes);
    
    res.json({ authUrl });
    
  } catch (error) {
    console.error('Error generating TikTok auth URL:', error);
    res.status(500).json({ error: 'Failed to generate TikTok auth URL' });
  }
});

app.post('/api/accounts/:username/tiktok-disconnect', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const { username } = req.params;
    
    console.log('Disconnecting TikTok for:', username);
    
    const { error } = await db.client
      .from('account_profiles')
      .update({
        tiktok_access_token: null,
        tiktok_refresh_token: null,
        tiktok_expires_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('username', username)
      .eq('is_active', true);
    
    if (error) {
      throw error;
    }
    
    console.log('TikTok disconnected successfully for:', username);
    res.json({ success: true, message: 'TikTok account disconnected successfully' });
    
  } catch (error) {
    console.error('Error disconnecting TikTok:', error);
    res.status(500).json({ error: 'Failed to disconnect TikTok account' });
  }
});

// OAuth callback endpoint
app.get('/auth/tiktok/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      return res.redirect(`/?error=${encodeURIComponent(error)}&type=tiktok_auth`);
    }
    
    if (!code || !state) {
      return res.redirect('/?error=Missing authorization code or state&type=tiktok_auth');
    }
    
    // Extract username from state
    const username = state.split('_')[0];
    
    // Exchange code for access token (v2 endpoint)
    const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.BASE_URL || 'https://easypost.fun'}/auth/tiktok/callback`
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    console.log('TikTok token response status:', tokenResponse.status);
    console.log('TikTok token response:', tokenData);
    
    if (!tokenResponse.ok || tokenData.error) {
      console.error('TikTok token exchange error:', tokenData);
      return res.redirect(`/?error=${encodeURIComponent(tokenData.error_description || tokenData.error || 'Token exchange failed')}&type=tiktok_auth`);
    }
    
    // Save tokens to database
    console.log('Attempting to save TikTok tokens for username:', username);
    console.log('Database connection available:', !!db);
    
    if (!db) {
      console.error('Database not connected');
      return res.redirect(`/?error=Database not available&type=tiktok_auth`);
    }
    
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
    console.log('Token data to save:', {
      username,
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresAt: expiresAt.toISOString()
    });
    
    // First check if user exists
    const { data: existingUser, error: checkError } = await db.client
      .from('account_profiles')
      .select('username')
      .eq('username', username)
      .eq('is_active', true)
      .single();
    
    if (checkError) {
      console.error('Error checking if user exists:', checkError);
      return res.redirect(`/?error=User not found in database&type=tiktok_auth`);
    }
    
    if (!existingUser) {
      console.error('User not found:', username);
      return res.redirect(`/?error=User ${username} not found in database&type=tiktok_auth`);
    }
    
    // Now update the user's TikTok tokens
    const { error: dbError } = await db.client
      .from('account_profiles')
      .update({
        tiktok_access_token: tokenData.access_token,
        tiktok_refresh_token: tokenData.refresh_token,
        tiktok_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('username', username)
      .eq('is_active', true);
    
    if (dbError) {
      console.error('Error saving TikTok tokens:', dbError);
      return res.redirect(`/?error=Failed to save TikTok connection: ${dbError.message}&type=tiktok_auth`);
    }
    
    console.log('TikTok connected successfully for:', username);
    res.redirect(`/?success=${encodeURIComponent(`@${username} successfully connected to TikTok`)}&type=tiktok_auth`);
    
  } catch (error) {
    console.error('TikTok OAuth callback error:', error);
    res.redirect(`/?error=${encodeURIComponent('OAuth callback failed')}&type=tiktok_auth`);
  }
});

// Content generation endpoint
app.post('/api/generate', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const { imageCount, performanceMetric, diversityLevel, maxPerPost, filters = {} } = req.body;
    
    console.log('Generating content with params:', { imageCount, performanceMetric, diversityLevel, maxPerPost, filters });
    
    // First, get all images with filters
    let imageQuery = db.client
      .from('images')
      .select('*');
    
    // Apply filters
    if (filters.aesthetics && filters.aesthetics.length > 0) {
      // Use flexible matching for aesthetics - if any of the filter aesthetics are found in the image aesthetic
      const aestheticConditions = filters.aesthetics.map(aesthetic => `aesthetic.ilike.%${aesthetic}%`).join(',');
      imageQuery = imageQuery.or(aestheticConditions);
    }
    if (filters.colors && filters.colors.length > 0) {
      // For colors (array field), use .or() with contains
      const colorOr = filters.colors.map(color => `colors.cs.{${color}}`).join(',');
      imageQuery = imageQuery.or(colorOr);
    }
    if (filters.occasions && filters.occasions.length > 0) {
      imageQuery = imageQuery.in('occasion', filters.occasions);
    }
    if (filters.seasons && filters.seasons.length > 0) {
      imageQuery = imageQuery.in('season', filters.seasons);
    }
    if (filters.additional && filters.additional.length > 0) {
      // For additional (array field), use .or() with overlaps
      const addOr = filters.additional.map(trait => `additional.ov.{${trait}}`).join(',');
      imageQuery = imageQuery.or(addOr);
    }
    if (filters.usernames && filters.usernames.length > 0) {
      imageQuery = imageQuery.in('username', filters.usernames);
    }
    
    // Get images first - REMOVED LIMIT to access all images
    const { data: images, error: imageError } = await imageQuery;
    
    if (imageError) {
      console.error('Error fetching images:', imageError);
      return res.status(500).json({ error: 'Failed to fetch images' });
    }
    
    console.log('Found', images?.length || 0, 'images matching filters');
    
    if (!images || images.length === 0) {
      return res.json({ images: [] });
    }
    
    // Get posts for these images
    const postIds = [...new Set(images.map(img => img.post_id))];
    const { data: posts, error: postError } = await db.client
      .from('posts')
      .select('*')
      .in('post_id', postIds);
    
    if (postError) {
      console.error('Error fetching posts:', postError);
      return res.status(500).json({ error: 'Failed to fetch posts' });
    }
    
    // Create a map of post_id to post data
    const postMap = {};
    posts?.forEach(post => {
      postMap[post.post_id] = post;
    });
    
    // Combine images with post data
    const imagesWithPosts = images.map(image => ({
      ...image,
      posts: postMap[image.post_id] || null
    })).filter(image => image.posts); // Only include images with valid posts
    
    console.log('Images with posts:', imagesWithPosts.length);
    
    // Sort by performance metric
    let sortField = 'posts.engagement_rate';
    if (performanceMetric === 'like_count') sortField = 'posts.like_count';
    else if (performanceMetric === 'view_count') sortField = 'posts.view_count';
    else if (performanceMetric === 'comment_count') sortField = 'posts.comment_count';
    else if (performanceMetric === 'save_count') sortField = 'posts.save_count';
    
    imagesWithPosts.sort((a, b) => {
      const aValue = a.posts[performanceMetric] || 0;
      const bValue = b.posts[performanceMetric] || 0;
      return bValue - aValue; // Descending order
    });
    
    // Apply diversity and max per post constraints
    const selectedImages = [];
    const postCounts = {};
    const aestheticCounts = {};
    const seasonCounts = {};
    
    for (const image of imagesWithPosts) {
      const postId = image.post_id;
      const aesthetic = image.aesthetic;
      const season = image.season;
      
      // Check max per post constraint
      if (postCounts[postId] >= maxPerPost) continue;
      
      // Check diversity constraints
      if (diversityLevel === 'high') {
        if (aestheticCounts[aesthetic] >= 2) continue;
        if (seasonCounts[season] >= 2) continue;
      } else if (diversityLevel === 'medium') {
        if (aestheticCounts[aesthetic] >= 3) continue;
        if (seasonCounts[season] >= 3) continue;
      }
      
      selectedImages.push(image);
      postCounts[postId] = (postCounts[postId] || 0) + 1;
      aestheticCounts[aesthetic] = (aestheticCounts[aesthetic] || 0) + 1;
      seasonCounts[season] = (seasonCounts[season] || 0) + 1;
      
      if (selectedImages.length >= imageCount) break;
    }
    
    console.log('Selected', selectedImages.length, 'images for generation');
    res.json({ images: selectedImages });
    
  } catch (err) {
    console.error('Error in /api/generate:', err);
    res.status(500).json({ error: err.message });
  }
});

// Save generation endpoint
app.post('/api/save-generation', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const generation = req.body;
    
    // Save to database (you'll need to create a generations table)
    const { error } = await db.client
      .from('generations')
      .insert(generation);
    
    if (error) {
      // If table doesn't exist, just return success for now
      console.log('Generations table not found, skipping save');
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving generation:', err);
    res.status(500).json({ error: err.message });
  }
});

// Filter options endpoint
app.get('/api/filter-options', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    // Get all available aesthetics
    const { data: aesthetics } = await db.client
      .from('images')
      .select('aesthetic')
      .not('aesthetic', 'is', null)
      .order('aesthetic');
    
    // Get all available seasons
    const { data: seasons } = await db.client
      .from('images')
      .select('season')
      .not('season', 'is', null)
      .order('season');
    
    // Get all available occasions
    const { data: occasions } = await db.client
      .from('images')
      .select('occasion')
      .not('occasion', 'is', null)
      .order('occasion');
    
    // Get all available colors (from JSONB array)
    const { data: colorData } = await db.client
      .from('images')
      .select('colors')
      .not('colors', 'is', null);
    
    // Extract unique colors from JSONB arrays
    const colorSet = new Set();
    colorData?.forEach(item => {
      if (Array.isArray(item.colors)) {
        item.colors.forEach(color => colorSet.add(color));
      }
    });
    
    // Get all available additional traits
    const { data: additionalData } = await db.client
      .from('images')
      .select('additional')
      .not('additional', 'is', null);
    
    // Extract unique additional traits from JSONB arrays
    const additionalSet = new Set();
    additionalData?.forEach(item => {
      if (Array.isArray(item.additional)) {
        item.additional.forEach(trait => additionalSet.add(trait));
      }
    });
    
    // Get all usernames
    const { data: usernames } = await db.client
      .from('posts')
      .select('username')
      .order('username');
    
    res.json({
      aesthetics: [...new Set(aesthetics?.map(a => a.aesthetic) || [])],
      seasons: [...new Set(seasons?.map(s => s.season) || [])],
      occasions: [...new Set(occasions?.map(o => o.occasion) || [])],
      colors: [...colorSet].sort(),
      additional: [...additionalSet].sort(),
      usernames: [...new Set(usernames?.map(u => u.username) || [])]
    });
  } catch (err) {
    console.error('Error fetching filter options:', err);
    res.status(500).json({ error: err.message });
  }
});

// Workflow content generation endpoint
app.post('/api/generate-workflow-content', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const { accountUsername, postCount, imageCount } = req.body;
    
    console.log(`🎨 Generating workflow content for @${accountUsername}: ${postCount} posts, ${imageCount} images each`);
    
    // Get account profile
    const { data: profile, error: profileError } = await db.client
      .from('account_profiles')
      .select('*')
      .eq('username', accountUsername)
      .eq('is_active', true)
      .single();
    
    if (profileError || !profile) {
      return res.status(404).json({ error: 'Account profile not found' });
    }
    
    // Generate content using ContentGenerator (REAL images from database)
    const { ContentGenerator } = await import('../src/automation/content-generator.js');
    const contentGenerator = new ContentGenerator();
    
    const posts = [];
    const allImages = [];
    
    for (let i = 1; i <= postCount; i++) {
      try {
        const post = await contentGenerator.generateSinglePost(profile, profile, i);
        posts.push(post);
        allImages.push(...post.images);
      } catch (error) {
        console.error(`Failed to generate post ${i}: ${error.message}`);
        // Continue with other posts
      }
    }
    
    if (posts.length === 0) {
      return res.status(500).json({ error: 'Failed to generate any posts' });
    }
    
    // Create generation object
    const generation = {
      id: `workflow_${Date.now()}`,
      accountUsername,
      postCount: posts.length,
      imageCount,
      posts: posts,
      allImages: allImages,
      generatedAt: new Date().toISOString(),
      strategy: {
        targetAudience: profile.target_audience,
        contentStrategy: profile.content_strategy,
        performanceGoals: profile.performance_goals
      }
    };
    
    console.log(`✅ Generated ${posts.length} posts with ${allImages.length} total images`);
    
    res.json({
      success: true,
      generation,
      posts
    });
    
  } catch (error) {
    console.error('Workflow content generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save workflow generation endpoint
app.post('/api/save-workflow-generation', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const { generation } = req.body;
    
    console.log(`💾 Saving workflow generation: ${generation.id}`);
    
    // Save generation metadata to database
    const { data: savedGeneration, error: generationError } = await db.client
      .from('saved_generations')
      .insert({
        generation_id: generation.id,
        account_username: generation.accountUsername,
        post_count: generation.postCount,
        image_count: generation.imageCount,
        strategy: generation.strategy,
        generated_at: generation.generatedAt,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (generationError) {
      console.error('Failed to save generation metadata:', generationError);
      return res.status(500).json({ error: 'Failed to save generation metadata' });
    }
    
    // Save individual posts to generated_posts table
    let savedPostsCount = 0;
    for (const post of generation.posts) {
      try {
        const { error: postError } = await db.client
          .from('generated_posts')
          .insert({
            generation_id: generation.id,
            account_username: generation.accountUsername,
            post_number: post.postNumber,
            caption: post.caption,
            hashtags: post.hashtags,
            images: post.images,
            status: 'generated',
            platform: 'pending',
            created_at: new Date().toISOString()
          });
        
        if (postError) {
          console.error(`Failed to save post ${post.postNumber}:`, postError);
        } else {
          savedPostsCount++;
        }
      } catch (error) {
        console.error(`Error saving post ${post.postNumber}:`, error.message);
      }
    }
    
    console.log(`✅ Saved generation ${generation.id} with ${savedPostsCount}/${generation.posts.length} posts`);
    
    res.json({
      success: true,
      savedId: generation.id,
      savedPosts: savedPostsCount,
      totalPosts: generation.posts.length
    });
    
  } catch (error) {
    console.error('Save workflow generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload workflow to TikTok endpoint
app.post('/api/upload-workflow-to-tiktok', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const { accountUsername, posts } = req.body;
    
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
    
    // Import and use the real TikTok API
    const { TikTokAPI } = await import('../src/automation/tiktok-api.js');
    const tiktokAPI = new TikTokAPI();
    
    const uploads = [];
    let successfulUploads = 0;
    
    for (const post of posts) {
      try {
        console.log(`📤 Uploading post ${post.postNumber} for @${accountUsername}...`);
        
        const uploadResult = await tiktokAPI.realUploadPost(accountUsername, post);
        
        if (uploadResult.success) {
          // Save to database with real data
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
          
          successfulUploads++;
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
    
    console.log(`✅ Uploaded ${successfulUploads}/${posts.length} posts to TikTok for @${accountUsername}`);
    
    // Determine overall success based on actual upload results
    const overallSuccess = successfulUploads > 0;
    const allSuccessful = successfulUploads === posts.length;
    
    if (allSuccessful) {
      console.log(`🎉 All ${posts.length} posts uploaded successfully!`);
    } else if (successfulUploads > 0) {
      console.log(`⚠️ Partial success: ${successfulUploads}/${posts.length} posts uploaded`);
    } else {
      console.log(`❌ No posts uploaded successfully`);
    }
    
    res.json({
      success: overallSuccess,
      allSuccessful,
      uploads,
      totalPosts: posts.length,
      successfulUploads,
      message: allSuccessful 
        ? `All ${posts.length} posts uploaded to TikTok drafts successfully!`
        : successfulUploads > 0 
          ? `${successfulUploads}/${posts.length} posts uploaded to TikTok drafts`
          : `Failed to upload any posts to TikTok drafts`
    });
    
  } catch (error) {
    console.error('Upload workflow to TikTok error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generated posts endpoint
app.get('/api/generated-posts', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const { data: posts, error } = await db.client
      .from('generated_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching generated posts:', error);
      return res.status(500).json({ error: 'Failed to fetch generated posts' });
    }

    res.json(posts || []);
    
  } catch (error) {
    console.error('Generated posts endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Account profiles endpoint
app.get('/api/account-profiles', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const { data: profiles, error } = await db.client
      .from('account_profiles')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching account profiles:', error);
      return res.status(500).json({ error: 'Failed to fetch account profiles' });
    }

    res.json(profiles || []);
    
  } catch (error) {
    console.error('Account profiles endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Catch-all handler for SPA
app.get('*', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, '../src/web/public/index.html'));
  } catch (error) {
    console.error('Error serving HTML:', error);
    res.status(500).json({ error: 'Failed to serve page' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
});

export default app; 