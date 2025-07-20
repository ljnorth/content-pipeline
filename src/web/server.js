import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { SupabaseClient } from '../database/supabase-client.js';
import { FashionDataPipeline } from '../pipeline/fashion-pipeline.js';
import { TikTokAPI } from '../automation/tiktok-api.js';
import { Logger } from '../utils/logger.js';

// Serve static HTML UI
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const logger = new Logger();
const db = new SupabaseClient();
const tiktokAPI = new TikTokAPI();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.get('/api/accounts', async (req, res) => {
  try {
    const accounts = await db.getAllAccounts();
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/accounts', async (req, res) => {
  const { username, url } = req.body;
  if (!username) return res.status(400).json({ error: 'username is required' });
  try {
    await db.upsertAccount({ username: username.toLowerCase(), url: url || `https://www.tiktok.com/@${username}` });
    res.json({ message: 'Account added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/accounts/:username', async (req, res) => {
  const { username } = req.params;
  try {
    await db.deleteAccount(username.toLowerCase());
    res.json({ message: 'Account removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/run', async (req, res) => {
  // Kick off pipeline asynchronously
  (async () => {
    try {
      const pipeline = new FashionDataPipeline();
      await pipeline.run();
      logger.success('Pipeline run via web UI finished');
    } catch (err) {
      logger.error('Pipeline run via web UI failed:', err);
    }
  })();
  res.json({ status: 'Pipeline started' });
});

// Dashboard API endpoints
app.get('/api/metrics', async (req, res) => {
  try {
    // Use count queries for accurate totals
    const { count: totalPosts } = await db.client.from('posts').select('*', { count: 'exact', head: true });
    const { count: totalImages } = await db.client.from('images').select('*', { count: 'exact', head: true });
    const { data: accounts } = await db.client.from('accounts').select('*');
    
    const activeAccounts = accounts?.length || 0;
    
    // Get posts for engagement calculation (limit to avoid memory issues)
    const { data: posts } = await db.client.from('posts').select('engagement_rate').limit(5000);
    
    // Calculate average engagement rate
    const avgEngagement = posts?.length > 0 
      ? posts.reduce((sum, post) => sum + (post.engagement_rate || 0), 0) / posts.length 
      : 0;
    
    res.json({
      totalPosts,
      totalImages,
      activeAccounts,
      avgEngagement
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/trending', async (req, res) => {
  try {
    // Use the new trending_analysis view for comprehensive trending data
    const { data: trendingData } = await db.client
      .from('trending_analysis')
      .select('*')
      .order('trend_percentage', { ascending: false })
      .limit(20);
    
    if (!trendingData) {
      return res.json({ aesthetics: [], seasons: [], colors: [] });
    }
    
    // Group by category
    const aesthetics = trendingData
      .filter(item => item.category === 'aesthetic')
      .map(item => ({
        name: item.name,
        count: item.total_count,
        trend: item.trend_percentage,
        avgPerformance: Math.round(item.avg_performance * 100) / 100,
        avgEngagement: Math.round(item.avg_engagement * 100) / 100,
        avgLikes: Math.round(item.avg_likes),
        avgViews: Math.round(item.avg_views)
      }));
    
    const seasons = trendingData
      .filter(item => item.category === 'season')
      .map(item => ({
        name: item.name,
        count: item.total_count,
        trend: item.trend_percentage,
        avgPerformance: Math.round(item.avg_performance * 100) / 100,
        avgEngagement: Math.round(item.avg_engagement * 100) / 100,
        avgLikes: Math.round(item.avg_likes),
        avgViews: Math.round(item.avg_views)
      }));
    
    const colors = trendingData
      .filter(item => item.category === 'color')
      .map(item => ({
        name: item.name,
        count: item.total_count,
        trend: item.trend_percentage,
        avgPerformance: Math.round(item.avg_performance * 100) / 100,
        avgEngagement: Math.round(item.avg_engagement * 100) / 100,
        avgLikes: Math.round(item.avg_likes),
        avgViews: Math.round(item.avg_views)
      }));
    
    res.json({ aesthetics, seasons, colors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/engagement-trends', async (req, res) => {
  try {
    // Get engagement data for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: posts } = await db.client
      .from('posts')
      .select('engagement_rate, created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at');
    
    // Group by day and calculate average engagement
    const dailyEngagement = {};
    posts?.forEach(post => {
      const date = post.created_at.split('T')[0];
      if (!dailyEngagement[date]) {
        dailyEngagement[date] = { total: 0, count: 0 };
      }
      dailyEngagement[date].total += post.engagement_rate || 0;
      dailyEngagement[date].count += 1;
    });
    
    const labels = Object.keys(dailyEngagement).sort();
    const values = labels.map(date => {
      const day = dailyEngagement[date];
      return day.count > 0 ? day.total / day.count : 0;
    });
    
    res.json({ labels, values });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/filter', async (req, res) => {
  try {
    const { filters, sortBy = 'created_at', sortOrder = 'desc', limit = 10000 } = req.body;
    
    let query = db.client
      .from('stylistic_insights')
      .select('*');
    
    // Apply filters
    if (filters && filters.length > 0) {
      filters.forEach((filter, index) => {
        const { field, operator, value } = filter;
        
        if (field === 'aesthetic' || field === 'season' || field === 'occasion') {
          if (operator === 'equals') {
            query = query.eq(field, value);
          } else if (operator === 'contains') {
            query = query.ilike(field, `%${value}%`);
          } else if (operator === 'in') {
            const values = Array.isArray(value) ? value : [value];
            query = query.in(field, values);
          }
        } else if (field === 'colors') {
          if (operator === 'contains') {
            // Search for images that contain any of the specified colors
            query = query.contains('colors', value);
          } else if (operator === 'in') {
            const colors = Array.isArray(value) ? value : [value];
            // Use OR logic for multiple colors
            query = query.or(colors.map(color => `colors.cs.{${color}}`).join(','));
          }
        } else if (field === 'additional') {
          if (operator === 'contains') {
            query = query.contains('additional', [value]);
          } else if (operator === 'in') {
            const values = Array.isArray(value) ? value : [value];
            query = query.overlaps('additional', values);
          }
        } else if (field === 'engagement_rate' || field === 'like_count' || field === 'view_count' || field === 'comment_count' || field === 'save_count' || field === 'performance_score') {
          const numValue = parseFloat(value);
          if (operator === 'greater_than') {
            query = query.gt(field, numValue);
          } else if (operator === 'less_than') {
            query = query.lt(field, numValue);
          } else if (operator === 'between') {
            const [min, max] = Array.isArray(value) ? value : [0, value];
            query = query.gte(field, min).lte(field, max);
          }
        } else if (field === 'username') {
          if (operator === 'equals') {
            query = query.eq('username', value);
          } else if (operator === 'contains') {
            query = query.ilike('username', `%${value}%`);
          } else if (operator === 'in') {
            const usernames = Array.isArray(value) ? value : [value];
            query = query.in('username', usernames);
          }
        } else if (field === 'created_at') {
          if (operator === 'after') {
            query = query.gte('created_at', value);
          } else if (operator === 'before') {
            query = query.lte('created_at', value);
          } else if (operator === 'between') {
            const [start, end] = Array.isArray(value) ? value : [value, new Date().toISOString()];
            query = query.gte('created_at', start).lte('created_at', end);
          }
        }
      });
    }
    
    // Apply sorting
    if (sortBy) {
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    }
    
    // Apply limit - increased to handle all images
    const { data: images } = await query.limit(limit);
    
    res.json({ images: images || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/generate', async (req, res) => {
  try {
    const { imageCount, performanceMetric, diversityLevel, maxPerPost, filters = {} } = req.body;
    
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
    const { data: images } = await imageQuery;
    
    if (!images || images.length === 0) {
      return res.json({ images: [] });
    }
    
    // Get posts for these images
    const postIds = [...new Set(images.map(img => img.post_id))];
    const { data: posts } = await db.client
      .from('posts')
      .select('*')
      .in('post_id', postIds);
    
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
    
    res.json({ images: selectedImages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/save-generation', async (req, res) => {
  try {
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
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/filter-options', async (req, res) => {
  try {
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
    res.status(500).json({ error: err.message });
  }
});

// Account Management endpoints
app.get('/api/accounts', async (req, res) => {
  try {
    const { data: accounts } = await db.client
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Get stats for each account
    const accountsWithStats = await Promise.all(
      (accounts || []).map(async (account) => {
        const { data: posts } = await db.client
          .from('posts')
          .select('engagement_rate, like_count, view_count')
          .eq('username', account.username);
        
        const { data: images } = await db.client
          .from('images')
          .select('id')
          .eq('username', account.username);
        
        const totalPosts = posts?.length || 0;
        const totalImages = images?.length || 0;
        const avgEngagement = posts?.length > 0 
          ? posts.reduce((sum, post) => sum + (post.engagement_rate || 0), 0) / posts.length 
          : 0;
        
        return {
          ...account,
          totalPosts,
          totalImages,
          avgEngagement: Math.round(avgEngagement * 100) / 100
        };
      })
    );
    
    res.json(accountsWithStats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/accounts', async (req, res) => {
  try {
    const { username, url } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    // Clean username (remove @ if present)
    const cleanUsername = username.replace('@', '');
    
    const { data, error } = await db.client
      .from('accounts')
      .insert({
        username: cleanUsername,
        url: url || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(400).json({ error: 'Account already exists' });
      }
      throw error;
    }
    
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/accounts/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    // Delete related data first (due to foreign key constraints)
    await db.client.from('images').delete().eq('username', username);
    await db.client.from('posts').delete().eq('username', username);
    await db.client.from('accounts').delete().eq('username', username);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pipeline monitoring endpoints
app.post('/api/pipeline/run', async (req, res) => {
  try {
    const { type = 'full', method = 'sequential' } = req.body;
    
    // Create pipeline run record
    const { data: runRecord, error: runError } = await db.client
      .from('pipeline_runs')
      .insert({
        type,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (runError) {
      throw runError;
    }
    
    // Start pipeline in background
    setTimeout(async () => {
      try {
        // Add initial log
        await db.client.rpc('add_pipeline_log', {
          p_run_id: runRecord.id,
          p_level: 'info',
          p_message: `Pipeline started: ${type}`
        });
        
        if (type === 'full') {
          // Import and run pipeline based on selected method
          let pipeline;
          
          await db.client.rpc('add_pipeline_log', {
            p_run_id: runRecord.id,
            p_level: 'info',
            p_message: `Running ${method} pipeline...`
          });
          
          if (method === 'fast') {
            const { FashionDataPipelineFast } = await import('../pipeline/fashion-pipeline-fast.js');
            pipeline = new FashionDataPipelineFast();
          } else if (method === 'batch') {
            const { FashionDataPipelineBatch } = await import('../pipeline/fashion-pipeline-batch.js');
            pipeline = new FashionDataPipelineBatch();
          } else {
            // Default to sequential
            const { FashionDataPipeline } = await import('../pipeline/fashion-pipeline.js');
            pipeline = new FashionDataPipeline();
          }
          
          await pipeline.run();
          
          // Update status to completed
          await db.client.rpc('update_pipeline_run_status', {
            p_run_id: runRecord.id,
            p_status: 'completed'
          });
          
          await db.client.rpc('add_pipeline_log', {
            p_run_id: runRecord.id,
            p_level: 'success',
            p_message: 'Pipeline completed successfully'
          });
          
        } else if (type === 'analysis') {
          // Run analysis only on existing images
          const { AIAnalyzer } = await import('../stages/ai-analyzer.js');
          const { DatabaseStorage } = await import('../stages/database-storage.js');
          
          await db.client.rpc('add_pipeline_log', {
            p_run_id: runRecord.id,
            p_level: 'info',
            p_message: 'Running analysis pipeline...'
          });
          
          // Get unanalyzed images
          const { data: images } = await db.client
            .from('images')
            .select('*')
            .is('aesthetic', null);
          
          if (images && images.length > 0) {
            await db.client.rpc('add_pipeline_log', {
              p_run_id: runRecord.id,
              p_level: 'info',
              p_message: `Found ${images.length} unanalyzed images`
            });
            
            const analyzer = new AIAnalyzer();
            const dbStorage = new DatabaseStorage();
            
            // Process images for analysis
            const analyzed = await analyzer.process(images.map(img => ({
              postId: img.post_id,
              imagePath: img.image_path,
              metadata: { post_id: img.post_id, username: img.username }
            })));
            
            // Update database with analysis results
            await dbStorage.process(analyzed);
            
            await db.client.rpc('update_pipeline_run_status', {
              p_run_id: runRecord.id,
              p_status: 'completed',
              p_images_processed: images.length
            });
            
            await db.client.rpc('add_pipeline_log', {
              p_run_id: runRecord.id,
              p_level: 'success',
              p_message: `Analysis completed for ${images.length} images`
            });
          } else {
            await db.client.rpc('add_pipeline_log', {
              p_run_id: runRecord.id,
              p_level: 'warning',
              p_message: 'No unanalyzed images found'
            });
            
            await db.client.rpc('update_pipeline_run_status', {
              p_run_id: runRecord.id,
              p_status: 'completed'
            });
          }
        }
      } catch (error) {
        console.error('Pipeline run failed:', error);
        
        // Log error and update status
        await db.client.rpc('add_pipeline_log', {
          p_run_id: runRecord.id,
          p_level: 'error',
          p_message: `Pipeline failed: ${error.message}`
        });
        
        await db.client.rpc('update_pipeline_run_status', {
          p_run_id: runRecord.id,
          p_status: 'failed',
          p_error_message: error.message
        });
      }
    }, 100);
    
    res.json({ success: true, message: `Pipeline started (${type})`, runId: runRecord.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pipeline/status', async (req, res) => {
  try {
    // Get recent pipeline activity
    const { data: recentRuns } = await db.client
      .from('recent_pipeline_activity')
      .select('*')
      .limit(5);
    
    // Get current counts
    const { data: accounts } = await db.client.from('accounts').select('id');
    const { data: posts } = await db.client.from('posts').select('id');
    const { data: images } = await db.client.from('images').select('id');
    
    // Check if any pipeline is currently running
    const { data: runningPipelines } = await db.client
      .from('pipeline_runs')
      .select('*')
      .eq('status', 'running');
    
    const status = {
      lastRun: recentRuns?.[0]?.started_at || new Date().toISOString(),
      isRunning: (runningPipelines?.length || 0) > 0,
      totalAccounts: accounts?.length || 0,
      totalPosts: posts?.length || 0,
      totalImages: images?.length || 0,
      recentRuns: recentRuns || []
    };
    
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pipeline/logs', async (req, res) => {
  try {
    const { runId } = req.query;
    
    let query = db.client
      .from('pipeline_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);
    
    if (runId) {
      query = query.eq('run_id', runId);
    }
    
    const { data: logs } = await query;
    res.json(logs || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/saved-generations', async (req, res) => {
  try {
    const { data: generations } = await db.client
      .from('generations')
      .select('*')
      .order('created_at', { ascending: false });
    
    res.json(generations || []);
  } catch (err) {
    // If table doesn't exist, return empty array
    res.json([]);
  }
});

app.post('/api/export-generation', async (req, res) => {
  try {
    const { images } = req.body;
    
    if (!images || images.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }
    
    // Import required modules
    const AdmZip = (await import('adm-zip')).default;
    const fs = await import('fs');
    const path = await import('path');
    
    // Create a new ZIP file
    const zip = new AdmZip();
    
    // Process each image
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const imagePath = image.image_path;
      
      try {
        // Check if file exists
        if (fs.existsSync(imagePath)) {
          // Read the file
          const imageData = fs.readFileSync(imagePath);
          
          // Get the original filename
          const originalName = path.basename(imagePath);
          
          // Create a new filename with index to avoid conflicts
          const newFileName = `image_${i + 1}_${originalName}`;
          
          // Add to ZIP
          zip.addFile(newFileName, imageData);
          
          logger.info(`Added ${originalName} to ZIP as ${newFileName}`);
        } else {
          logger.warn(`Image file not found: ${imagePath}`);
        }
      } catch (fileError) {
        logger.error(`Error processing image ${imagePath}:`, fileError);
      }
    }
    
    // Generate ZIP buffer
    const zipBuffer = zip.toBuffer();
    
    // Set headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `generated-content-${timestamp}.zip`;
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', zipBuffer.length);
    
    // Send the ZIP file
    res.send(zipBuffer);
    
    logger.success(`Successfully exported ${images.length} images as ${filename}`);
    
  } catch (err) {
    logger.error('Export error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/test-images', async (req, res) => {
  try {
    // Get total count first
    const { count } = await db.client
      .from('images')
      .select('*', { count: 'exact', head: true });
      
    // Get a sample of images
    const { data: images } = await db.client
      .from('images')
      .select('*')
      .limit(10);
    
    res.json({ 
      totalCount: count,
      sampleCount: images?.length || 0,
      images: images || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/test-posts', async (req, res) => {
  try {
    // Direct query to posts table
    const { data: posts } = await db.client
      .from('posts')
      .select('*')
      .limit(5);
    
    res.json({ 
      count: posts?.length || 0,
      posts: posts || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Account profiles endpoints
app.get('/api/account-profiles', async (req, res) => {
  try {
    const { data: profiles, error } = await db.client
      .from('account_profiles')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (error) {
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
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
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

// Delete account profile
app.delete('/api/account-profiles/:username', async (req, res) => {
  try {
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

// Account-specific generation endpoint
app.post('/api/generate-for-account', async (req, res) => {
  try {
    const { accountUsername, generationType, imageCount, profile } = req.body;
    
    if (!accountUsername || !profile) {
      return res.status(400).json({ error: 'Account username and profile are required' });
    }
    
    // Build optimized filters based on account profile
    let filters = {};
    
    if (generationType === 'optimized') {
      // Use AI optimization based on profile
      filters = {
        aesthetics: profile.content_strategy.aestheticFocus || [],
        colors: profile.content_strategy.colorPalette || [],
        occasions: [], // Could be inferred from target audience
        seasons: [], // Could be based on current season or profile
        additional: [],
        usernames: []
      };
      
      // Add performance-based optimization
      try {
        const { data: analytics, error: analyticsError } = await db.client
          .from('performance_analytics')
          .select('aesthetic, color, avg_engagement')
          .eq('account_username', accountUsername)
          .order('avg_engagement', { ascending: false })
          .limit(10);
        
        if (!analyticsError && analytics && analytics.length > 0) {
          // Use top performing aesthetics and colors
          filters.aesthetics = analytics.map(a => a.aesthetic).filter(a => a);
          filters.colors = analytics.map(a => a.color).filter(c => c);
          console.log(`🎯 Using performance-based filters: ${filters.aesthetics.length} aesthetics, ${filters.colors.length} colors`);
        }
      } catch (analyticsError) {
        console.warn('Performance analytics not available, using default filters');
      }
      
    } else {
      // Custom generation - use current form selections
      // This would fall back to regular generation logic
      filters = {
        aesthetics: [],
        colors: [],
        occasions: [],
        seasons: [],
        additional: [],
        usernames: []
      };
    }
    
    // Generate images using the same logic as regular generation
    const { data: images } = await db.client
      .from('images')
      .select('*');
    
    // Apply filters
    let filteredImages = images;
    
    if (filters.aesthetics && filters.aesthetics.length > 0) {
      filteredImages = filteredImages.filter(img => 
        filters.aesthetics.includes(img.aesthetic)
      );
    }
    
    if (filters.colors && filters.colors.length > 0) {
      filteredImages = filteredImages.filter(img => 
        img.colors && filters.colors.some(color => img.colors.includes(color))
      );
    }
    
    // Apply diversity and performance optimization
    const optimizedImages = optimizeImageSelection(filteredImages, imageCount, profile);
    
    // Save generation record
    const generationRecord = {
      account_username: accountUsername,
      generation_params: {
        generationType,
        filters,
        imageCount,
        profile: {
          username: profile.username,
          target_audience: profile.target_audience,
          content_strategy: profile.content_strategy,
          performance_goals: profile.performance_goals
        }
      },
      image_data: optimizedImages.map(img => ({
        id: img.id,
        image_path: img.image_path,
        aesthetic: img.aesthetic,
        colors: img.colors,
        post_id: img.post_id,
        username: img.username
      }))
    };
    
    // Save generation to database
    try {
      const { error: saveError } = await db.client
        .from('saved_generations')
        .insert({
          generation_id: `gen_${Date.now()}_${accountUsername}`,
          account_username: accountUsername,
          generation_type: generationType,
          generation_params: generationRecord.generation_params,
          image_data: generationRecord.image_data,
          image_count: optimizedImages.length,
          created_at: new Date().toISOString()
        });
      
      if (saveError) {
        console.error('Failed to save generation record:', saveError);
      } else {
        console.log(`✅ Saved generation record for @${accountUsername}`);
      }
    } catch (saveError) {
      console.error('Error saving generation record:', saveError.message);
    }
    
    res.json({ 
      images: optimizedImages,
      profile: profile,
      generationType: generationType,
      optimization: {
        targetAudience: profile.target_audience,
        contentStrategy: profile.content_strategy,
        performanceGoals: profile.performance_goals
      }
    });
    
  } catch (err) {
    console.error('Error generating content for account:', err);
    res.status(500).json({ error: err.message });
  }
});

// Hook slides and theme generation endpoints
app.get('/api/hook-slides', async (req, res) => {
  try {
    const { HookSlideStorage } = await import('../stages/hook-slide-storage.js');
    const hookSlideStorage = new HookSlideStorage();
    
    const stats = await hookSlideStorage.getStats();
    const themes = await hookSlideStorage.getAvailableThemes();
    
    res.json({
      success: true,
      stats,
      themes
    });
  } catch (error) {
    console.error('Error fetching hook slides:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/available-themes', async (req, res) => {
  try {
    const { HookSlideStorage } = await import('../stages/hook-slide-storage.js');
    const hookSlideStorage = new HookSlideStorage();
    
    const themes = await hookSlideStorage.getAvailableThemes();
    
    res.json({
      success: true,
      themes
    });
  } catch (error) {
    console.error('Error fetching themes:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/generate-theme-content', async (req, res) => {
  try {
    const { accountUsername, preferredTheme, imageCount = 10, colorScheme = null, aestheticPreference = null } = req.body;
    
    if (!accountUsername) {
      return res.status(400).json({ error: 'Account username is required' });
    }
    
    const { ThemeContentGenerator } = await import('../stages/theme-content-generator.js');
    const generator = new ThemeContentGenerator();
    
    const result = await generator.generateForAccount(accountUsername, {
      preferredTheme,
      imageCount,
      colorScheme,
      aestheticPreference,
      ensureColorUniformity: true
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('Error generating theme content:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/background-color-analytics', async (req, res) => {
  try {
    const { BackgroundColorStorage } = await import('../stages/background-color-storage.js');
    const colorStorage = new BackgroundColorStorage();
    
    const analytics = await colorStorage.getBackgroundColorAnalytics();
    
    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Error fetching color analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/run-enhanced-pipeline', async (req, res) => {
  try {
    const { type = 'hook-slides', method = 'sequential' } = req.body;
    
    // Create pipeline run record
    const { data: runRecord, error: runError } = await db.client
      .from('pipeline_runs')
      .insert({
        type: `enhanced-${type}`,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (runError) {
      throw runError;
    }
    
    // Start enhanced pipeline in background
    setTimeout(async () => {
      try {
        await db.client.rpc('add_pipeline_log', {
          p_run_id: runRecord.id,
          p_level: 'info',
          p_message: `Enhanced pipeline started: ${type}`
        });
        
        if (type === 'hook-slides') {
          const { FashionDataPipelineEnhanced } = await import('../pipeline/fashion-pipeline-enhanced.js');
          const pipeline = new FashionDataPipelineEnhanced();
          
          await db.client.rpc('add_pipeline_log', {
            p_run_id: runRecord.id,
            p_level: 'info',
            p_message: 'Running hook slide detection on existing images...'
          });
          
          const result = await pipeline.runHookSlideDetectionOnly();
          
          await db.client.rpc('update_pipeline_run_status', {
            p_run_id: runRecord.id,
            p_status: 'completed',
            p_images_processed: result.processed
          });
          
          await db.client.rpc('add_pipeline_log', {
            p_run_id: runRecord.id,
            p_level: 'success',
            p_message: `Hook slide detection completed: ${result.found} hook slides found from ${result.processed} images`
          });
          
        } else if (type === 'full-enhanced') {
          const { FashionDataPipelineEnhanced } = await import('../pipeline/fashion-pipeline-enhanced.js');
          const pipeline = new FashionDataPipelineEnhanced();
          
          await pipeline.run();
          
          await db.client.rpc('update_pipeline_run_status', {
            p_run_id: runRecord.id,
            p_status: 'completed'
          });
          
          await db.client.rpc('add_pipeline_log', {
            p_run_id: runRecord.id,
            p_level: 'success',
            p_message: 'Enhanced pipeline completed successfully'
          });
        }
        
      } catch (error) {
        await db.client.rpc('update_pipeline_run_status', {
          p_run_id: runRecord.id,
          p_status: 'failed',
          p_error_message: error.message
        });
        
        await db.client.rpc('add_pipeline_log', {
          p_run_id: runRecord.id,
          p_level: 'error',
          p_message: `Enhanced pipeline failed: ${error.message}`
        });
      }
    }, 100);
    
    res.json({ 
      success: true, 
      message: 'Enhanced pipeline started',
      runId: runRecord.id
    });
    
  } catch (error) {
    console.error('Error starting enhanced pipeline:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to optimize image selection for account
function optimizeImageSelection(images, targetCount, profile) {
  if (images.length <= targetCount) {
    return images;
  }
  
  // Simple optimization - could be enhanced with ML
  const optimized = [];
  const aestheticFocus = profile.content_strategy.aestheticFocus || [];
  const colorPalette = profile.content_strategy.colorPalette || [];
  
  // Prioritize images that match account's aesthetic focus
  const priorityImages = images.filter(img => 
    aestheticFocus.includes(img.aesthetic)
  );
  
  // Add priority images first
  optimized.push(...priorityImages.slice(0, Math.min(priorityImages.length, targetCount)));
  
  // Fill remaining slots with other images
  const remainingSlots = targetCount - optimized.length;
  if (remainingSlots > 0) {
    const otherImages = images.filter(img => !optimized.includes(img));
    optimized.push(...otherImages.slice(0, remainingSlots));
  }
  
  return optimized.slice(0, targetCount);
}

// TikTok OAuth Routes
app.get('/api/tiktok/auth-url/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/tiktok/callback`;
    
    const { authUrl, state } = tiktokAPI.generateAuthUrl(username, redirectUri);
    
    // Store state temporarily for verification (in production, use Redis or session)
    const stateData = {
      username,
      timestamp: Date.now(),
      redirectUri
    };
    
    res.json({ 
      authUrl, 
      state,
      username,
      redirectUri 
    });
  } catch (error) {
    logger.error('Failed to generate TikTok auth URL:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/auth/tiktok/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      return res.redirect(`/?error=${encodeURIComponent(error)}&type=tiktok_auth`);
    }
    
    if (!code) {
      return res.redirect('/?error=No authorization code received&type=tiktok_auth');
    }
    
    // Extract username from state (in production, verify state properly)
    const [username] = state.split('_');
    const redirectUri = process.env.TIKTOK_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/tiktok/callback`;
    
    // Exchange code for token
    const credentials = await tiktokAPI.exchangeCodeForToken(code, redirectUri);
    
    // Save credentials to database
    await tiktokAPI.saveAccountCredentials(username, credentials);
    
    logger.info(`✅ TikTok OAuth complete for @${username}`);
    
    res.redirect(`/?success=TikTok account @${username} connected successfully&type=tiktok_auth`);
    
  } catch (error) {
    logger.error('TikTok OAuth callback error:', error);
    res.redirect(`/?error=${encodeURIComponent(error.message)}&type=tiktok_auth`);
  }
});

app.get('/api/accounts/:username/tiktok-status', async (req, res) => {
  try {
    const { username } = req.params;
    const credentials = await tiktokAPI.getAccountCredentials(username);
    
    if (!credentials || !credentials.access_token) {
      return res.json({ 
        connected: false, 
        message: 'Account not connected to TikTok' 
      });
    }
    
    // Check if token is expired
    const isExpired = credentials.expires_at && new Date(credentials.expires_at) < new Date();
    
    res.json({ 
      connected: true,
      expired: isExpired,
      connectedAt: credentials.tiktok_connected_at,
      expiresAt: credentials.expires_at
    });
    
  } catch (error) {
    logger.error('Failed to check TikTok status:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/accounts/:username/tiktok-disconnect', async (req, res) => {
  try {
    const { username } = req.params;
    
    // Clear TikTok credentials from database
    const { error } = await db.client
      .from('account_profiles')
      .update({
        tiktok_access_token: null,
        tiktok_refresh_token: null,
        tiktok_token_expires_at: null,
        tiktok_connected_at: null
      })
      .eq('username', username);

    if (error) {
      throw new Error(`Failed to disconnect account: ${error.message}`);
    }

    logger.info(`🔌 Disconnected TikTok for @${username}`);
    res.json({ message: 'TikTok account disconnected successfully' });
    
  } catch (error) {
    logger.error('Failed to disconnect TikTok account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test carousel upload endpoint
app.post('/api/test-carousel-upload/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    logger.info(`🎯 Testing carousel upload for @${username}...`);
    
    // Check if account is connected
    const credentials = await tiktokAPI.getAccountCredentials(username);
    if (!credentials || !credentials.access_token) {
      return res.status(400).json({ 
        error: 'Account not connected to TikTok. Please connect first.' 
      });
    }
    
    // Create a sample carousel post
    const samplePost = {
      postNumber: 1,
      caption: 'Testing carousel upload! 🚀 This is a sample post with multiple images. Swipe to see more! #test #carousel #tiktok',
      hashtags: ['test', 'carousel', 'tiktok', 'automation', 'fashion'],
      images: [
        {
          id: 'sample1',
          imagePath: 'https://picsum.photos/1080/1920?random=1',
          aesthetic: 'streetwear',
          colors: ['black', 'white'],
          season: 'fall'
        },
        {
          id: 'sample2', 
          imagePath: 'https://picsum.photos/1080/1920?random=2',
          aesthetic: 'minimalist',
          colors: ['beige', 'cream'],
          season: 'spring'
        },
        {
          id: 'sample3',
          imagePath: 'https://picsum.photos/1080/1920?random=3',
          aesthetic: 'vintage',
          colors: ['brown', 'tan'],
          season: 'fall'
        }
      ],
      accountUsername: username
    };
    
    logger.info(`📝 Created sample post with ${samplePost.images.length} images`);
    
    // Upload to TikTok drafts
    const uploadResult = await tiktokAPI.realUploadPost(username, samplePost);
    
    if (uploadResult.success) {
      logger.info(`✅ Carousel upload successful for @${username}`);
      res.json({
        success: true,
        message: 'Carousel uploaded to TikTok drafts successfully!',
        publishId: uploadResult.publishId,
        status: uploadResult.status,
        type: uploadResult.type,
        images: uploadResult.images,
        uploadedAt: uploadResult.uploadedAt,
        caption: uploadResult.caption,
        hashtags: uploadResult.hashtags
      });
    } else {
      logger.error(`❌ Carousel upload failed for @${username}: ${uploadResult.error}`);
      res.status(500).json({ 
        error: `Upload failed: ${uploadResult.error}` 
      });
    }
    
  } catch (error) {
    logger.error('Test carousel upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Complete workflow endpoints
app.post('/api/generate-workflow-content', async (req, res) => {
  try {
    const { accountUsername, postCount, imageCount } = req.body;
    
    logger.info(`🎨 Generating workflow content for @${accountUsername}: ${postCount} posts, ${imageCount} images each`);
    
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
    
    // Generate content using ContentGenerator
    const { ContentGenerator } = await import('../automation/content-generator.js');
    const contentGenerator = new ContentGenerator();
    
    const posts = [];
    const allImages = [];
    
    for (let i = 1; i <= postCount; i++) {
      try {
        const post = await contentGenerator.generateSinglePost(profile, profile, i);
        posts.push(post);
        allImages.push(...post.images);
      } catch (error) {
        logger.error(`Failed to generate post ${i}: ${error.message}`);
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
    
    logger.info(`✅ Generated ${posts.length} posts with ${allImages.length} total images`);
    
    res.json({
      success: true,
      generation,
      posts
    });
    
  } catch (error) {
    logger.error('Workflow content generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/save-workflow-generation', async (req, res) => {
  try {
    const { generation } = req.body;
    
    logger.info(`💾 Saving workflow generation: ${generation.id}`);
    
    // Save to generated_posts table
    const savedPosts = [];
    
    for (const post of generation.posts) {
      const { data: savedPost, error } = await db.client
        .from('generated_posts')
        .insert({
          generation_id: generation.id,
          account_username: generation.accountUsername,
          post_number: post.postNumber,
          caption: post.caption,
          hashtags: post.hashtags,
          images: post.images,
          strategy: post.strategy,
          generated_at: generation.generatedAt,
          status: 'saved'
        })
        .select()
        .single();
      
      if (error) {
        logger.error(`Failed to save post ${post.postNumber}: ${error.message}`);
      } else {
        savedPosts.push(savedPost);
      }
    }
    
    logger.info(`✅ Saved ${savedPosts.length} posts to database`);
    
    res.json({
      success: true,
      savedId: generation.id,
      savedPosts: savedPosts.length
    });
    
  } catch (error) {
    logger.error('Save workflow generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload-workflow-to-tiktok', async (req, res) => {
  try {
    const { accountUsername, posts } = req.body;
    
    logger.info(`📤 Uploading ${posts.length} posts to TikTok for @${accountUsername}`);
    
    // Check if account is connected
    const credentials = await tiktokAPI.getAccountCredentials(accountUsername);
    if (!credentials || !credentials.access_token) {
      return res.status(400).json({ 
        error: 'Account not connected to TikTok. Please connect first.' 
      });
    }
    
    const uploads = [];
    
    for (const post of posts) {
      try {
        const uploadResult = await tiktokAPI.realUploadPost(accountUsername, post);
        
        if (uploadResult.success) {
          uploads.push(uploadResult);
          logger.info(`✅ Uploaded post ${post.postNumber} to TikTok`);
        } else {
          logger.error(`❌ Failed to upload post ${post.postNumber}: ${uploadResult.error}`);
        }
      } catch (error) {
        logger.error(`❌ Error uploading post ${post.postNumber}: ${error.message}`);
      }
    }
    
    logger.info(`✅ Uploaded ${uploads.length}/${posts.length} posts to TikTok`);
    
    res.json({
      success: true,
      uploads,
      totalPosts: posts.length,
      successfulUploads: uploads.length
    });
    
  } catch (error) {
    logger.error('Upload workflow to TikTok error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/tos', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tos.html'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

app.listen(PORT, () => {
  logger.success(`🌐 Web interface running on http://localhost:${PORT}`);
}); 