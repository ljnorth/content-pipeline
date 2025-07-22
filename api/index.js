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

// Temporary migration endpoint to create saved_generations table
app.post('/api/migrate/create-saved-generations', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    console.log('Creating saved_generations table...');
    
    // Create the table with the schema the API expects
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS saved_generations (
          id SERIAL PRIMARY KEY,
          generation_id VARCHAR(255) UNIQUE NOT NULL,
          account_username VARCHAR(255) NOT NULL,
          post_count INTEGER DEFAULT 0,
          image_count INTEGER DEFAULT 0,
          strategy JSONB DEFAULT '{}',
          generated_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          FOREIGN KEY (account_username) REFERENCES account_profiles(username) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_saved_generations_account ON saved_generations(account_username);
      CREATE INDEX IF NOT EXISTS idx_saved_generations_generation_id ON saved_generations(generation_id);
    `;
    
    // Execute the SQL
    const { error } = await db.client.rpc('execute_sql', { query: createTableSQL });
    
    if (error) {
      console.error('Error creating table:', error);
      return res.status(500).json({ error: 'Failed to create table', details: error });
    }
    
    console.log('✅ saved_generations table created successfully');
    res.json({ 
      success: true, 
      message: 'saved_generations table created successfully'
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

// Analytics endpoints
app.get('/api/metrics', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    // Use count queries for accurate totals
    const { count: totalPosts } = await db.client.from('posts').select('*', { count: 'exact', head: true });
    const { count: totalImages } = await db.client.from('images').select('*', { count: 'exact', head: true });
    const { data: accounts } = await db.client.from('account_profiles').select('*');
    
    const activeAccounts = accounts?.length || 0;
    
    // Get posts for engagement calculation (limit to avoid memory issues)
    const { data: posts } = await db.client.from('posts').select('engagement_rate').limit(5000);
    
    // Calculate average engagement rate
    const avgEngagement = posts?.length > 0 
      ? posts.reduce((sum, post) => sum + (post.engagement_rate || 0), 0) / posts.length 
      : 0;
    
    res.json({
      totalPosts: totalPosts || 0,
      totalImages: totalImages || 0,
      activeAccounts,
      avgEngagement: Math.round(avgEngagement * 1000) / 10 // Convert to percentage and round
    });
  } catch (err) {
    console.error('Error loading metrics:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/trending', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    // Return empty data structure for now - can be enhanced later
    res.json({ 
      aesthetics: [], 
      seasons: [], 
      colors: [] 
    });
  } catch (err) {
    console.error('Error loading trending data:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/engagement-trends', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    // Return empty data for now - can be enhanced later
    res.json({ 
      labels: [], 
      values: [] 
    });
  } catch (err) {
    console.error('Error loading engagement trends:', err);
    res.status(500).json({ error: err.message });
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

// Simplified content generation endpoint that works with current schema
app.post('/api/generate-simple-content', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const { accountUsername, postCount = 1, imageCount = 5 } = req.body;
    
    console.log(`🎨 Generating SEO-focused content for @${accountUsername}: ${postCount} posts, ${imageCount} images each`);
    
    // Get account profile for targeting
    let profile = null;
    try {
      const { data: profileData } = await db.client
        .from('account_profiles')
        .select('*')
        .eq('username', accountUsername)
        .eq('is_active', true)
        .single();
      profile = profileData;
      console.log(`✅ Found account profile for targeting`);
    } catch (error) {
      console.log(`⚠️ No account profile found, using default targeting`);
    }

    // Get recently used images for deduplication
    let recentlyUsedImageIds = [];
    try {
      const { data: recentPosts } = await db.client
        .from('generated_posts')
        .select('image_paths')
        .eq('account_username', accountUsername)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (recentPosts) {
        recentlyUsedImageIds = recentPosts
          .flatMap(post => post.image_paths || [])
          .map(path => path.split('/').pop()?.split('.')[0])
          .filter(Boolean);
      }
    } catch (err) {
      console.log('Could not fetch recent posts, continuing without deduplication');
    }
    
    // Get available images from database
    const { data: availableImages, error: imagesError } = await db.client
      .from('images')
      .select('id, image_path, aesthetic, colors, season, occasion, username, post_id, additional')
      .not('image_path', 'is', null);
    
    if (imagesError) {
      console.error('❌ Error fetching images:', imagesError);
      return res.status(500).json({ error: 'Failed to fetch images from database' });
    }
    
    if (!availableImages || availableImages.length === 0) {
      return res.status(404).json({ error: 'No images found in database' });
    }
    
    console.log(`📊 Found ${availableImages.length} available images`);
    
    // Filter out recently used images
    const filteredImages = availableImages.filter(img => 
      !recentlyUsedImageIds.includes(img.id.toString())
    );
    
    console.log(`🎯 After deduplication: ${filteredImages.length} images available`);
    
    if (filteredImages.length < postCount * imageCount) {
      return res.status(400).json({ 
        error: `Not enough unique images available. Need ${postCount * imageCount}, have ${filteredImages.length}` 
      });
    }

    // Generate SEO-focused content themes based on current time and target audience
    const themes = generateSEOThemes(profile);
    console.log(`🎯 Generated ${themes.length} SEO themes:`, themes.map(t => t.name));

    const posts = [];
    const generationId = `seo_${Date.now()}_${accountUsername}`;
    
    // Generate each post with SEO-focused theming
    for (let postIndex = 0; postIndex < postCount; postIndex++) {
      console.log(`🎨 Generating SEO post ${postIndex + 1}/${postCount}...`);
      
      // Select random images for this post
      const timestamp = Date.now() + postIndex;
      console.log(`🎲 Post ${postIndex + 1} timestamp: ${timestamp}`);
      const shuffled = [...filteredImages].sort(() => {
        // Use timestamp to ensure different results each time
        const seed = Math.sin(timestamp + Math.random()) * 10000;
        return seed % 1 - 0.5;
      });
      const postImages = shuffled.slice(0, imageCount);
      console.log(`📸 Post ${postIndex + 1} selected images:`, postImages.map(img => img.id));
      
      // Remove these images from available pool
      filteredImages.splice(0, imageCount);
      
      // Get theme for this post
      const theme = themes[postIndex % themes.length];
      
      // Generate SEO-focused caption and hashtags
      const { caption, hashtags } = generateSEOContent(postImages, theme, profile, postIndex + 1);
      
      const post = {
        postNumber: postIndex + 1,
        caption,
        hashtags,
        images: postImages.map(img => ({
          id: img.id,
          imagePath: img.image_path,
          aesthetic: img.aesthetic,
          colors: img.colors || [],
          season: img.season,
          occasion: img.occasion
        })),
        theme: theme.name,
        primaryAesthetic: postImages[0]?.aesthetic || 'mixed',
        colorPalette: postImages.flatMap(img => img.colors || []).slice(0, 5),
        generatedAt: new Date().toISOString()
      };
      
      posts.push(post);
      console.log(`✅ Generated post ${postIndex + 1} with theme: ${theme.name}`);
    }

    // Save to database (optional - for tracking)
    try {
      for (const post of posts) {
        await db.client
          .from('generated_posts')
          .insert({
            account_username: accountUsername,
            generation_id: generationId,
            post_number: post.postNumber,
            image_paths: post.images.map(img => img.imagePath),
            caption: post.caption,
            hashtags: post.hashtags,
            status: 'generated',
            platform: 'pending',
            created_at: post.generatedAt
          });
      }
      console.log(`💾 Saved ${posts.length} posts to database`);
    } catch (dbError) {
      console.warn('⚠️ Could not save to database:', dbError.message);
    }

    const generation = {
      id: generationId,
      accountUsername,
      postCount,
      imageCount,
      posts,
      generatedAt: new Date().toISOString()
    };

    console.log(`🎉 Successfully generated ${posts.length} SEO-focused posts`);
    
    res.json({
      success: true,
      generation,
      posts
    });

  } catch (error) {
    console.error('❌ Content generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate SEO-focused themes based on current time and target audience
function generateSEOThemes(profile) {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();
  const dayOfWeek = now.getDay(); // 0-6 (Sunday = 0)
  
  // Default targeting if no profile
  const targetAge = profile?.target_audience?.age_range || '16-25';
  const targetStyle = profile?.target_audience?.style_preferences?.[0] || 'streetwear';
  const targetGender = profile?.target_audience?.gender || 'female';
  
  const themes = [];
  
  // Seasonal themes (high priority)
  if (month >= 8 && month <= 9) {
    themes.push({
      name: 'Back to School',
      keywords: ['back to school', 'school outfit', 'campus style', 'student fashion'],
      hashtags: ['#backtoschool', '#schooloutfit', '#campusstyle', '#studentfashion', '#collegefashion'],
      description: 'Back to school outfit inspiration for fashion-forward students'
    });
  }
  
  if (month >= 6 && month <= 8) {
    themes.push({
      name: 'Summer Vacation',
      keywords: ['summer vacation', 'beach day', 'vacation outfit', 'summer style'],
      hashtags: ['#summervacation', '#beachday', '#vacationoutfit', '#summerstyle', '#summerfashion'],
      description: 'Perfect vacation and beach day outfits for summer adventures'
    });
  }
  
  if (month >= 12 || month <= 2) {
    themes.push({
      name: 'Holiday Season',
      keywords: ['holiday outfit', 'party dress', 'festive style', 'winter fashion'],
      hashtags: ['#holidayoutfit', '#partydress', '#festivestyle', '#winterfashion', '#holidayfashion'],
      description: 'Festive holiday and party outfits for the winter season'
    });
  }
  
  if (month >= 3 && month <= 5) {
    themes.push({
      name: 'Spring Refresh',
      keywords: ['spring outfit', 'spring fashion', 'seasonal transition', 'spring style'],
      hashtags: ['#springoutfit', '#springfashion', '#seasonaltransition', '#springstyle', '#springvibes'],
      description: 'Fresh spring outfits and seasonal transition styles'
    });
  }
  
  // Weekly themes
  if (dayOfWeek === 5 || dayOfWeek === 6) { // Friday/Saturday
    themes.push({
      name: 'Weekend Vibes',
      keywords: ['weekend outfit', 'night out', 'weekend style', 'going out'],
      hashtags: ['#weekendoutfit', '#nightout', '#weekendstyle', '#goingout', '#weekendvibes'],
      description: 'Perfect weekend and night out outfits for fun times'
    });
  }
  
  if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Weekdays
    themes.push({
      name: 'Weekday Style',
      keywords: ['weekday outfit', 'daily style', 'casual chic', 'everyday fashion'],
      hashtags: ['#weekdayoutfit', '#dailystyle', '#casualchic', '#everydayfashion', '#dailyoutfit'],
      description: 'Stylish everyday outfits for busy weekdays'
    });
  }
  
  // Style-specific themes
  if (targetStyle.includes('streetwear')) {
    themes.push({
      name: 'Streetwear Essentials',
      keywords: ['streetwear', 'urban style', 'street fashion', 'casual streetwear'],
      hashtags: ['#streetwear', '#urbanstyle', '#streetfashion', '#casualstreetwear', '#streetstyle'],
      description: 'Essential streetwear pieces and urban style inspiration'
    });
  }
  
  if (targetStyle.includes('casual')) {
    themes.push({
      name: 'Casual Comfort',
      keywords: ['casual outfit', 'comfortable style', 'easy fashion', 'casual chic'],
      hashtags: ['#casualoutfit', '#comfortablestyle', '#easyfashion', '#casualchic', '#comfortablefashion'],
      description: 'Comfortable and stylish casual outfits for everyday wear'
    });
  }
  
  // Age-specific themes
  if (targetAge.includes('16-20') || targetAge.includes('teen')) {
    themes.push({
      name: 'Teen Fashion',
      keywords: ['teen fashion', 'young style', 'teen outfit', 'youth fashion'],
      hashtags: ['#teenfashion', '#youngstyle', '#teenoutfit', '#youthfashion', '#teenstyle'],
      description: 'Trendy fashion for teens and young adults'
    });
  }
  
  // Fallback themes
  if (themes.length === 0) {
    themes.push({
      name: 'Fashion Inspiration',
      keywords: ['fashion inspiration', 'style inspo', 'outfit ideas', 'fashion tips'],
      hashtags: ['#fashioninspiration', '#styleinspo', '#outfitideas', '#fashiontips', '#fashioninspo'],
      description: 'Fashion inspiration and style tips for every occasion'
    });
  }
  
  return themes;
}

// Generate SEO-focused caption and hashtags
function generateSEOContent(images, theme, profile, postNumber) {
  const targetAge = profile?.target_audience?.age_range || '16-25';
  const targetStyle = profile?.target_audience?.style_preferences?.[0] || 'streetwear';
  const targetGender = profile?.target_audience?.gender || 'female';
  
  // Natural caption templates that sound like real people
  const naturalCaptions = generateNaturalCaption(theme, targetAge, targetStyle, targetGender, images);
  
  // Create hashtag strategy
  const hashtags = [
    // Theme hashtags
    ...theme.hashtags,
    // Style hashtags
    `#${targetStyle}`,
    `#${targetStyle}style`,
    // Age/gender hashtags
    `#${targetAge.includes('16-20') ? 'teen' : 'fashion'}fashion`,
    `#${targetGender}fashion`,
    // General fashion hashtags
    '#fashioninspo',
    '#outfitinspiration',
    '#styleinspo',
    '#fashiontrends',
    '#ootd',
    '#fashionblogger'
  ];
  
  // Remove duplicates and limit to 15 hashtags
  const uniqueHashtags = [...new Set(hashtags)].slice(0, 15);
  
  return { caption: naturalCaptions, hashtags: uniqueHashtags };
}

