import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { SupabaseClient } from '../database/supabase-client.js';
// import { FashionDataPipeline } from '../pipeline/fashion-pipeline.js';
import { TikTokAPI } from '../automation/tiktok-api.js';
import { Logger } from '../utils/logger.js';

// Serve static HTML UI
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const logger = new Logger();

// Initialize database with error handling
let db = null;
let tiktokAPI = null;

try {
  db = new SupabaseClient();
  tiktokAPI = new TikTokAPI();
  logger.success('✅ Database and TikTok API initialized successfully');
} catch (error) {
  logger.error('❌ Failed to initialize database or TikTok API:', error.message);
  logger.info('💡 This is normal if environment variables are not set up yet');
}
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));
// Redirect managed.html to canonical static page to avoid duplicates
app.get('/managed.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/managed.html'));
});

// API routes
app.get('/api/preview-data/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const { data: batch, error } = await db.client
      .from('preview_batches')
      .select('*')
      .eq('preview_id', batchId)
      .single();

    if (error || !batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    res.json({
      success: true,
      batch: {
        id: batch.preview_id,
        accountUsername: batch.account_username,
        createdAt: batch.created_at,
        posts: batch.posts || []
      }
    });
  } catch (error) {
    console.error('Preview data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/preview-client/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    
    // Generate client-side HTML that loads data dynamically
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Content Preview - Loading... | easypost.fun</title>
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 20px; 
        }
        .loading {
            text-align: center;
            padding: 100px 20px;
            color: white;
        }
        .spinner {
            width: 50px;
            height: 50px;
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-top: 4px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .error {
            text-align: center;
            padding: 100px 20px;
            color: white;
        }
        .error h1 { color: #ff6b6b; margin-bottom: 20px; }
        .header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 30px;
            margin-bottom: 30px;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        .header h1 { 
            color: #764ba2; 
            margin-bottom: 10px; 
            font-size: 2.5em;
        }
        .header p { 
            color: #666; 
            font-size: 1.1em;
        }
        .stats {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin-top: 20px;
            flex-wrap: wrap;
        }
        .stat {
            background: rgba(255, 255, 255, 0.9);
            padding: 15px 25px;
            border-radius: 10px;
            text-align: center;
            min-width: 120px;
        }
        .stat h3 { 
            color: #764ba2; 
            font-size: 1.5em; 
            margin-bottom: 5px; 
        }
        .stat p { 
            color: #666; 
            font-size: 0.9em; 
        }
        .posts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 30px;
            margin-top: 30px;
        }
        .post-card {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
        }
        .post-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #f0f0f0;
        }
        .post-number {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 8px 15px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 0.9em;
        }
        .post-aesthetic {
            background: #f8f9fa;
            color: #666;
            padding: 5px 12px;
            border-radius: 15px;
            font-size: 0.8em;
        }
        .post-caption {
            margin-bottom: 20px;
            line-height: 1.6;
            color: #333;
        }
        .post-images {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        .image-container {
            position: relative;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s ease;
        }
        .image-container:hover {
            transform: scale(1.05);
        }
        .post-image {
            width: 100%;
            height: auto;
            max-height: 400px;
            object-fit: contain;
            border-radius: 10px;
            display: block;
        }
        .image-checkbox {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 20px;
            height: 20px;
            background: rgba(255, 255, 255, 0.9);
            border: 2px solid #667eea;
            border-radius: 4px;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.3s ease;
            z-index: 10;
        }
        .image-container:hover .image-checkbox {
            opacity: 1;
        }
        .image-checkbox:checked {
            background: #667eea;
            color: white;
            opacity: 1 !important;
        }
        .image-checkbox:checked::after {
            content: '✓';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 12px;
            font-weight: bold;
        }
        .selection-controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding: 15px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
        }
        .selection-info {
            color: white;
            font-size: 0.9em;
        }
        .selection-buttons {
            display: flex;
            gap: 10px;
        }
        .select-btn {
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.3);
            padding: 8px 15px;
            border-radius: 20px;
            cursor: pointer;
            font-size: 0.8em;
            transition: all 0.3s ease;
        }
        .select-btn:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        .select-btn.active {
            background: #667eea;
            border-color: #667eea;
        }
        .post-hashtags {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 15px;
        }
        .hashtag {
            background: #e9ecef;
            color: #495057;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 0.8em;
        }
        .reroll-status {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin: 20px 0;
            padding: 15px;
            background: rgba(40, 167, 69, 0.1);
            border: 1px solid rgba(40, 167, 69, 0.3);
            border-radius: 10px;
            color: #28a745;
        }
        .spinner {
            width: 20px;
            height: 20px;
            border: 2px solid #28a745;
            border-top: 2px solid transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        .download-section {
            text-align: center;
            margin-top: 40px;
            padding: 30px;
            background: rgba(255, 255, 255, 0.9);
            border-radius: 15px;
        }
        .download-btn {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 15px 30px;
            border: none;
            border-radius: 25px;
            font-size: 1.1em;
            font-weight: bold;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            transition: transform 0.2s;
        }
        .download-btn:hover {
            transform: translateY(-2px);
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding: 20px;
            color: rgba(255, 255, 255, 0.8);
            font-size: 0.9em;
        }
        .reroll-content-btn {
            background: linear-gradient(135deg, #667eea, #764ba2);
            border: none;
            color: white;
            font-weight: bold;
            font-size: 1.1em;
            padding: 15px 30px;
            border-radius: 25px;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            transition: all 0.3s ease;
        }
        .reroll-btn {
            background: #ff6b35;
            border-color: #ff6b35;
            font-weight: bold;
            font-size: 1.2em;
            padding: 15px 25px;
            box-shadow: 0 4px 15px rgba(255, 107, 53, 0.4);
        }
        .success-message {
            background: rgba(40, 167, 69, 0.1);
            border: 1px solid rgba(40, 167, 69, 0.3);
            color: #28a745;
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            text-align: center;
        }
        .error-message {
            background: rgba(220, 53, 69, 0.1);
            border: 1px solid rgba(220, 53, 69, 0.3);
            color: #dc3545;
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div id="loading" class="loading">
            <div class="spinner"></div>
            <h2>Loading preview...</h2>
            <p>Fetching content data...</p>
        </div>

        <div id="error" class="error" style="display: none;">
            <h1>⚠️ Error Loading Preview</h1>
            <p id="error-message">An error occurred while loading the preview.</p>
            <button onclick="location.reload()" style="background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-top: 20px;">
                Try Again
            </button>
        </div>

        <div id="content" style="display: none;">
            <!-- Content will be dynamically loaded here -->
        </div>
    </div>

    <script>
        // Global state
        let currentBatch = null;
        let currentPosts = [];

        // Load batch data from API
        async function loadBatchData() {
            try {
                const response = await fetch('/api/preview-data/\${batchId}');
                const data = await response.json();

                if (data.success && data.batch) {
                    currentBatch = data.batch;
                    currentPosts = data.batch.posts;
                    renderContent();
                } else {
                    throw new Error(data.error || 'Failed to load batch data');
                }
            } catch (error) {
                console.error('Error loading batch data:', error);
                showError(error.message);
            }
        }

        // Render the content
        function renderContent() {
            const contentDiv = document.getElementById('content');
            const loadingDiv = document.getElementById('loading');
            
            if (!currentBatch || !currentPosts.length) {
                showError('No content available');
                return;
            }

            const totalImages = currentPosts.reduce((sum, post) => sum + (post.images?.length || 0), 0);

            contentDiv.innerHTML = \`
                <div class="header">
                    <h1>🎨 Content Preview</h1>
                    <p>Generated content for @\${currentBatch.accountUsername}</p>
                    <div class="stats">
                        <div class="stat">
                            <h3>\${currentPosts.length}</h3>
                            <p>Posts</p>
                        </div>
                        <div class="stat">
                            <h3>\${totalImages}</h3>
                            <p>Images</p>
                        </div>
                        <div class="stat">
                            <h3>\${new Date(currentBatch.createdAt).toLocaleDateString()}</h3>
                            <p>Generated</p>
                        </div>
                    </div>
                    <div class="reroll-content-section">
                        <button class="reroll-content-btn" onclick="rerollAllContent()">
                            🎲 Reroll Content
                        </button>
                    </div>
                </div>

                <div class="posts-grid">
                    \${currentPosts.map((post, index) => \`
                        <div class="post-card" id="post\${post.postNumber || (index + 1)}">
                            <div class="post-header">
                                <div class="post-number">Post \${post.postNumber || (index + 1)}</div>
                                <div class="post-aesthetic">\${post.images?.[0]?.aesthetic || 'Mixed'}</div>
                            </div>
                            
                            <div class="post-caption">
                                \${post.caption || 'No caption provided'}
                            </div>
                            
                            \${post.images && post.images.length > 0 ? \`
                                <div class="post-images">
                                    \${post.images.map(img => \`
                                        <div class="image-container">
                                            <img src="\${img.imagePath || img.image_path || '#'}?cb=\${Date.now()}" 
                                                 alt="Post image" 
                                                 class="post-image"
                                                 onerror="this.style.display='none'">
                                            <input type="checkbox" class="image-checkbox" value="\${img.id}">
                                        </div>
                                    \`).join('')}
                                </div>
                            \` : '<p style="color: #999; font-style: italic;">No images available</p>'}
                            
                            \${post.hashtags && post.hashtags.length > 0 ? \`
                                <div class="post-hashtags">
                                    \${post.hashtags.map(tag => \`<span class="hashtag">\${tag}</span>\`).join('')}
                                </div>
                            \` : ''}
                        </div>
                    \`).join('')}
                </div>

                <div class="selection-controls">
                    <div class="selection-info">
                        <span id="selected-count">0 images selected</span>
                    </div>
                    <div class="selection-buttons">
                        <button class="select-btn" onclick="selectAllImages()">Select All</button>
                        <button class="select-btn" onclick="deselectAllImages()">Deselect All</button>
                        <button class="select-btn" onclick="downloadSelectedImages()">Download Selected</button>
                        <button class="select-btn reroll-btn" onclick="rerollSelectedImages()">
                            🚨 REROLL SELECTED IMAGES NOW
                        </button>
                    </div>
                </div>
                
                <div id="reroll-status" class="reroll-status" style="display: none;">
                    <div class="spinner"></div>
                    <span>🔄 Generating new images...</span>
                </div>

                <div class="download-section">
                    <h2>📥 Download All Content</h2>
                    <p>Get all posts and images in a single ZIP file</p>
                    <a href="/api/postpreview/download/\${batchId}" class="download-btn">
                        Download All Posts
                    </a>
                </div>
            \`;

            loadingDiv.style.display = 'none';
            contentDiv.style.display = 'block';
            
            // Initialize event listeners
            initializeEventListeners();
        }

        // Initialize event listeners
        function initializeEventListeners() {
            const imageCheckboxes = document.querySelectorAll('.image-checkbox');
            
            imageCheckboxes.forEach(checkbox => {
                checkbox.addEventListener('change', updateSelectedCount);
            });

            updateSelectedCount();
        }

        // Show error message
        function showError(message) {
            const loadingDiv = document.getElementById('loading');
            const errorDiv = document.getElementById('error');
            const errorMessage = document.getElementById('error-message');
            
            loadingDiv.style.display = 'none';
            errorDiv.style.display = 'block';
            errorMessage.textContent = message;
        }

        // Update selected count
        function updateSelectedCount() {
            const selected = document.querySelectorAll('.image-checkbox:checked').length;
            const selectedCountSpan = document.getElementById('selected-count');
            if (selectedCountSpan) {
                selectedCountSpan.textContent = selected + ' image' + (selected === 1 ? '' : 's') + ' selected';
            }
        }

        // Select all images
        function selectAllImages() {
            const imageCheckboxes = document.querySelectorAll('.image-checkbox');
            imageCheckboxes.forEach(checkbox => checkbox.checked = true);
            updateSelectedCount();
        }

        // Deselect all images
        function deselectAllImages() {
            const imageCheckboxes = document.querySelectorAll('.image-checkbox');
            imageCheckboxes.forEach(checkbox => checkbox.checked = false);
            updateSelectedCount();
        }

        // Download selected images
        function downloadSelectedImages() {
            const selectedImageIds = Array.from(document.querySelectorAll('.image-checkbox:checked'))
                .map(checkbox => checkbox.value);

            if (selectedImageIds.length === 0) {
                alert('Please select at least one image to download.');
                return;
            }

            const url = '/api/postpreview/download-selected/\${batchId}?imageIds=' + selectedImageIds.join(',');
            window.location.href = url;
        }

        // Reroll selected images with real-time updates
        async function rerollSelectedImages() {
            const selectedImageIds = Array.from(document.querySelectorAll('.image-checkbox:checked'))
                .map(checkbox => checkbox.value);

            if (selectedImageIds.length === 0) {
                alert('Please select at least one image to replace.');
                return;
            }

            // Show loading state
            const rerollStatus = document.getElementById('reroll-status');
            const rerollBtn = document.querySelector('.reroll-btn');
            if (rerollStatus) rerollStatus.style.display = 'flex';
            if (rerollBtn) {
                rerollBtn.disabled = true;
                rerollBtn.textContent = '🔄 Replacing...';
            }

            try {
                const response = await fetch('/api/reroll-images', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        batchId: '\${batchId}',
                        imageIds: selectedImageIds,
                        accountUsername: currentBatch.accountUsername
                    })
                });

                const result = await response.json();

                if (result.success) {
                    // Update the current posts with new data
                    if (result.updatedPost) {
                        // Since the images have been replaced, we should update the entire post
                        // Find the post that contains any of the new image IDs
                        const postIndex = currentPosts.findIndex(post => 
                            post.images && post.images.some(img => 
                                result.newImageIds && result.newImageIds.includes(img.id)
                            )
                        );
                        
                        if (postIndex !== -1) {
                            // Update with the new post data
                            currentPosts[postIndex] = result.updatedPost;
                            renderContent(); // Re-render with updated data
                        } else {
                            // If we can't find the post by new image IDs, just reload the data
                            console.log('🔄 Reloading batch data to get fresh content...');
                            await loadBatchData();
                        }
                    }
                    
                    showSuccessMessage('✅ Successfully replaced ' + selectedImageIds.length + ' images!');
                } else {
                    showErrorMessage('❌ Failed to replace images: ' + (result.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Reroll error:', error);
                showErrorMessage('❌ Failed to replace images. Please try again.');
            } finally {
                // Hide loading state
                if (rerollStatus) rerollStatus.style.display = 'none';
                if (rerollBtn) {
                    rerollBtn.disabled = false;
                    rerollBtn.textContent = '🚨 REROLL SELECTED IMAGES NOW';
                }
            }
        }

        // Reroll all content
        async function rerollAllContent() {
            const allImageIds = Array.from(document.querySelectorAll('.image-checkbox'))
                .map(checkbox => checkbox.value);

            if (allImageIds.length === 0) {
                alert('No images found to reroll.');
                return;
            }

            // Show loading state
            const rerollContentBtn = document.querySelector('.reroll-content-btn');
            if (rerollContentBtn) {
                rerollContentBtn.disabled = true;
                rerollContentBtn.textContent = '🔄 Rerolling All Content...';
            }

            try {
                const response = await fetch('/api/reroll-images', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        batchId: '\${batchId}',
                        imageIds: allImageIds,
                        accountUsername: currentBatch.accountUsername
                    })
                });

                const result = await response.json();

                if (result.success) {
                    // Reload the entire batch data to get fresh content
                    await loadBatchData();
                    showSuccessMessage('✅ Successfully rerolled all content!');
                } else {
                    showErrorMessage('❌ Failed to reroll content: ' + (result.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Reroll all content error:', error);
                showErrorMessage('❌ Failed to reroll content. Please try again.');
            } finally {
                // Hide loading state
                if (rerollContentBtn) {
                    rerollContentBtn.disabled = false;
                    rerollContentBtn.textContent = '🎲 Reroll Content';
                }
            }
        }

        // Show success message
        function showSuccessMessage(message) {
            const existingMessage = document.querySelector('.success-message');
            if (existingMessage) existingMessage.remove();
            
            const messageDiv = document.createElement('div');
            messageDiv.className = 'success-message';
            messageDiv.textContent = message;
            
            const contentDiv = document.getElementById('content');
            contentDiv.insertBefore(messageDiv, contentDiv.firstChild);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.remove();
                }
            }, 5000);
        }

        // Show error message
        function showErrorMessage(message) {
            const existingMessage = document.querySelector('.error-message');
            if (existingMessage) existingMessage.remove();
            
            const messageDiv = document.createElement('div');
            messageDiv.className = 'error-message';
            messageDiv.textContent = message;
            
            const contentDiv = document.getElementById('content');
            contentDiv.insertBefore(messageDiv, contentDiv.firstChild);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.remove();
                }
            }, 5000);
        }

        // Initialize when DOM is ready
        document.addEventListener('DOMContentLoaded', function() {
            loadBatchData();
        });
    </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  } catch (error) {
    console.error('Preview client error:', error);
    res.status(500).send('Error loading preview');
  }
});

app.get('/api/accounts', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not available. Please check your environment configuration.' });
    }
    const accounts = await db.getAllAccounts();
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/accounts', async (req, res) => {
  const { username, url, gender } = req.body;
  if (!username) return res.status(400).json({ error: 'username is required' });
  try {
    const base = { username: username.toLowerCase(), url: url || `https://www.tiktok.com/@${username}` };
    // Merge gender into tags array if provided
    if (gender === 'men' || gender === 'women') {
      base.tags = [gender];
    }
    await db.upsertAccount(base);
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
      // Import the pipeline dynamically to avoid startup issues
      const { FashionDataPipelineEnhanced } = await import('../content/pipelines/enhanced.js');
      const pipeline = new FashionDataPipelineEnhanced();
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
    if (!db) {
      return res.json({
        totalPosts: 0,
        totalImages: 0,
        activeAccounts: 0,
        avgEngagement: 0,
        message: 'Database not available - showing placeholder data'
      });
    }
    
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
    if (!db) {
      return res.json({
        labels: ['2024-01-01', '2024-01-02', '2024-01-03'],
        values: [0.05, 0.06, 0.04],
        message: 'Database not available - showing placeholder data'
      });
    }
    
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
      image_path: img.image_path, // Include both formats
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

// --- Influencer Preview & Try-On ---
const INFLUENCER_API_BASE = process.env.INFLUENCER_API_BASE || '';
function requireInfluencerApi(res){
  if (!INFLUENCER_API_BASE){
    logger.error('Influencer API base not configured (INFLUENCER_API_BASE)');
    res.status(503).json({ error: 'Influencer API unavailable. Set INFLUENCER_API_BASE in environment.' });
    return false;
  }
  return true;
}

app.post('/api/influencer/preview-still', async (req, res) => {
  try {
    if (!requireInfluencerApi(res)) return;
    const { username, persona, garmentUrl } = req.body || {};
    if (!username) return res.status(400).json({ error: 'username is required' });
    const t0 = Date.now();
    const r = await fetch(`${INFLUENCER_API_BASE}/preview-still`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, persona, garmentUrl })
    });
    const j = await r.json().catch(()=>({ error: 'invalid json from influencer api' }));
    const ms = Date.now() - t0;
    if (!r.ok){ logger.error(`[influencer] preview-still failed`, { username, status: r.status, latencyMs: ms, error: j.error }); return res.status(r.status).json(j); }
    logger.success(`[influencer] preview-still ok`, { username, latencyMs: ms });
    return res.json(j);
  } catch (e) { logger.error('[influencer] preview-still exception', e); res.status(500).json({ error: e.message }); }
});

app.post('/api/influencer/train', async (req, res) => {
  try {
    if (!requireInfluencerApi(res)) return;
    const { username, persona } = req.body || {};
    if (!username) return res.status(400).json({ error: 'username is required' });
    const t0 = Date.now();
    const r = await fetch(`${INFLUENCER_API_BASE}/train`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username, persona }) });
    const j = await r.json().catch(()=>({ error: 'invalid json from influencer api' }));
    const ms = Date.now() - t0;
    if (!r.ok){ logger.error(`[influencer] train failed`, { username, status: r.status, latencyMs: ms, error: j.error }); return res.status(r.status).json(j); }
    logger.success(`[influencer] train ok`, { username, latencyMs: ms, jobId: j.job_id || j.jobId });
    return res.json(j);
  } catch (e) { logger.error('[influencer] train exception', e); res.status(500).json({ error: e.message }); }
});

