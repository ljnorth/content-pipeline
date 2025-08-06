// Simple API Server for Content Pipeline
// Fixed for Vercel deployment

import express from 'express';
import path from 'path';

const app = express();

import { SupabaseClient } from '../src/database/supabase-client.js';

// Database client - initialize later to avoid top-level await
let db = null;

// Initialize database connection
async function initializeDatabase() {
  try {
    db = new SupabaseClient();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  }
}

// Manual CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  
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

// ========================================
// CORE ENDPOINTS
// ========================================

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

// Debug endpoint
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
    res.status(500).json({ error: error.message });
  }
});

// Account profiles endpoint
app.get('/api/account-profiles', async (req, res) => {
  try {
    if (!db) {
      await initializeDatabase();
    }
    
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    const { data, error } = await db.client.from('account_profiles').select('*');
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ 
      accounts: data || [],
      count: data?.length || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generated posts endpoint
app.get('/api/generated-posts', async (req, res) => {
  try {
    if (!db) {
      await initializeDatabase();
    }
    
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    const { data, error } = await db.client.from('posts').select('*').order('created_at', { ascending: false }).limit(50);
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ 
      posts: data || [],
      count: data?.length || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Content data endpoint
app.get('/api/content-data', async (req, res) => {
  try {
    if (!db) {
      await initializeDatabase();
    }
    
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    // Get basic stats
    const { count: totalPosts } = await db.client.from('posts').select('*', { count: 'exact', head: true });
    const { count: totalImages } = await db.client.from('images').select('*', { count: 'exact', head: true });
    const { data: accounts } = await db.client.from('account_profiles').select('*');
    
    res.json({
      totalPosts: totalPosts || 0,
      totalImages: totalImages || 0,
      activeAccounts: accounts?.length || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// MAIN ROUTES
// ========================================

// Root route - serve the dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../src/web/public/index.html'));
});

// TikTok OAuth callback
app.get('/auth/tiktok/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: 'No authorization code received' });
    }
    
    res.json({ 
      message: 'TikTok OAuth callback received',
      code: code,
      state: state,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// ERROR HANDLING
// ========================================

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

// ========================================
// VERCEL EXPORT
// ========================================

// Initialize database on startup
initializeDatabase().catch(console.error);

// Export for Vercel
module.exports = app; 