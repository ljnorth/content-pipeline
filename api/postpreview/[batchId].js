const { SupabaseClient } = require('../../src/database/supabase-client.js');

const db = new SupabaseClient();

module.exports = async function handler(req, res) {
  // Extract batchId from URL path for Vercel dynamic routes
  let batchId;
  try {
    // For Vercel, we need to parse the URL manually
    const urlParts = req.url.split('/');
    batchId = urlParts[urlParts.length - 1];
    
    // Remove query parameters if present
    if (batchId.includes('?')) {
      batchId = batchId.split('?')[0];
    }
  } catch (error) {
    console.error('Error extracting batchId:', error);
    batchId = null;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!batchId) {
    res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invalid Preview - easypost.fun</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          h1 { color: #e74c3c; }
        </style>
      </head>
      <body>
        <h1>🔍 Invalid Preview URL</h1>
        <p>No batch ID provided in the URL.</p>
        <p>Please check the link and try again.</p>
      </body>
      </html>
    `);
    return;
  }

  try {
    // Get batch data from database
    const { data: batch, error } = await db.client
      .from('preview_batches')
      .select('*')
      .eq('preview_id', batchId)
      .single();

    if (error || !batch) {
      res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Preview Not Found - easypost.fun</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #e74c3c; }
          </style>
        </head>
        <body>
          <h1>🔍 Preview Not Found</h1>
          <p>The preview for batch ID "${batchId}" could not be found.</p>
          <p>It may have expired or the link is incorrect.</p>
        </body>
        </html>
      `);
      return;
    }

    const posts = batch.posts || [];
    const totalImages = posts.reduce((sum, post) => sum + (post.images?.length || 0), 0);

    // Generate HTML preview page
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Content Preview - @${batch.account_username} | easypost.fun</title>
    
    <!-- Favicon -->
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    
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
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
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
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎨 Content Preview</h1>
            <p>Generated content for @${batch.account_username}</p>
            <div class="stats">
                <div class="stat">
                    <h3>${posts.length}</h3>
                    <p>Posts</p>
                </div>
                <div class="stat">
                    <h3>${totalImages}</h3>
                    <p>Images</p>
                </div>
                <div class="stat">
                    <h3>${new Date(batch.created_at).toLocaleDateString()}</h3>
                    <p>Generated</p>
                </div>
            </div>
        </div>

        <div class="posts-grid">
            ${posts.map((post, index) => `
                <div class="post-card" id="post${post.postNumber || (index + 1)}">
                    <div class="post-header">
                        <div class="post-number">Post ${post.postNumber || (index + 1)}</div>
                        <div class="post-aesthetic">${post.images?.[0]?.aesthetic || 'Mixed'}</div>
                    </div>
                    
                    <div class="post-caption">
                        ${post.caption || 'No caption provided'}
                    </div>
                    
                    ${post.images && post.images.length > 0 ? `
                        <div class="post-images">
                            ${post.images.map(img => `
                                <div class="image-container">
                                    <img src="${img.imagePath || img.image_path || '#'}" 
                                         alt="Post image" 
                                         class="post-image"
                                         onerror="this.style.display='none'">
                                    <input type="checkbox" class="image-checkbox" value="${img.id}">
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p style="color: #999; font-style: italic;">No images available</p>'}
                    
                    ${post.hashtags && post.hashtags.length > 0 ? `
                        <div class="post-hashtags">
                            ${post.hashtags.map(tag => `<span class="hashtag">${tag}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>

        <div class="selection-controls">
            <div class="selection-info">
                <span id="selected-count">0 images selected</span>
            </div>
            <div class="selection-buttons">
                <button class="select-btn" onclick="selectAllImages()">Select All</button>
                <button class="select-btn" onclick="deselectAllImages()">Deselect All</button>
                <button class="select-btn" onclick="downloadSelectedImages()">Download Selected</button>
                <button class="select-btn reroll-btn" onclick="rerollSelectedImages()" style="background: #28a745; border-color: #28a745;">
                    🔄 Replace Selected Images
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
            <a href="/api/postpreview/download/${batchId}" class="download-btn">
                Download All Posts
            </a>
        </div>
    </div>

    <div class="footer">
        <p>Content Pipeline • Generated on ${new Date(batch.created_at).toLocaleString()}</p>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const imageCheckboxes = document.querySelectorAll('.image-checkbox');
            const selectedCountSpan = document.getElementById('selected-count');

            function updateSelectedCount() {
                const selected = document.querySelectorAll('.image-checkbox:checked').length;
                selectedCountSpan.textContent = selected + ' image' + (selected === 1 ? '' : 's') + ' selected';
            }

            function selectAllImages() {
                imageCheckboxes.forEach(checkbox => checkbox.checked = true);
                updateSelectedCount();
            }

            function deselectAllImages() {
                imageCheckboxes.forEach(checkbox => checkbox.checked = false);
                updateSelectedCount();
            }

            function downloadSelectedImages() {
                const selectedImageIds = Array.from(document.querySelectorAll('.image-checkbox:checked'))
                    .map(checkbox => checkbox.value);

                if (selectedImageIds.length === 0) {
                    alert('Please select at least one image to download.');
                    return;
                }

                const url = '/api/postpreview/download-selected/${batchId}?imageIds=' + selectedImageIds.join(',');
                window.location.href = url;
            }

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
                rerollStatus.style.display = 'flex';
                rerollBtn.disabled = true;
                rerollBtn.textContent = '🔄 Replacing...';

                try {
                    const response = await fetch('/api/reroll-images', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            batchId: '${batchId}',
                            imageIds: selectedImageIds,
                            accountUsername: '${batch.account_username}'
                        })
                    });

                    const result = await response.json();

                    if (result.success) {
                        // Show success message
                        alert('✅ Successfully replaced ' + selectedImageIds.length + ' images!');
                        // Reload the page to show new images
                        location.reload();
                    } else {
                        alert('❌ Failed to replace images: ' + (result.error || 'Unknown error'));
                    }
                } catch (error) {
                    console.error('Reroll error:', error);
                    alert('❌ Failed to replace images. Please try again.');
                } finally {
                    // Hide loading state
                    rerollStatus.style.display = 'none';
                    rerollBtn.disabled = false;
                    rerollBtn.textContent = '🔄 Replace Selected Images';
                }
            }

            imageCheckboxes.forEach(checkbox => {
                checkbox.addEventListener('change', updateSelectedCount);
            });

            updateSelectedCount(); // Initial count
        });
    </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);

  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Preview Error - easypost.fun</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          h1 { color: #e74c3c; }
        </style>
      </head>
      <body>
        <h1>⚠️ Preview Error</h1>
        <p>An error occurred while loading the preview.</p>
        <p>Please try again later.</p>
      </body>
      </html>
    `);
  }
}; 