app.get('/api/influencer/status', async (req, res) => {
  try {
    if (!requireInfluencerApi(res)) return;
    const { job_id } = req.query;
    if (!job_id) return res.status(400).json({ error: 'job_id required' });
    const t0 = Date.now();
    const r = await fetch(`${INFLUENCER_API_BASE}/status?job_id=${encodeURIComponent(job_id)}`);
    const j = await r.json().catch(()=>({ error: 'invalid json from influencer api' }));
    const ms = Date.now() - t0;
    if (!r.ok){ logger.error(`[influencer] status failed`, { job_id, status: r.status, latencyMs: ms, error: j.error }); return res.status(r.status).json(j); }
    logger.info(`[influencer] status`, { job_id, latencyMs: ms, state: j.status || j.stage || j.state });
    return res.json(j);
  } catch (e) { logger.error('[influencer] status exception', e); res.status(500).json({ error: e.message }); }
});

app.post('/api/influencer/tryon-video', async (req, res) => {
  try {
    if (!requireInfluencerApi(res)) return;
    const { username, garmentUrl } = req.body || {};
    if (!username) return res.status(400).json({ error: 'username is required' });
    const t0 = Date.now();
    const r = await fetch(`${INFLUENCER_API_BASE}/video`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username, garmentUrl }) });
    const j = await r.json().catch(()=>({ error: 'invalid json from influencer api' }));
    const ms = Date.now() - t0;
    if (!r.ok){ logger.error(`[influencer] tryon-video failed`, { username, status: r.status, latencyMs: ms, error: j.error }); return res.status(r.status).json(j); }
    logger.success(`[influencer] tryon-video queued`, { username, latencyMs: ms, generationId: j.generation_id || j.generationId });
    return res.json(j);
  } catch (e) { logger.error('[influencer] tryon-video exception', e); res.status(500).json({ error: e.message }); }
});