// Generate natural, authentic captions that sound like real people
function generateNaturalCaption(theme, targetAge, targetStyle, targetGender, images) {
  const isTeen = targetAge.includes('16-20');
  const isStreetwear = targetStyle.includes('streetwear');
  const isFemale = targetGender === 'female';
  
  // Get some image context for more natural captions
  const aesthetics = [...new Set(images.map(img => img.aesthetic).filter(Boolean))];
  const colors = [...new Set(images.flatMap(img => img.colors || []).filter(Boolean))];
  
  // Theme-specific natural captions
  const themeCaptions = {
    'Back to School': [
      `back to school szn is here and i'm obsessed with these fits 😍 perfect for campus vibes`,
      `school outfit inspo that's actually cute and comfy ✨ no more boring first day fits`,
      `back to school but make it fashion 💅 these looks are giving everything`,
      `campus style that's actually wearable and cute af 🎒`,
      `school year starting but the fits are already ending everyone else 😮‍💨`
    ],
    'Summer Vacation': [
      `summer vacation fits that are actually cute and not basic 🌊`,
      `vacation wardrobe essentials that'll make you look good in every pic 📸`,
      `beach day but make it fashion 💅 these looks are giving everything`,
      `summer vibes with these vacation-ready fits ✨`,
      `vacation outfit inspo that's actually wearable and cute af 🏖️`
    ],
    'Holiday Season': [
      `holiday party season and these fits are giving everything ✨`,
      `festive season but make it fashion 💅 perfect for all the holiday events`,
      `holiday outfit inspo that's actually cute and not basic 🎄`,
      `party season with these holiday-ready fits 🎉`,
      `holiday vibes with these festive outfit ideas ✨`
    ],
    'Spring Refresh': [
      `spring cleaning but make it wardrobe edition ✨ these fits are giving fresh start`,
      `spring outfit inspo that's actually cute and not basic 🌸`,
      `spring vibes with these fresh fits 💐`,
      `spring cleaning but the fits are staying cute af 🌺`,
      `spring season with these fresh outfit ideas ✨`
    ],
    'Weekend Vibes': [
      `weekend plans but make it fashion 💅 these fits are giving everything`,
      `weekend outfit inspo that's actually cute and comfy ✨`,
      `weekend vibes with these cute fits 🎉`,
      `weekend plans but the fits are the main character 😮‍💨`,
      `weekend style that's actually wearable and cute af ✨`
    ],
    'Weekday Style': [
      `daily fits that are actually cute and not boring ✨`,
      `everyday style inspo that's actually wearable 💅`,
      `daily vibes with these cute fits 🌟`,
      `weekday wardrobe that's giving everything 😍`,
      `daily outfit inspo that's actually cute and comfy ✨`
    ],
    'Streetwear Essentials': [
      `streetwear essentials that are actually cute and not basic 🔥`,
      `urban style inspo that's giving everything 💅`,
      `streetwear vibes with these cute fits ✨`,
      `urban essentials that are actually wearable and cute af 🔥`,
      `streetwear but make it fashion 💅`
    ],
    'Casual Comfort': [
      `casual fits that are actually cute and not boring ✨`,
      `comfortable style inspo that's giving everything 💅`,
      `casual vibes with these cute fits 🌟`,
      `comfortable wardrobe that's actually fashionable 😍`,
      `casual outfit inspo that's actually cute and comfy ✨`
    ],
    'Teen Fashion': [
      `teen fashion that's actually cute and not cringe ✨`,
      `young style inspo that's giving everything 💅`,
      `teen vibes with these cute fits 🌟`,
      `youth fashion that's actually wearable and cute af 😍`,
      `teen outfit inspo that's actually cute and trendy ✨`
    ]
  };
  
  // Get theme-specific captions or fallback
  const availableCaptions = themeCaptions[theme.name] || themeCaptions['Weekday Style'];
  
  // Add some variety based on image context
  let caption = availableCaptions[Math.floor(Math.random() * availableCaptions.length)];
  
  // Sometimes add a question for engagement
  const engagementQuestions = [
    ' which look is your fave? 👀',
    ' thoughts? 👀',
    ' which one would you wear? 💭',
    ' yay or nay? 👀',
    ' which fit is giving? 💅'
  ];
  
  // 70% chance to add engagement question
  if (Math.random() < 0.7) {
    caption += engagementQuestions[Math.floor(Math.random() * engagementQuestions.length)];
  }
  
  return caption;
}

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
      console.error('❌ Account profile error:', profileError);
      return res.status(404).json({ error: 'Account profile not found' });
    }
    
    console.log(`✅ Found account profile for @${accountUsername}`);
    console.log(`📊 Profile strategy:`, JSON.stringify(profile.content_strategy, null, 2));
    
    // Generate content using ContentGenerator (REAL images from database)
    const { ContentGenerator } = await import('../src/automation/content-generator.js');
    const contentGenerator = new ContentGenerator();
    
    const posts = [];
    const allImages = [];
    
    console.log(`🔄 Starting content generation for ${postCount} posts...`);
    
    for (let i = 1; i <= postCount; i++) {
      try {
        console.log(`📝 Generating post ${i}/${postCount}...`);
        const post = await contentGenerator.generateSinglePost(profile, profile, i);
        console.log(`✅ Post ${i} generated successfully with ${post.images.length} images`);
        posts.push(post);
        allImages.push(...post.images);
      } catch (error) {
        console.error(`❌ Failed to generate post ${i}:`, error.message);
        console.error('❌ Stack trace:', error.stack);
        // Continue with other posts - but log the detailed error
      }
    }
    
    console.log(`📊 Final results: ${posts.length}/${postCount} posts generated successfully`);
    
    if (posts.length === 0) {
      console.error('❌ No posts were generated successfully');
      return res.status(500).json({ 
        error: 'Failed to generate any posts', 
        details: 'Check server logs for detailed error information' 
      });
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
    console.error('❌ Workflow content generation error:', error.message);
    console.error('❌ Stack trace:', error.stack);
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
    
    // Note: saved_generations table is optional for metadata tracking
    
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
      // Don't fail the whole request - just skip saving metadata
      console.log('Continuing without saving generation metadata...');
    }
    
    // Save individual posts to generated_posts table (this should work)
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
      totalPosts: generation.posts.length,
      metadataSaved: !generationError
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

