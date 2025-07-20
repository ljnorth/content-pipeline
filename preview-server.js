import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import { EnhancedSlackAPI } from './src/automation/slack-api-enhanced.js';
import archiver from 'archiver';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3004;

app.use(express.json());
app.use(express.static('public'));

// Store batches temporarily (in production, use database)
const batchStorage = new Map();

// Store batch data
app.post('/api/store-batch', (req, res) => {
  const { batchId, accountUsername, posts } = req.body;
  
  batchStorage.set(batchId, {
    batchId,
    accountUsername,
    posts,
    createdAt: new Date().toISOString(),
    totalImages: posts.reduce((sum, post) => sum + post.images.length, 0)
  });
  
  res.json({ success: true });
});

// Get batch data
app.get('/api/batch/:batchId', (req, res) => {
  const batch = batchStorage.get(req.params.batchId);
  if (!batch) {
    return res.status(404).json({ error: 'Batch not found' });
  }
  res.json(batch);
});

// Download all images as ZIP
app.get('/api/download/:batchId', async (req, res) => {
  const batch = batchStorage.get(req.params.batchId);
  if (!batch) {
    return res.status(404).json({ error: 'Batch not found' });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${batch.accountUsername}_${batch.batchId}.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);

  try {
    for (const post of batch.posts) {
      for (let i = 0; i < post.images.length; i++) {
        const image = post.images[i];
        try {
          const response = await fetch(image.imagePath);
          const buffer = await response.buffer();
          const extension = path.extname(image.imagePath) || '.jpg';
          const filename = `post_${post.postNumber}_image_${i + 1}${extension}`;
          archive.append(buffer, { name: filename });
        } catch (error) {
          console.error(`Failed to fetch image: ${image.imagePath}`);
        }
      }
    }

    // Add captions and hashtags as text file
    const contentText = batch.posts.map(post => 
      `POST ${post.postNumber}:\n` +
      `Caption: ${post.caption}\n` +
      `Hashtags: ${post.hashtags.join(' ')}\n` +
      `Images: ${post.images.length}\n` +
      `Aesthetic: ${post.images[0]?.aesthetic || 'Mixed'}\n\n`
    ).join('---\n\n');

    archive.append(contentText, { name: 'captions_and_hashtags.txt' });
    archive.finalize();

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

app.get('/api/download/:batchId/post/:postNumber', async (req, res) => {
  const { batchId, postNumber } = req.params;
  const batch = batchStorage.get(batchId);
  if (!batch) return res.status(404).json({ error: 'Batch not found' });

  const post = batch.posts.find(p => p.postNumber.toString() === postNumber.toString());
  if (!post) return res.status(404).json({ error: 'Post not found' });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${batch.accountUsername}_${batchId}_post_${postNumber}.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);

  try {
    for (let i = 0; i < post.images.length; i++) {
      const image = post.images[i];
      try {
        const response = await fetch(image.imagePath);
        const buffer = await response.buffer();
        const extension = path.extname(image.imagePath) || '.jpg';
        const filename = `post_${postNumber}_image_${i + 1}${extension}`;
        archive.append(buffer, { name: filename });
      } catch (e) {}
    }
    const text = `Caption:\n${post.caption}\n\nHashtags:\n${post.hashtags.join(' ')}`;
    archive.append(text, { name: 'caption_hashtags.txt' });
    archive.finalize();
  } catch (err) {
    console.error('Post download error:', err);
    res.status(500).json({ error: 'Download failed' });
  }
});

// Preview page route
app.get('/preview/:batchId', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Content Preview</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
        <style>
            body {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            .preview-container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
            }
            .header-card {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border-radius: 20px;
                padding: 30px;
                margin-bottom: 30px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            }
            .post-card {
                background: white;
                border-radius: 15px;
                padding: 25px;
                margin-bottom: 25px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                transition: transform 0.2s;
            }
            .post-card:hover {
                transform: translateY(-2px);
            }
            .image-gallery {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                margin: 20px 0;
            }
            .image-item {
                position: relative;
                border-radius: 10px;
                overflow: hidden;
                box-shadow: 0 3px 10px rgba(0,0,0,0.1);
            }
            .image-item img {
                width: 100%;
                height: 250px;
                object-fit: cover;
                transition: transform 0.3s;
            }
            .image-item:hover img {
                transform: scale(1.05);
            }
            .image-overlay {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                background: linear-gradient(transparent, rgba(0,0,0,0.7));
                color: white;
                padding: 10px;
                font-size: 12px;
            }
            .copy-btn {
                background: #28a745;
                border: none;
                color: white;
                padding: 8px 15px;
                border-radius: 20px;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .copy-btn:hover {
                background: #218838;
                transform: translateY(-1px);
            }
            .copy-btn.copied {
                background: #17a2b8;
            }
            .download-section {
                background: #f8f9fa;
                border-radius: 10px;
                padding: 20px;
                margin: 20px 0;
                border-left: 4px solid #007bff;
            }
            .aesthetic-badge {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 5px 12px;
                border-radius: 15px;
                font-size: 12px;
                display: inline-block;
                margin: 5px 5px 5px 0;
            }
            .loading {
                text-align: center;
                padding: 50px;
                color: #666;
            }
            .spinner {
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        </style>
    </head>
    <body>
        <div class="preview-container">
            <div id="loading" class="loading">
                <i class="fas fa-spinner fa-spin fa-2x"></i>
                <p class="mt-3">Loading content preview...</p>
            </div>
            
            <div id="content" style="display: none;">
                <!-- Content will be loaded here -->
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
        <script>
            const batchId = '${req.params.batchId}';
            
            async function loadBatch() {
                try {
                    const response = await fetch(\`/api/batch/\${batchId}\`);
                    const batch = await response.json();
                    
                    if (!response.ok) {
                        throw new Error(batch.error || 'Failed to load batch');
                    }
                    
                    renderBatch(batch);
                } catch (error) {
                    document.getElementById('content').innerHTML = \`
                        <div class="header-card text-center">
                            <h2 class="text-danger">❌ Error</h2>
                            <p>\${error.message}</p>
                            <a href="/" class="btn btn-primary">← Back to Home</a>
                        </div>
                    \`;
                }
                
                document.getElementById('loading').style.display = 'none';
                document.getElementById('content').style.display = 'block';
            }
            
            function renderBatch(batch) {
                const totalImages = batch.posts.reduce((sum, post) => sum + post.images.length, 0);
                const aesthetics = [...new Set(batch.posts.map(post => post.images[0]?.aesthetic).filter(a => a))];
                
                document.getElementById('content').innerHTML = \`
                    <div class="header-card">
                        <div class="row">
                            <div class="col-md-8">
                                <h1 class="mb-3">🎨 Content for @\${batch.accountUsername}</h1>
                                <p class="text-muted mb-3">Generated \${new Date(batch.createdAt).toLocaleString()}</p>
                                <div class="row">
                                    <div class="col-md-3">
                                        <div class="text-center">
                                            <h3 class="text-primary">\${batch.posts.length}</h3>
                                            <small class="text-muted">Posts</small>
                                        </div>
                                    </div>
                                    <div class="col-md-3">
                                        <div class="text-center">
                                            <h3 class="text-success">\${totalImages}</h3>
                                            <small class="text-muted">Images</small>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <strong>Aesthetics:</strong><br>
                                        \${aesthetics.map(a => \`<span class="aesthetic-badge">\${a}</span>\`).join('')}
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4 text-end">
                                <a href="/api/download/\${batch.batchId}" class="btn btn-primary btn-lg mb-2">
                                    <i class="fas fa-download"></i> Download All
                                </a>
                                <br>
                                <small class="text-muted">Images + Captions + Hashtags</small>
                            </div>
                        </div>
                    </div>
                    
                    \${batch.posts.map(post => renderPost(post)).join('')}
                \`;
            }
            
            function renderPost(post) {
                return \`
                    <div class="post-card" id="post\${post.postNumber}">
                        <div class="row">
                            <div class="col-md-8">
                                <h3>📝 Post \${post.postNumber}</h3>
                                
                                <div class="mb-3">
                                    <strong>Caption:</strong>
                                    <div class="p-3 bg-light rounded">
                                        \${post.caption}
                                    </div>
                                    <button class="copy-btn mt-2" onclick="copyText('\${post.caption.replace(/'/g, "\\'")}', this)">
                                        <i class="fas fa-copy"></i> Copy Caption
                                    </button>
                                </div>
                                
                                <div class="mb-3">
                                    <strong>Hashtags:</strong>
                                    <div class="p-3 bg-light rounded">
                                        \${post.hashtags.join(' ')}
                                    </div>
                                    <button class="copy-btn mt-2" onclick="copyText('\${post.hashtags.join(' ')}', this)">
                                        <i class="fas fa-copy"></i> Copy Hashtags
                                    </button>
                                </div>
                                <a href="/api/download/\${batch.batchId}/post/\${post.postNumber}" class="btn btn-primary mt-2">
                                    📥 Download Images
                                </a>
                            </div>
                            <div class="col-md-4">
                                <strong>📊 Post Stats:</strong>
                                <ul class="list-unstyled mt-2">
                                    <li>📸 \${post.images.length} images</li>
                                    <li>🎨 \${post.images[0]?.aesthetic || 'Mixed'}</li>
                                    <li>🏷️ \${post.hashtags.length} hashtags</li>
                                </ul>
                            </div>
                        </div>
                        
                        <div class="image-gallery">
                            \${post.images.map((image, index) => \`
                                <div class="image-item">
                                    <img src="\${image.imagePath}" alt="Post \${post.postNumber} Image \${index + 1}" loading="lazy">
                                    <div class="image-overlay">
                                        <div>\${image.aesthetic || 'No aesthetic'}</div>
                                        <div>\${image.colors ? image.colors.join(', ') : 'No colors'}</div>
                                    </div>
                                </div>
                            \`).join('')}
                        </div>
                    </div>
                \`;
            }
            
            function copyText(text, button) {
                navigator.clipboard.writeText(text).then(() => {
                    const originalText = button.innerHTML;
                    button.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    button.classList.add('copied');
                    
                    setTimeout(() => {
                        button.innerHTML = originalText;
                        button.classList.remove('copied');
                    }, 2000);
                });
            }
            
            // Load the batch when page loads
            loadBatch();
        </script>
    </body>
    </html>
  `);
});

// Home page - list all batches
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Content Preview Home</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
            body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
            .container { max-width: 800px; margin: 50px auto; }
            .card { border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <div class="card-body text-center">
                    <h1>🎨 Content Preview Server</h1>
                    <p class="text-muted">Beautiful previews for generated content</p>
                    <p>Server running on port ${PORT}</p>
                    <p><strong>Usage:</strong> Content gets sent here automatically from Slack integration</p>
                </div>
            </div>
        </div>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🎨 Preview server running on http://localhost:${PORT}`);
  console.log(`📱 Preview URLs: http://localhost:${PORT}/preview/{batchId}`);
  console.log(`📥 Download URLs: http://localhost:${PORT}/api/download/{batchId}`);
});

export { batchStorage }; 