// Run full influencer pipeline and deliver to Slack (no TikTok)
app.post('/api/influencer/run-full-to-slack', async (req, res) => {
  try {
    if (!requireInfluencerApi(res)) return;
    const { username, moodboardCount = 5, outputs } = req.body || {};
    if (!username) return res.status(400).json({ error: 'username is required' });

    // Load persona from account profile (prefer influencer_traits)
    let persona = null;
    try {
      const { data: profile } = await db.client
        .from('account_profiles')
        .select('influencer_traits, content_strategy')
        .eq('username', username)
        .eq('is_active', true)
        .single();
      persona = profile?.influencer_traits || profile?.content_strategy?.influencerPersona || null;
    } catch(_) {}

    // Fetch moodboards from generator-based content pipeline (anchor-driven, no fallbacks)
    const CP = process.env.CONTENT_PIPELINE_API_BASE;
    if (!CP) return res.status(500).json({ error: 'CONTENT_PIPELINE_API_BASE not set' });
    const ep = `${CP.replace(/\/$/, '')}/api/content/moodboards-from-generator`;
    const pr = await fetch(ep, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username, count: Math.max(1, Number(moodboardCount)) }) });
    const pj = await pr.json().catch(()=>({}));
    if (!pr.ok) return res.status(pr.status).json({ error: pj.error || 'content pipeline failed' });
    let moodboards = [];
    if (Array.isArray(pj.moodboards)) moodboards = pj.moodboards.map(m => (typeof m === 'string' ? m : (m.image_url||m.url))).filter(Boolean);
    if (!moodboards.length && Array.isArray(pj.posts)) {
      for (const post of pj.posts) {
        const imgs = post.images || post.image_urls || [];
        for (const u of imgs) { if (moodboards.length < moodboardCount) moodboards.push(u); }
        if (moodboards.length >= moodboardCount) break;
      }
    }
    if (!moodboards.length) return res.status(404).json({ error: 'No moodboards returned by content pipeline' });

    const t0 = Date.now();
    const r = await fetch(`${INFLUENCER_API_BASE}/run-full-to-slack`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ username, persona, moodboards, outputs })
    });
    const j = await r.json().catch(()=>({ error: 'invalid json from influencer api' }));
    const ms = Date.now() - t0;
    if (!r.ok){ logger.error(`[influencer] run-full-to-slack failed`, { username, status: r.status, latencyMs: ms, error: j.error }); return res.status(r.status).json(j); }
    logger.success(`[influencer] run-full-to-slack queued`, { username, latencyMs: ms, jobId: j.job_id || j.jobId, slackThread: j.slack?.thread_ts });
    return res.json({ success: true, ...j });
  } catch (e) { logger.error('[influencer] run-full-to-slack exception', e); res.status(500).json({ error: e.message }); }
});
app.get('/api/influencer/video-status', async (req, res) => {
  try {
    if (!requireInfluencerApi(res)) return;
    const { generation_id } = req.query;
    if (!generation_id) return res.status(400).json({ error: 'generation_id required' });
    const t0 = Date.now();
    const r = await fetch(`${INFLUENCER_API_BASE}/video-status?generation_id=${encodeURIComponent(generation_id)}`);
    const j = await r.json().catch(()=>({ error: 'invalid json from influencer api' }));
    const ms = Date.now() - t0;
    if (!r.ok){ logger.error(`[influencer] video-status failed`, { generation_id, status: r.status, latencyMs: ms, error: j.error }); return res.status(r.status).json(j); }
    logger.info(`[influencer] video-status`, { generation_id, latencyMs: ms, state: j.status || j.stage || j.state });
    return res.json(j);
  } catch (e) { logger.error('[influencer] video-status exception', e); res.status(500).json({ error: e.message }); }
});