// AI-powered content generation endpoint with intelligent image grouping (FIXED)
app.post('/api/generate-ai-content', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const { accountUsername, postCount = 1, imageCount = 5 } = req.body;
    
    console.log(`🤖 Generating AI-powered content for @${accountUsername}: ${postCount} posts, ${imageCount} images each`);
    console.log(`🕐 Request timestamp: ${new Date().toISOString()}`);
    console.log(`🎲 Random seed: ${Date.now()}`);
    
    // Get account profile
    let profile = null;
    try {
      const { data: profileData } = await db.client
        .from('account_profiles')
        .select('*')
        .eq('username', accountUsername)
        .eq('is_active', true)
        .single();
      profile = profileData;
      console.log(`✅ Found account profile for @${accountUsername}`);
    } catch (err) {
      console.log('No account profile found, using default settings');
    }
    
    // Get recently used images for this account (last 20 posts to avoid repetition)
    let recentlyUsedImageIds = [];
    try {
      const { data: recentPosts } = await db.client
        .from('generated_posts')
        .select('image_paths')
        .eq('account_username', accountUsername)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (recentPosts) {
        recentlyUsedImageIds = recentPosts
          .flatMap(post => post.image_paths || [])
          .map(path => path.split('/').pop()?.split('.')[0]) // Extract ID from path
          .filter(Boolean);
      }
    } catch (err) {
      console.log('Could not fetch recent posts, continuing without deduplication');
    }
    
    // Get available images from database
    const { data: availableImages, error: imagesError } = await db.client
      .from('images')
      .select('id, image_path, aesthetic, colors, season, occasion, username, post_id, additional')
      .not('image_path', 'is', null);
    
    if (imagesError) {
      console.error('❌ Error fetching images:', imagesError);
      return res.status(500).json({ error: 'Failed to fetch images from database' });
    }
    
    if (!availableImages || availableImages.length === 0) {
      return res.status(404).json({ error: 'No images found in database' });
    }
    
    console.log(`📊 Found ${availableImages.length} available images`);
    
    // Filter out recently used images
    const filteredImages = availableImages.filter(img => 
      !recentlyUsedImageIds.includes(img.id.toString())
    );
    
    console.log(`🎯 After deduplication: ${filteredImages.length} images available`);
    
    if (filteredImages.length < postCount * imageCount) {
      return res.status(400).json({ 
        error: `Not enough unique images available. Need ${postCount * imageCount}, have ${filteredImages.length}` 
      });
    }
    
    // Initialize OpenAI with timeout protection
    let openai = null;
    try {
      const OpenAI = (await import('openai')).default;
      openai = new OpenAI({
        timeout: 30000, // 30 second timeout
        maxRetries: 2
      });
      console.log('✅ OpenAI initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize OpenAI:', error.message);
      return res.status(500).json({ error: 'AI service unavailable, please try the simplified endpoint' });
    }
    
    const posts = [];
    
    // Generate each post with AI-powered grouping
    for (let postIndex = 0; postIndex < postCount; postIndex++) {
      console.log(`🎨 Generating post ${postIndex + 1}/${postCount} with AI...`);
      
      try {
        // Select random images for this post with timestamp-based randomization
        const timestamp = Date.now() + postIndex;
        console.log(`🎲 Post ${postIndex + 1} timestamp: ${timestamp}`);
        const shuffled = [...filteredImages].sort(() => {
          // Use timestamp to ensure different results each time
          const seed = Math.sin(timestamp + Math.random()) * 10000;
          return seed % 1 - 0.5;
        });
        const postImages = shuffled.slice(0, imageCount);
        console.log(`📸 Post ${postIndex + 1} selected images:`, postImages.map(img => img.id));
        
        // Remove these specific images from available pool
        const usedIds = postImages.map(img => img.id);
        filteredImages = filteredImages.filter(img => !usedIds.includes(img.id));
        
        // Use AI to analyze and group images thematically
        let imageAnalysis = null;
        try {
          imageAnalysis = await analyzeImagesWithAI(postImages, openai);
          console.log(`🤖 AI analysis complete for post ${postIndex + 1}: ${imageAnalysis.theme}`);
        } catch (aiError) {
          console.error(`❌ AI analysis failed for post ${postIndex + 1}:`, aiError.message);
          throw aiError; // Let it fail instead of using fallback
        }
        
        // Generate themed caption and hashtags
        let content = null;
        try {
          content = await generateThemedContent(postImages, imageAnalysis, profile, postIndex + 1, openai);
          console.log(`✍️ AI content generated: "${content.caption.substring(0, 50)}..."`);
        } catch (contentError) {
          console.error(`❌ AI content generation failed for post ${postIndex + 1}:`, contentError.message);
          throw contentError; // Let it fail instead of using fallback
        }
        
        // Create post object
        const post = {
          postNumber: postIndex + 1,
          caption: content.caption,
          hashtags: content.hashtags,
          images: postImages.map(img => ({
            id: img.id,
            imagePath: img.image_path,
            aesthetic: img.aesthetic,
            colors: img.colors,
            season: img.season,
            occasion: img.occasion
          })),
          theme: imageAnalysis.theme,
          primaryAesthetic: imageAnalysis.primaryAesthetic,
          colorPalette: imageAnalysis.colorPalette,
          generatedAt: new Date().toISOString()
        };
        
        // Save to database
        await savePostToDatabase(post, accountUsername);
        
        posts.push(post);
        console.log(`✅ Post ${postIndex + 1} generated and saved successfully`);
        
      } catch (error) {
        console.error(`❌ Failed to generate post ${postIndex + 1}:`, error.message);
        // Continue with other posts
      }
    }
    
    if (posts.length === 0) {
      return res.status(500).json({ error: 'Failed to generate any posts' });
    }
    
    // Create generation summary
    const generation = {
      id: `ai_generation_${Date.now()}`,
      accountUsername,
      postCount: posts.length,
      imageCount,
      posts: posts,
      generatedAt: new Date().toISOString(),
      strategy: profile ? {
        targetAudience: profile.target_audience,
        contentStrategy: profile.content_strategy,
        performanceGoals: profile.performance_goals
      } : null
    };
    
    console.log(`🎉 Successfully generated ${posts.length} AI-powered posts`);
    
    res.json({
      success: true,
      generation,
      posts
    });
    
  } catch (error) {
    console.error('❌ AI content generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Simplified AI content generation endpoint for debugging
app.post('/api/generate-ai-content-simple', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const { accountUsername, postCount = 1, imageCount = 2 } = req.body;
    
    console.log(`🤖 [SIMPLE] Starting AI content generation for @${accountUsername}`);
    
    // Step 1: Get images from database
    console.log(`📊 [SIMPLE] Step 1: Fetching images...`);
    const { data: availableImages, error: imagesError } = await db.client
      .from('images')
      .select('id, image_path, aesthetic, colors, season, occasion')
      .not('image_path', 'is', null);
    
    if (imagesError) {
      console.error('❌ [SIMPLE] Database error:', imagesError);
      return res.status(500).json({ error: 'Database error: ' + imagesError.message });
    }
    
    if (!availableImages || availableImages.length === 0) {
      return res.status(404).json({ error: 'No images found' });
    }
    
    console.log(`✅ [SIMPLE] Found ${availableImages.length} images`);
    
    // Step 2: Initialize OpenAI
    console.log(`🤖 [SIMPLE] Step 2: Initializing OpenAI...`);
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI();
    console.log(`✅ [SIMPLE] OpenAI initialized`);
    
    // Step 3: Select images for one post
    const shuffled = [...availableImages].sort(() => 0.5 - Math.random());
    const postImages = shuffled.slice(0, imageCount);
    console.log(`📸 [SIMPLE] Selected ${postImages.length} images for post`);
    
    // Step 4: AI Analysis
    console.log(`🧠 [SIMPLE] Step 4: Running AI analysis...`);
    const imageAnalysis = await analyzeImagesWithAI(postImages, openai);
    console.log(`✅ [SIMPLE] AI analysis complete:`, imageAnalysis.theme);
    
    // Step 5: Generate content
    console.log(`✍️ [SIMPLE] Step 5: Generating content...`);
    const content = await generateThemedContent(postImages, imageAnalysis, null, 1, openai);
    console.log(`✅ [SIMPLE] Content generated:`, content.caption.substring(0, 50));
    
    // Step 6: Create post object
    const post = {
      postNumber: 1,
      caption: content.caption,
      hashtags: content.hashtags,
      images: postImages.map(img => ({
        id: img.id,
        imagePath: img.image_path,
        aesthetic: img.aesthetic,
        colors: img.colors,
        season: img.season,
        occasion: img.occasion
      })),
      theme: imageAnalysis.theme,
      primaryAesthetic: imageAnalysis.primaryAesthetic,
      colorPalette: imageAnalysis.colorPalette,
      generatedAt: new Date().toISOString()
    };
    
    console.log(`✅ [SIMPLE] Post object created successfully`);
    
    // Step 7: Save to database (optional - skip if it fails)
    try {
      await savePostToDatabase(post, accountUsername);
      console.log(`✅ [SIMPLE] Post saved to database`);
    } catch (dbError) {
      console.warn(`⚠️ [SIMPLE] Database save failed, but continuing:`, dbError.message);
    }
    
    // Step 8: Return success
    const generation = {
      id: `simple_ai_${Date.now()}`,
      accountUsername,
      postCount: 1,
      imageCount,
      posts: [post],
      generatedAt: new Date().toISOString()
    };
    
    console.log(`🎉 [SIMPLE] Successfully generated AI content!`);
    
    res.json({
      success: true,
      generation,
      posts: [post]
    });
    
  } catch (error) {
    console.error('❌ [SIMPLE] AI content generation error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack,
      step: 'unknown'
    });
  }
});

