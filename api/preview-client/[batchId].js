export default async function handler(req, res) {
  // Extract batchId from URL path for Vercel dynamic routes
  let batchId;
  try {
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

  // Generate client-side HTML that loads data dynamically
  const html = `
<!DOCTYPE html>
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
                const response = await fetch('/postpreview/${batchId}?format=json');
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
                    <a href="/api/postpreview/download/${batchId}" class="download-btn">
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

            const url = '/api/postpreview/download-selected/${batchId}?imageIds=' + selectedImageIds.join(',');
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
                        batchId: '${batchId}',
                        imageIds: selectedImageIds,
                        accountUsername: currentBatch.accountUsername
                    })
                });

                const result = await response.json();

                if (result.success) {
                    // Update the current posts with new data
                    if (result.updatedPost) {
                        // Find and update the post that was modified
                        const postIndex = currentPosts.findIndex(post => 
                            post.images && post.images.some(img => selectedImageIds.includes(img.id.toString()))
                        );
                        
                        if (postIndex !== -1) {
                            currentPosts[postIndex] = result.updatedPost;
                            renderContent(); // Re-render with updated data
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
                        batchId: '${batchId}',
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
}; 