// Character builder proxies
app.post('/api/character/prompt', async (req, res) => {
  try {
    if (!requireInfluencerApi(res)) return;
    const t0 = Date.now();
    const r = await fetch(`${INFLUENCER_API_BASE}/character/prompt`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(req.body||{}) });
    const j = await r.json().catch(()=>({ error:'invalid json' }));
    const ms = Date.now() - t0; logger.info(`[influencer] character/prompt ${r.status} ${ms}ms`);
    res.status(r.status).json(j);
  } catch (e) { logger.error('character/prompt failed', e); res.status(500).json({ error: e.message }); }
});

app.post('/api/character/build', async (req, res) => {
  try {
    if (!requireInfluencerApi(res)) return;
    const t0 = Date.now();
    const r = await fetch(`${INFLUENCER_API_BASE}/character/build`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(req.body||{}) });
    const j = await r.json().catch(()=>({ error:'invalid json' }));
    const ms = Date.now() - t0; logger.info(`[influencer] character/build ${r.status} ${ms}ms`);
    res.status(r.status).json(j);
  } catch (e) { logger.error('character/build failed', e); res.status(500).json({ error: e.message }); }
});

app.get('/api/character/build-status', async (req, res) => {
  try {
    if (!requireInfluencerApi(res)) return;
    const t0 = Date.now();
    const qs = new URLSearchParams({ job_id: String(req.query.job_id||'') }).toString();
    const r = await fetch(`${INFLUENCER_API_BASE}/character/build-status?${qs}`);
    const j = await r.json().catch(()=>({ error:'invalid json' }));
    const ms = Date.now() - t0; logger.info(`[influencer] character/build-status ${r.status} ${ms}ms`);
    res.status(r.status).json(j);
  } catch (e) { logger.error('character/build-status failed', e); res.status(500).json({ error: e.message }); }
});