// Test OpenAI endpoint
app.post('/api/test-openai', async (req, res) => {
  try {
    console.log('🧪 Testing OpenAI connection...');
    
    // Initialize OpenAI
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({
      timeout: 10000,
      maxRetries: 1
    });
    
    console.log('✅ OpenAI initialized, testing API call...');
    
    // Simple test call
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say "Hello World" in JSON format: {"message": "Hello World"}' }],
      response_format: { type: 'json_object' },
      max_tokens: 50
    });
    
    const result = JSON.parse(response.choices[0].message.content);
    console.log('✅ OpenAI test successful:', result);
    
    res.json({
      success: true,
      message: 'OpenAI is working!',
      result: result
    });
    
  } catch (error) {
    console.error('❌ OpenAI test failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.toString()
    });
  }
});

// AI function to analyze and group images thematically
async function analyzeImagesWithAI(images, openai) {
  try {
    const imageData = images.map(img => ({
      id: img.id,
      aesthetic: img.aesthetic,
      colors: img.colors || [],
      season: img.season,
      occasion: img.occasion,
      additional: img.additional || []
    }));
    
    const prompt = `Analyze these ${images.length} fashion images and group them thematically for a cohesive social media post.

IMAGE DATA:
${JSON.stringify(imageData, null, 2)}

Return a JSON object with:
- theme: A catchy, specific theme that unites these images (e.g., "Cozy Fall Layering", "Summer Beach Vibes", "Date Night Glam")
- primaryAesthetic: The main aesthetic these images share
- colorPalette: Array of 3-5 dominant colors that work together
- mood: The overall mood/vibe (e.g., "romantic", "casual", "sophisticated", "playful")
- targetAudience: Who this content would appeal to
- contentType: Type of post (e.g., "outfit-inspiration", "styling-tips", "trend-showcase")

Make the theme specific and engaging for social media. Return only valid JSON.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 300,
      temperature: 0.7
    });

    const result = JSON.parse(response.choices[0].message.content);
    console.log('🤖 AI analysis result:', result);
    return result;
  } catch (error) {
    console.error('❌ AI analysis error:', error.message);
    throw error;
  }
}

// AI function to generate themed caption and hashtags
async function generateThemedContent(images, analysis, profile, postNumber, openai) {
  try {
    const accountContext = profile ? `
ACCOUNT CONTEXT:
- Target Audience: ${JSON.stringify(profile.target_audience)}
- Content Strategy: ${JSON.stringify(profile.content_strategy)}
- Performance Goals: ${JSON.stringify(profile.performance_goals)}
` : '';

    const prompt = `Create TikTok content for post ${postNumber} with this theme: "${analysis.theme}"

THEME ANALYSIS:
- Primary Aesthetic: ${analysis.primaryAesthetic}
- Color Palette: ${analysis.colorPalette.join(', ')}
- Mood: ${analysis.mood}
- Target Audience: ${analysis.targetAudience}
- Content Type: ${analysis.contentType}

${accountContext}

Instructions:
- Write a very short, simple caption (1-2 sentences, very basic, easy to read, with 1-2 emojis that match the theme)
- At the end of the caption, add all hashtags as one block (not as a separate list)
- Hashtags must match the theme and ALWAYS include: #pinterest #aestheticmoodboard #fashionmoodboard
- Make sure both caption and hashtags are appropriate for the theme and target audience

Create a JSON object with:
1. caption: Short, simple caption (1-2 sentences, 1-2 emojis, with all hashtags at the end as one block)

Be authentic, fun, and keep it very simple for TikTok teens. Return only valid JSON.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 250,
      temperature: 0.8
    });

    const result = JSON.parse(response.choices[0].message.content);
    console.log('✍️ AI content result:', result);
    return result;
  } catch (error) {
    console.error('❌ AI content generation error:', error.message);
    throw error;
  }
}

// Helper function to save post to database
async function savePostToDatabase(post, accountUsername) {
  const generationId = `ai_${Date.now()}_${post.postNumber}`;
  
  try {
    // Try to save with full data first
    const { error } = await db.client
      .from('generated_posts')
      .insert({
        account_username: accountUsername,
        generation_id: generationId,
        post_number: post.postNumber,
        image_paths: post.images.map(img => img.imagePath),
        caption: post.caption,
        hashtags: post.hashtags,
        status: 'generated',
        platform: 'pending',
        created_at: post.generatedAt
      });
    
    if (error) {
      console.error('Database save error:', error);
      throw error;
    }
    
    console.log(`💾 Post ${post.postNumber} saved to database`);
    
  } catch (error) {
    console.error(`❌ Failed to save post ${post.postNumber}:`, error.message);
    throw error;
  }
}

// Preview page endpoints for Slack integration
app.post('/api/store-preview', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const { accountUsername, posts, generationId } = req.body;
    
    if (!accountUsername || !Array.isArray(posts)) {
      return res.status(400).json({ error: 'accountUsername and posts array are required' });
    }

    // Create a unique preview ID
    const previewId = generationId || `preview_${Date.now()}_${accountUsername}`;
    
    // Store the preview data
    const { error } = await db.client
      .from('preview_batches')
      .insert({
        preview_id: previewId,
        account_username: accountUsername,
        posts: posts,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      });

    if (error) {
      console.error('❌ Error storing preview:', error);
      return res.status(500).json({ error: 'Failed to store preview' });
    }

    console.log(`✅ Preview stored with ID: ${previewId}`);
    
    res.json({
      success: true,
      previewId,
      previewUrl: `https://${process.env.VERCEL_URL || 'content-pipeline.vercel.app'}/api/preview/${previewId}`,
      downloadUrl: `https://${process.env.VERCEL_URL || 'content-pipeline.vercel.app'}/api/preview/${previewId}/download`
    });

  } catch (error) {
    console.error('❌ Store preview error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get preview page
app.get('/api/preview/:previewId', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const { previewId } = req.params;
    
    // Get preview data
    const { data: preview, error } = await db.client
      .from('preview_batches')
      .select('*')
      .eq('preview_id', previewId)
      .single();

    if (error || !preview) {
      return res.status(404).json({ error: 'Preview not found' });
    }

    // Check if expired
    if (new Date(preview.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Preview has expired' });
    }

    // Return HTML preview page
    const html = generatePreviewHTML(preview);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);

  } catch (error) {
    console.error('❌ Get preview error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download preview content
app.get('/api/preview/:previewId/download', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const { previewId } = req.params;
    
    // Get preview data
    const { data: preview, error } = await db.client
      .from('preview_batches')
      .select('*')
      .eq('preview_id', previewId)
      .single();

    if (error || !preview) {
      return res.status(404).json({ error: 'Preview not found' });
    }

    // Check if expired
    if (new Date(preview.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Preview has expired' });
    }

    // Generate download data
    const downloadData = {
      accountUsername: preview.account_username,
      generatedAt: preview.created_at,
      posts: preview.posts.map(post => ({
        postNumber: post.postNumber,
        caption: post.caption,
        hashtags: post.hashtags,
        images: post.images.map(img => ({
          url: img.imagePath,
          aesthetic: img.aesthetic,
          colors: img.colors
        }))
      }))
    };

    // Set headers for download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="content-${preview.account_username}-${previewId}.json"`);
    
    res.json(downloadData);

  } catch (error) {
    console.error('❌ Download preview error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download all images as ZIP
app.get('/api/preview/:previewId/download-images', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const { previewId } = req.params;
    
    // Get preview data
    const { data: preview, error } = await db.client
      .from('preview_batches')
      .select('*')
      .eq('preview_id', previewId)
      .single();

    if (error || !preview) {
      return res.status(404).json({ error: 'Preview not found' });
    }

    // Check if expired
    if (new Date(preview.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Preview has expired' });
    }

    console.log(`📦 Creating ZIP for ${preview.posts.length} posts with ${preview.posts.reduce((sum, post) => sum + post.images.length, 0)} images`);

    // Import JSZip dynamically
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    // Download and add each image to the ZIP
    for (const post of preview.posts) {
      for (let i = 0; i < post.images.length; i++) {
        const img = post.images[i];
        try {
          // Download the image
          const imageResponse = await fetch(img.imagePath);
          if (!imageResponse.ok) {
            console.warn(`⚠️ Failed to download image: ${img.imagePath}`);
            continue;
          }
          
          const imageBuffer = await imageResponse.arrayBuffer();
          
          // Create filename: username_post1_image1.jpg
          const filename = `${preview.account_username}_post${post.postNumber}_image${i + 1}.jpg`;
          
          // Add to ZIP
          zip.file(filename, imageBuffer);
          console.log(`✅ Added ${filename} to ZIP`);
          
        } catch (imgError) {
          console.error(`❌ Error downloading image ${img.imagePath}:`, imgError.message);
        }
      }
    }

    // Generate ZIP file
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    
    // Set headers for ZIP download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${preview.account_username}_all_images.zip"`);
    res.setHeader('Content-Length', zipBuffer.length);
    
    res.send(zipBuffer);
    console.log(`✅ ZIP file created and sent: ${zipBuffer.length} bytes`);

  } catch (error) {
    console.error('❌ Download images ZIP error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to generate preview HTML
function generatePreviewHTML(preview) {
  const posts = preview.posts;
  const accountUsername = preview.account_username;
  
  const postsHTML = posts.map(post => {
    const imagesHTML = post.images.map((img, imgIndex) => `
      <div class="image-container">
        <div class="image-wrapper">
          <img src="${img.imagePath}" alt="Generated content" class="content-image">
          <div class="download-overlay">
            <button class="download-btn" onclick="downloadImage('${img.imagePath}', '${accountUsername}_post${post.postNumber}_image${imgIndex + 1}.jpg')">
              <i class="fas fa-download"></i>
            </button>
          </div>
        </div>
        <div class="image-info">
          <span class="aesthetic">${img.aesthetic || 'Mixed'}</span>
          ${img.colors ? `<span class="colors">${img.colors.join(', ')}</span>` : ''}
        </div>
      </div>
    `).join('');

    return `
      <div class="post" id="post${post.postNumber}">
        <h3>Post ${post.postNumber}</h3>
        <div class="images-grid">
          ${imagesHTML}
        </div>
        <div class="content">
          <div class="caption">
            <h4>Caption:</h4>
            <p>${post.caption}</p>
            <button class="copy-btn" onclick="copyToClipboard('${post.caption.replace(/'/g, "\\'")}')">
              <i class="fas fa-copy"></i> Copy Caption
            </button>
          </div>
          <div class="hashtags">
            <h4>Hashtags:</h4>
            <div class="hashtag-list">
              ${post.hashtags.map(tag => `<span class="hashtag">${tag}</span>`).join('')}
            </div>
            <button class="copy-btn" onclick="copyToClipboard('${post.hashtags.join(' ')}')">
              <i class="fas fa-copy"></i> Copy Hashtags
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Content Preview - @${accountUsername}</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #1a1a1a; color: #ffffff; line-height: 1.6;
                padding: 20px;
            }
            .header { 
                text-align: center; margin-bottom: 30px; padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 10px;
            }
            .header h1 { font-size: 2.5em; margin-bottom: 10px; }
            .header p { opacity: 0.9; font-size: 1.1em; }
            .download-btn {
                display: inline-block; background: #4CAF50; color: white;
                padding: 12px 24px; text-decoration: none; border-radius: 6px;
                margin: 10px; font-weight: bold; transition: background 0.3s;
                border: none; cursor: pointer; font-size: 1em;
            }
            .download-btn:hover { background: #45a049; }
            .download-all-btn {
                background: #2196F3; margin-left: 10px;
            }
            .download-all-btn:hover { background: #1976D2; }
            .post { 
                background: #2a2a2a; margin: 20px 0; padding: 20px;
                border-radius: 10px; border-left: 4px solid #667eea;
            }
            .post h3 { color: #667eea; margin-bottom: 15px; font-size: 1.5em; }
            .images-grid { 
                display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px; margin-bottom: 20px;
            }
            .image-container { position: relative; }
            .image-wrapper { position: relative; overflow: hidden; border-radius: 8px; }
            .content-image { 
                width: 100%; 
                height: 400px; 
                object-fit: contain; /* Show full image, not cropped */
                background: #222;
                border: 2px solid #333; 
                border-radius: 8px;
                transition: transform 0.3s ease;
            }
            .image-wrapper:hover .content-image {
                transform: scale(1.05);
            }
            .download-overlay {
                position: absolute; top: 10px; right: 10px;
                opacity: 0; transition: opacity 0.3s ease;
                background: rgba(0,0,0,0.7); border-radius: 50%;
                width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
            }
            .image-wrapper:hover .download-overlay {
                opacity: 1;
            }
            .download-overlay .download-btn {
                background: #4CAF50; color: white; border: none;
                width: 100%; height: 100%; border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                font-size: 16px; margin: 0; padding: 0;
            }
            .download-overlay .download-btn:hover {
                background: #45a049;
            }
            .image-info { 
                position: absolute; bottom: 0; left: 0; right: 0;
                background: rgba(0,0,0,0.8); padding: 8px;
                border-radius: 0 0 8px 8px; font-size: 0.9em;
            }
            .aesthetic { color: #667eea; font-weight: bold; }
            .colors { color: #ccc; margin-left: 10px; }
            .content h4 { color: #667eea; margin: 15px 0 8px 0; }
            .caption p { background: #333; padding: 15px; border-radius: 6px; margin-bottom: 10px; }
            .hashtag-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
            .hashtag { 
                background: #667eea; color: white; padding: 4px 8px;
                border-radius: 4px; font-size: 0.9em;
            }
            .copy-btn {
                background: #666; color: white; border: none;
                padding: 8px 12px; border-radius: 4px; cursor: pointer;
                font-size: 0.9em; transition: background 0.3s;
            }
            .copy-btn:hover { background: #555; }
            .footer { 
                text-align: center; margin-top: 40px; padding: 20px;
                border-top: 1px solid #333; opacity: 0.7;
            }
            .loading {
                display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.8); z-index: 1000;
                align-items: center; justify-content: center;
            }
            .loading.show { display: flex; }
            .loading-content {
                background: #2a2a2a; padding: 30px; border-radius: 10px;
                text-align: center;
            }
            .spinner {
                border: 4px solid #333; border-top: 4px solid #667eea;
                border-radius: 50%; width: 40px; height: 40px;
                animation: spin 1s linear infinite; margin: 0 auto 20px;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            @media (max-width: 768px) {
                .images-grid { grid-template-columns: 1fr; }
                .header h1 { font-size: 2em; }
                .download-overlay { opacity: 1; }
            }
        </style>
    </head>
    <body>
        <div class="loading" id="loading">
            <div class="loading-content">
                <div class="spinner"></div>
                <p>Downloading images...</p>
            </div>
        </div>
        
        <div class="header">
            <h1>🎨 Content Preview</h1>
            <p>Generated content for @${accountUsername}</p>
            <p>${posts.length} posts • ${posts.reduce((sum, post) => sum + post.images.length, 0)} images</p>
            <button class="download-btn download-all-btn" onclick="downloadAllImages()">
                <i class="fas fa-download"></i> Download All Images
            </button>
        </div>
        
        ${postsHTML}
        
        <div class="footer">
            <p>Content Pipeline • Generated on ${new Date(preview.created_at).toLocaleString()}</p>
            <p>This preview expires on ${new Date(preview.expires_at).toLocaleString()}</p>
        </div>

        <script>
            // Download individual image
            async function downloadImage(imageUrl, filename) {
                try {
                    const response = await fetch(imageUrl);
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                } catch (error) {
                    console.error('Download failed:', error);
                    alert('Failed to download image. Please try again.');
                }
            }

            // Download all images as ZIP
            async function downloadAllImages() {
                const loading = document.getElementById('loading');
                loading.classList.add('show');
                
                try {
                    const response = await fetch('/api/preview/${preview.preview_id}/download-images');
                    if (!response.ok) {
                        throw new Error('Failed to download images');
                    }
                    
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = '${accountUsername}_all_images.zip';
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                } catch (error) {
                    console.error('Download failed:', error);
                    alert('Failed to download images. Please try again.');
                } finally {
                    loading.classList.remove('show');
                }
            }

            // Copy text to clipboard
            async function copyToClipboard(text) {
                try {
                    await navigator.clipboard.writeText(text);
                    // Show a brief success message
                    const btn = event.target.closest('.copy-btn');
                    const originalText = btn.innerHTML;
                    btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    btn.style.background = '#4CAF50';
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.style.background = '#666';
                    }, 2000);
                } catch (error) {
                    console.error('Copy failed:', error);
                    alert('Failed to copy to clipboard. Please copy manually.');
                }
            }
        </script>
    </body>
    </html>
  `;
}

// Catch-all handler for SPA (must be after all other routes)
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