app.post('/api/still', async (req, res) => {
  try {
    if (!requireInfluencerApi(res)) return;
    const t0 = Date.now();
    const r = await fetch(`${INFLUENCER_API_BASE}/still`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(req.body||{}) });
    const j = await r.json().catch(()=>({ error:'invalid json' }));
    const ms = Date.now() - t0; logger.info(`[influencer] still ${r.status} ${ms}ms`);
    res.status(r.status).json(j);
  } catch (e) { logger.error('still failed', e); res.status(500).json({ error: e.message }); }
});

app.post('/api/video-from-stills', async (req, res) => {
  try {
    if (!requireInfluencerApi(res)) return;
    const t0 = Date.now();
    const r = await fetch(`${INFLUENCER_API_BASE}/video-from-stills`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(req.body||{}) });
    const j = await r.json().catch(()=>({ error:'invalid json' }));
    const ms = Date.now() - t0; logger.info(`[influencer] video-from-stills ${r.status} ${ms}ms`);
    res.status(r.status).json(j);
  } catch (e) { logger.error('video-from-stills failed', e); res.status(500).json({ error: e.message }); }
});

// Get moodboards for an account from generator-based content pipeline (anchor-driven, no fallbacks)
app.post('/api/content/moodboards', async (req, res) => {
  try {
    const { username, count = 5 } = req.body || {};
    if (!username) return res.status(400).json({ error: 'username is required' });
    const CP = process.env.CONTENT_PIPELINE_API_BASE;
    if (!CP) return res.status(500).json({ error: 'CONTENT_PIPELINE_API_BASE not set' });
    const ep = `${CP.replace(/\/$/, '')}/api/content/moodboards-from-generator`;
    const r = await fetch(ep, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username, count: Math.max(1, Number(count)) }) });
    const j = await r.json().catch(()=>({}));
    if (!r.ok) return res.status(r.status).json({ error: j.error || 'content pipeline failed' });
    let moodboards = [];
    if (Array.isArray(j.moodboards)) moodboards = j.moodboards.map(m => (typeof m === 'string' ? m : (m.image_url||m.url))).filter(Boolean);
    if (!moodboards.length && Array.isArray(j.posts)) {
      for (const post of j.posts) {
        const imgs = post.images || post.image_urls || [];
        for (const u of imgs) { if (moodboards.length < count) moodboards.push(u); }
        if (moodboards.length >= count) break;
      }
    }
    if (!moodboards.length) return res.status(404).json({ error: 'No moodboards returned by content pipeline' });
    res.json({ success: true, moodboards, count: moodboards.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
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
    if (!db) {
      return res.json({
        success: true,
        stats: {
          totalHookSlides: 0,
          availableThemes: 0
        },
        themes: [],
        message: 'Database not available - showing placeholder data'
      });
    }
    
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
    if (!db) {
      return res.json({
        success: true,
        themes: [],
        message: 'Database not available - showing placeholder data'
      });
    }
    
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

app.get('/api/account-profiles', async (req, res) => {
  try {
    if (!db) {
      return res.json([]);
    }
    
    const { data: profiles, error } = await db.client
      .from('account_profiles')
      .select('*')
      .eq('is_active', true);
    
    if (error) {
      throw error;
    }
    
    res.json(profiles || []);
  } catch (error) {
    console.error('Error fetching account profiles:', error);
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
    
    // Generate real content using ContentGenerator
    const { ContentGenerator } = await import('../automation/content-generator.js');
    const contentGenerator = new ContentGenerator();
    
    // Get account profile
    const { data: profile, error: profileError } = await db.client
      .from('account_profiles')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single();
    
    if (profileError || !profile) {
      return res.status(404).json({ error: 'Account profile not found or not active' });
    }
    
    // Generate a real post
    const realPost = await contentGenerator.generateSinglePost(profile, profile, 1);
    
    logger.info(`📝 Generated real post with ${realPost.images.length} images`);
    
    // Upload to TikTok drafts
    const uploadResult = await tiktokAPI.realUploadPost(username, realPost);
    
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

// Reroll API endpoint
app.post('/api/reroll-images', async (req, res) => {
  try {
    const { batchId, imageIds, accountUsername } = req.body;

    if (!batchId || !imageIds || !accountUsername) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    logger.info(`🔄 Rerolling ${imageIds.length} images for batch ${batchId}`);

    // Step 1: Load existing post
    const { data: batch, error: batchError } = await db.client
      .from('preview_batches')
      .select('*')
      .eq('preview_id', batchId)
      .single();

    if (batchError || !batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    logger.info(`✅ Found existing batch with ${batch.posts[0].images.length} images`);

    // Step 2: Get account profile
    const { data: accountProfile, error: profileError } = await db.client
      .from('account_profiles')
      .select('*')
      .eq('username', accountUsername)
      .single();

    if (profileError || !accountProfile) {
      return res.status(404).json({ error: 'Account profile not found' });
    }

    const accountAesthetics = accountProfile.content_strategy?.aestheticFocus || ['streetwear', 'casual', 'aesthetic'];
    logger.info(`🎯 Account aesthetics: ${accountAesthetics.join(', ')}`);

    // Step 3: Generate new images for selected slots
    const newImages = await generateReplacementImages(accountUsername, imageIds.length, batch.posts[0], accountAesthetics);

    if (newImages.length === 0) {
      return res.status(500).json({ error: 'Failed to generate replacement images' });
    }

    logger.info(`✅ Generated ${newImages.length} replacement images`);

    // Step 4: Replace selected images in the post
    const updatedPost = replaceImagesInPost(batch.posts[0], imageIds, newImages);

    // Step 5: Update database
    const { error: updateError } = await db.client
      .from('preview_batches')
      .update({
        posts: [updatedPost]
      })
      .eq('preview_id', batchId);

    if (updateError) {
      logger.error('❌ Failed to update batch:', updateError);
      return res.status(500).json({ error: 'Failed to update batch' });
    }

    logger.info('✅ Successfully updated batch with new images');

    // Step 6: Return updated post data
    res.json({
      success: true,
      updatedPost,
      rerollCount: 1, // Default to 1 since we don't have tracking yet
      replacedImageIds: imageIds,
      newImageIds: newImages.map(img => img.id)
    });

  } catch (error) {
    logger.error('❌ Reroll error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper functions for reroll API
async function generateReplacementImages(accountUsername, count, existingPost, accountAesthetics) {
  logger.info(`🎨 Generating ${count} replacement images...`);

  try {
    // Get ALL images using pagination
    let allImages = [];
    let from = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: pageImages, error: pageError } = await db.client
        .from('images')
        .select('*')
        .range(from, from + pageSize - 1);
      
      if (pageError || !pageImages || pageImages.length === 0) {
        break;
      }
      
      allImages = allImages.concat(pageImages);
      from += pageSize;
      
      if (pageImages.length < pageSize) {
        break;
      }
    }

    logger.info(`📸 Found ${allImages.length} total images`);

    // Filter by account aesthetics
    const matchingImages = allImages.filter(img => {
      if (!img.aesthetic) return false;
      
      const imgAesthetic = img.aesthetic.toLowerCase();
      return accountAesthetics.some(targetAesthetic => 
        imgAesthetic.includes(targetAesthetic.toLowerCase()) ||
        targetAesthetic.toLowerCase().includes(imgAesthetic)
      );
    });

    logger.info(`✅ Found ${matchingImages.length} images matching account aesthetics`);

    // If we don't have enough matching images, use all images
    if (matchingImages.length < count * 2) {
      logger.info('⚠️ Not enough matching images, using all images');
      matchingImages.push(...allImages);
    }

    // Get existing image IDs to avoid duplicates
    const existingImageIds = existingPost.images.map(img => img.id);
    logger.info(`🚫 Excluding ${existingImageIds.length} existing image IDs`);

    // Filter out existing images and randomly select new ones
    const availableImages = matchingImages.filter(img => !existingImageIds.includes(img.id));
    const shuffledImages = availableImages.sort(() => Math.random() - 0.5);
    const selectedImages = shuffledImages.slice(0, count);

    logger.info(`✅ Selected ${selectedImages.length} unique replacement images`);

    // Format the new images
    return selectedImages.map(img => ({
      id: img.id,
      imagePath: img.image_path,
      image_path: img.image_path, // Include both formats
      aesthetic: img.aesthetic || 'mixed',
      colors: img.colors || ['neutral'],
      season: img.season || 'any',
      occasion: img.occasion || 'casual',
      selection_score: 100 + Math.random() * 50,
      is_cover_slide: false
    }));

  } catch (error) {
    logger.error('❌ Error generating replacement images:', error);
    return [];
  }
}

function replaceImagesInPost(post, imageIdsToReplace, newImages) {
  logger.info(`🔄 Replacing ${imageIdsToReplace.length} images in post...`);

  const updatedImages = [...post.images];
  let newImageIndex = 0;

  // Replace selected images with new ones
  for (let i = 0; i < updatedImages.length; i++) {
    if (imageIdsToReplace.includes(updatedImages[i].id)) {
      if (newImageIndex < newImages.length) {
        logger.info(`🔄 Replacing image ${updatedImages[i].id} with ${newImages[newImageIndex].id}`);
        updatedImages[i] = newImages[newImageIndex];
        newImageIndex++;
      }
    }
  }

  return {
    ...post,
    images: updatedImages,
    rerolledAt: new Date().toISOString(),
    rerollCount: (post.rerollCount || 0) + 1
  };
}

// Helper function for instant preview image generation
async function generateImagesForPreview(accountUsername, count, accountAesthetics) {
  logger.info(`🎨 Selecting ${count} images for preview...`);

  try {
    // Get ALL images using pagination
    let allImages = [];
    let from = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: pageImages, error: pageError } = await db.client
        .from('images')
        .select('*')
        .range(from, from + pageSize - 1);
      
      if (pageError || !pageImages || pageImages.length === 0) {
        break;
      }
      
      allImages = allImages.concat(pageImages);
      from += pageSize;
      
      if (pageImages.length < pageSize) {
        break;
      }
    }

    logger.info(`📸 Found ${allImages.length} total images`);

    // Filter by account aesthetics
    const matchingImages = allImages.filter(img => {
      if (!img.aesthetic) return false;
      
      const imgAesthetic = img.aesthetic.toLowerCase();
      return accountAesthetics.some(targetAesthetic => 
        imgAesthetic.includes(targetAesthetic.toLowerCase()) ||
        targetAesthetic.toLowerCase().includes(imgAesthetic)
      );
    });

    logger.info(`✅ Found ${matchingImages.length} images matching account aesthetics`);

    // If we don't have enough matching images, use all images
    if (matchingImages.length < count) {
      logger.info('⚠️ Not enough matching images, using all images');
      matchingImages.push(...allImages);
    }

    // Randomly select images
    const shuffledImages = matchingImages.sort(() => Math.random() - 0.5);
    const selectedImages = shuffledImages.slice(0, count);

    logger.info(`✅ Selected ${selectedImages.length} unique images`);

    // Format the images
    return selectedImages.map((img, index) => ({
      id: img.id,
      imagePath: img.image_path,
      image_path: img.image_path, // Include both formats
      image_path: img.image_path, // Include both formats
      aesthetic: img.aesthetic || 'mixed',
      colors: img.colors || ['neutral'],
      season: img.season || 'any',
      occasion: img.occasion || 'casual',
      selection_score: 100 + Math.random() * 50,
      is_cover_slide: index === 0 // First image is cover
    }));

  } catch (error) {
    logger.error('❌ Error generating preview images:', error);
    return [];
  }
}

// Helper function for instant reroll
async function generateInstantReplacementImages(accountUsername, count, existingImageIds, accountAesthetics) {
  logger.info(`🎨 Generating ${count} replacement images...`);

  try {
    // Get ALL images using pagination
    let allImages = [];
    let from = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: pageImages, error: pageError } = await db.client
        .from('images')
        .select('*')
        .range(from, from + pageSize - 1);
      
      if (pageError || !pageImages || pageImages.length === 0) {
        break;
      }
      
      allImages = allImages.concat(pageImages);
      from += pageSize;
      
      if (pageImages.length < pageSize) {
        break;
      }
    }

    logger.info(`📸 Found ${allImages.length} total images`);

    // Filter by account aesthetics
    const matchingImages = allImages.filter(img => {
      if (!img.aesthetic) return false;
      
      const imgAesthetic = img.aesthetic.toLowerCase();
      return accountAesthetics.some(targetAesthetic => 
        imgAesthetic.includes(targetAesthetic.toLowerCase()) ||
        targetAesthetic.toLowerCase().includes(imgAesthetic)
      );
    });

    logger.info(`✅ Found ${matchingImages.length} images matching account aesthetics`);

    // If we don't have enough matching images, use all images
    if (matchingImages.length < count * 2) {
      logger.info('⚠️ Not enough matching images, using all images');
      matchingImages.push(...allImages);
    }

    logger.info(`🚫 Excluding ${existingImageIds.length} existing image IDs`);

    // Filter out existing images and randomly select new ones
    const availableImages = matchingImages.filter(img => !existingImageIds.includes(img.id));
    const shuffledImages = availableImages.sort(() => Math.random() - 0.5);
    const selectedImages = shuffledImages.slice(0, count);

    logger.info(`✅ Selected ${selectedImages.length} unique replacement images`);

    // Format the new images
    return selectedImages.map(img => ({
      id: img.id,
      imagePath: img.image_path,
      image_path: img.image_path, // Include both formats
      aesthetic: img.aesthetic || 'mixed',
      colors: img.colors || ['neutral'],
      season: img.season || 'any',
      occasion: img.occasion || 'casual',
      selection_score: 100 + Math.random() * 50,
      is_cover_slide: false
    }));

  } catch (error) {
    logger.error('❌ Error generating replacement images:', error);
    return [];
  }
}

// Simple caption generator
function generateSimpleCaption(accountProfile, coverImage) {
  const aesthetics = accountProfile.content_strategy?.aestheticFocus || ['streetwear'];
  const aesthetic = coverImage?.aesthetic || aesthetics[0];
  
  // Simple caption generation based on aesthetic
  const captions = {
    streetwear: "Street style vibes 🔥 Which fit is your fave?",
    minimalist: "Less is more ✨ Minimalist fashion inspo",
    vintage: "Vintage finds that never go out of style 📸",
    casual: "Effortless everyday looks 💫",
    aesthetic: "Aesthetic fashion moments 🌸"
  };
  
  return captions[aesthetic.toLowerCase()] || "Fashion inspiration for you 💕";
}

// New instant preview endpoints
app.post('/api/generate-preview', async (req, res) => {
  const { accountUsername, imageCount = 10 } = req.body;

  if (!accountUsername) {
    return res.status(400).json({ error: 'Account username is required' });
  }

  try {
    logger.info(`🎨 Generating preview for @${accountUsername} with ${imageCount} images`);

    // Get account profile
    const { data: accountProfile, error: profileError } = await db.client
      .from('account_profiles')
      .select('*')
      .eq('username', accountUsername)
      .single();

    if (profileError || !accountProfile) {
      return res.status(404).json({ error: 'Account profile not found' });
    }

    const accountAesthetics = accountProfile.content_strategy?.aestheticFocus || ['streetwear', 'casual', 'aesthetic'];
    logger.info(`🎯 Account aesthetics: ${accountAesthetics.join(', ')}`);

    // Generate images for the post
    const images = await generateImagesForPreview(accountUsername, imageCount, accountAesthetics);

    if (images.length === 0) {
      return res.status(500).json({ error: 'Failed to generate images' });
    }

    logger.info(`✅ Generated ${images.length} images for preview`);

    // Generate caption
    const caption = generateSimpleCaption(accountProfile, images[0]);

    // Create a temporary post object (not saved to database)
    const post = {
      id: `temp_${Date.now()}`,
      postNumber: 1,
      images: images,
      caption: caption,
      account_username: accountUsername,
      created_at: new Date().toISOString(),
      is_temporary: true
    };

    // Return the generated post
    res.json({
      success: true,
      post: post,
      account: {
        username: accountUsername,
        aesthetics: accountAesthetics
      }
    });

  } catch (error) {
    logger.error('❌ Preview generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reroll-images-instant', async (req, res) => {
  const { imageIds, accountUsername, existingImageIds } = req.body;

  if (!imageIds || !accountUsername || !existingImageIds) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    logger.info(`🔄 Instantly rerolling ${imageIds.length} images for @${accountUsername}`);

    // Get account profile
    const { data: accountProfile, error: profileError } = await db.client
      .from('account_profiles')
      .select('*')
      .eq('username', accountUsername)
      .single();

    if (profileError || !accountProfile) {
      return res.status(404).json({ error: 'Account profile not found' });
    }

    const accountAesthetics = accountProfile.content_strategy?.aestheticFocus || ['streetwear', 'casual', 'aesthetic'];
    logger.info(`🎯 Account aesthetics: ${accountAesthetics.join(', ')}`);

    // Generate new images, excluding existing ones
    const newImages = await generateInstantReplacementImages(accountUsername, imageIds.length, existingImageIds, accountAesthetics);

    if (newImages.length === 0) {
      return res.status(500).json({ error: 'Failed to generate replacement images' });
    }

    logger.info(`✅ Generated ${newImages.length} replacement images`);

    // Return the new images
    res.json({
      success: true,
      replacedImageIds: imageIds,
      newImages: newImages
    });

  } catch (error) {
    logger.error('❌ Instant reroll error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/save-post', async (req, res) => {
  const { post, accountUsername } = req.body;

  if (!post || !accountUsername) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    logger.info(`💾 Saving post for @${accountUsername}`);

    // Generate a unique batch ID
    const batchId = `saved_${Date.now()}_${accountUsername}`;

    // Create the batch object
    const batch = {
      preview_id: batchId,
      account_username: accountUsername,
      posts: [post],
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // Expires in 7 days
    };

    // Save to database
    const { data, error } = await db.client
      .from('preview_batches')
      .insert(batch)
      .select()
      .single();

    if (error) {
      logger.error('❌ Failed to save post:', error);
      return res.status(500).json({ error: 'Failed to save post' });
    }

    logger.info(`✅ Successfully saved post with ID: ${batchId}`);

    res.json({
      success: true,
      batchId: batchId,
      savedPost: data
    });

  } catch (error) {
    logger.error('❌ Save post error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/download-images', async (req, res) => {
  const { images, accountUsername, type = 'selected' } = req.body;

  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'No images provided' });
  }

  if (!accountUsername) {
    return res.status(400).json({ error: 'Account username is required' });
  }

  try {
    logger.info(`📥 Preparing to download ${images.length} images for @${accountUsername}`);

    // Create a new zip file
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const folder = zip.folder(`${accountUsername}_${type}_${Date.now()}`);

    // Process each image
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      logger.info(`📥 Processing image ${i + 1}/${images.length}: ${image.id}`);

      try {
        // The imagePath is already a full URL
        const fullImageUrl = image.imagePath || image.image_path;
        
        // Ensure we have a valid URL
        if (!fullImageUrl || !fullImageUrl.startsWith('http')) {
          logger.error(`❌ Invalid image URL for image ${image.id}`);
          continue;
        }

        // Fetch the image
        const response = await fetch(fullImageUrl);
        
        if (!response.ok) {
          logger.error(`❌ Failed to fetch image ${image.id}: ${response.status}`);
          continue;
        }

        const imageBuffer = await response.arrayBuffer();
        
        // Determine file extension from path or default to jpg
        const extension = image.imagePath.split('.').pop() || 'jpg';
        const fileName = `${i + 1}_${image.aesthetic || 'image'}_${image.id}.${extension}`;

        // Add image to zip
        folder.file(fileName, Buffer.from(imageBuffer));
        logger.info(`✅ Added ${fileName} to zip`);

      } catch (error) {
        logger.error(`❌ Error processing image ${image.id}:`, error.message);
        // Continue with other images even if one fails
      }
    }

    // Generate the zip file
    const zipBuffer = await zip.generateAsync({ 
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    logger.info(`✅ Successfully created zip file with ${images.length} images`);

    // Send the zip file
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${accountUsername}_${type}_images_${Date.now()}.zip"`);
    res.status(200).send(zipBuffer);

  } catch (error) {
    logger.error('❌ Download error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/preview/:username', async (req, res) => {
  const { username } = req.params;
  
  if (!username) {
    return res.status(400).send('Username is required');
  }

  // Import and execute the handler
  const instantPreviewHandler = (await import('../../api/instant-preview/[username].js')).default;
  instantPreviewHandler({ query: { username } }, res);
});

// Redirect old view-saved links to new preview URL
app.get('/view-saved/:batchId', async (req, res) => {
  const { batchId } = req.params;
  
  if (!batchId) {
    return res.status(400).send('Batch ID is required');
  }

    try {
    const { SupabaseClient } = await import('../database/supabase-client.js');
    const db = new SupabaseClient();
    const { data, error } = await db.client
      .from('preview_batches')
      .select('account_username')
      .eq('preview_id', batchId)
      .single();

    if (error || !data) {
      return res.status(302).redirect('/'); // fallback home
    }
    const username = data.account_username;
    return res.redirect(301, `/preview/${username}?batchId=${batchId}`);
  } catch (err) {
    return res.status(302).redirect('/');
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