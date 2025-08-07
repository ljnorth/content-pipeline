export default async function handler(req, res) {
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview - @${username} | easypost.fun</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/assets/style.css">
    <style>
        * { box-sizing: border-box; }
        body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
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
        .action-buttons {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin-top: 20px;
            flex-wrap: wrap;
        }
        .action-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 25px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1em;
            font-weight: 600;
            transition: all 0.3s ease;
        }
        .action-btn:hover {
            background: #764ba2;
            transform: translateY(-2px);
        }
        .generate-btn {
            background: #667eea;
        }
        .reroll-btn {
            background: #ff6b35;
        }
        .reroll-btn:hover {
            background: #e85a2b;
        }
        .loading {
            text-align: center;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 60px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .post-container {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        .post-caption {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin-bottom: 30px;
            border-radius: 8px;
            font-size: 1.1em;
            line-height: 1.6;
        }
        .selection-controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            flex-wrap: wrap;
            gap: 15px;
        }
        .selection-info {
            display: flex;
            align-items: center;
            font-weight: 600;
            color: #667eea;
        }
        .selection-buttons {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        .images-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .image-card {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .image-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }
        .image-card img {
            width: 100%;
            height: 300px;
            object-fit: cover;
        }
        .image-info {
            padding: 15px;
            background: #f8f9fa;
        }
        .image-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.9em;
            color: #666;
        }
        .image-checkbox {
            margin-right: 10px;
            transform: scale(1.2);
        }
        .select-btn {
            background: #6c757d;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 0.9em;
            transition: all 0.3s ease;
        }
        .select-btn:hover {
            background: #5a6268;
        }
        .download-btn {
            background: #17a2b8;
        }
        .download-btn:hover {
            background: #138496;
        }
        .download-all-btn {
            background: #28a745;
        }
        .download-all-btn:hover {
            background: #218838;
        }
        .message {
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 20px;
            text-align: center;
            font-weight: 600;
        }
        .success-message {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .error-message {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
    </style>
</head>
<body>
    <header class="nav"><div class="nav-inner">
      <div class="brand"><span class="dot"></span> EasyPost</div>
      <div class="nav-links">
        <a href="/">Home</a>
        <a href="/accounts.html">Accounts</a>
        <a href="/random.html">Random</a>
      </div>
    </div></header>
    <div class="container">
        <div class="header">
            <h1>🎨 Content Preview</h1>
            <p>Generate and preview content for @${username}</p>
            <div class="action-buttons">
                <button class="action-btn generate-btn" onclick="generateNewPost()">
                    🎲 Generate New Post
                </button>
            </div>
        </div>

        <div id="message-container"></div>

        <div id="loading" class="loading" style="display: none;">
            <div class="spinner"></div>
            <h2>Generating content...</h2>
        </div>

        <div id="post-container" style="display: none;">
            <div class="selection-controls">
                <div class="selection-info">
                    <span id="selected-count">0 images selected</span>
                </div>
                <div class="selection-buttons">
                    <button class="select-btn" onclick="selectAllImages()">Select All</button>
                    <button class="select-btn" onclick="deselectAllImages()">Deselect All</button>
                    <button class="select-btn reroll-btn" onclick="rerollSelectedImages()">
                        🔄 Replace Selected
                    </button>
                    <button class="select-btn download-btn" onclick="downloadSelectedImages()">
                        📥 Download Selected
                    </button>
                    <button class="select-btn download-all-btn" onclick="downloadAllImages()">
                        📦 Download All
                    </button>
                </div>
            </div>
            
            <div class="post-container">
                <div id="post-caption" class="post-caption"></div>
                <div id="images-grid" class="images-grid"></div>
            </div>
        </div>
    </div>

    <script>
        // Global state
        let currentPost = null;

        // Generate a new post
        async function generateNewPost() {
            showLoading(true);
            clearMessages();

            try {
                const response = await fetch('/api/generate-preview', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        accountUsername: '${username}',
                        imageCount: 10
                    })
                });

                const result = await response.json();

                if (result.success) {
                    currentPost = result.post;
                    renderPost();
                    showSuccessMessage('✨ New post generated successfully!');
                } else {
                    showErrorMessage('Failed to generate post: ' + (result.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Generate error:', error);
                showErrorMessage('Failed to generate post. Please try again.');
            } finally {
                showLoading(false);
            }
        }

        // Render the current post
        function renderPost() {
            if (!currentPost) return;
            
            document.getElementById('post-container').style.display = 'block';
            document.getElementById('post-caption').textContent = currentPost.caption;
            
            const imagesGrid = document.getElementById('images-grid');
            imagesGrid.innerHTML = '';
            
            currentPost.images.forEach(image => {
                const imageCard = document.createElement('div');
                imageCard.className = 'image-card';
                imageCard.innerHTML = \`
                    <img src="\${image.imagePath || image.image_path}" alt="Fashion image" loading="lazy" />
                    <div class="image-info">
                        <div class="image-meta">
                            <label>
                                <input type="checkbox" class="image-checkbox" value="\${image.id}" onchange="updateSelectedCount()">
                                ID: \${image.id}
                            </label>
                            <span>Aesthetic: \${image.aesthetic || 'N/A'}</span>
                        </div>
                    </div>
                \`;
                imagesGrid.appendChild(imageCard);
            });

            updateSelectedCount();
        }

        // Reroll selected images
        async function rerollSelectedImages() {
            const selectedImageIds = Array.from(document.querySelectorAll('.image-checkbox:checked'))
                .map(cb => parseInt(cb.value));

            if (selectedImageIds.length === 0) {
                showErrorMessage('Please select at least one image to replace.');
                return;
            }

            const allImageIds = currentPost.images.map(img => img.id);
            clearMessages();

            try {
                const response = await fetch('/api/reroll-images-instant', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        imageIds: selectedImageIds,
                        accountUsername: '${username}',
                        existingImageIds: allImageIds
                    })
                });

                const result = await response.json();

                if (result.success) {
                    // Replace the images in the current post
                    let newImageIndex = 0;
                    currentPost.images = currentPost.images.map(img => {
                        if (selectedImageIds.includes(img.id)) {
                            return result.newImages[newImageIndex++];
                        }
                        return img;
                    });

                    // Re-render the post
                    renderPost();
                    showSuccessMessage('✅ Successfully replaced ' + selectedImageIds.length + ' images!');
                } else {
                    showErrorMessage('Failed to replace images: ' + (result.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Reroll error:', error);
                showErrorMessage('Failed to replace images. Please try again.');
            }
        }

        // Download functions
        async function downloadSelectedImages() {
            const selectedImages = getSelectedImages();
            if (selectedImages.length === 0) {
                showErrorMessage('Please select at least one image to download.');
                return;
            }
            downloadImages(selectedImages, 'selected');
        }

        async function downloadAllImages() {
            if (!currentPost || !currentPost.images) {
                showErrorMessage('No images available to download.');
                return;
            }
            downloadImages(currentPost.images, 'all');
        }

        async function downloadImages(images, type) {
            showSuccessMessage('Preparing download of ' + images.length + ' images...');

            try {
                const response = await fetch('/api/download-images', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        images: images,
                        accountUsername: '${username}',
                        type: type
                    })
                });

                if (response.ok) {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = '${username}_' + type + '_images_' + Date.now() + '.zip';
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    showSuccessMessage('✅ Download started!');
                } else {
                    showErrorMessage('Failed to download images. Please try again.');
                }
            } catch (error) {
                console.error('Download error:', error);
                showErrorMessage('Failed to download images. Please try again.');
            }
        }

        function getSelectedImages() {
            const selectedIds = Array.from(document.querySelectorAll('.image-checkbox:checked'))
                .map(cb => parseInt(cb.value));
            return currentPost.images.filter(img => selectedIds.includes(img.id));
        }

        // UI Helper functions
        function showLoading(show) {
            document.getElementById('loading').style.display = show ? 'block' : 'none';
        }

        function selectAllImages() {
            document.querySelectorAll('.image-checkbox').forEach(cb => cb.checked = true);
            updateSelectedCount();
        }

        function deselectAllImages() {
            document.querySelectorAll('.image-checkbox').forEach(cb => cb.checked = false);
            updateSelectedCount();
        }

        function updateSelectedCount() {
            const count = document.querySelectorAll('.image-checkbox:checked').length;
            document.getElementById('selected-count').textContent = count + ' images selected';
        }

        function showSuccessMessage(message) {
            showMessage(message, 'success');
        }

        function showErrorMessage(message) {
            showMessage(message, 'error');
        }

        function showMessage(message, type) {
            const container = document.getElementById('message-container');
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${type}-message\`;
            messageDiv.textContent = message;
            container.innerHTML = '';
            container.appendChild(messageDiv);
            
            setTimeout(() => {
                if (container.contains(messageDiv)) {
                    container.removeChild(messageDiv);
                }
            }, 5000);
        }

        function clearMessages() {
            document.getElementById('message-container').innerHTML = '';
        }

        // Initialize on page load
        window.onload = function() {
            generateNewPost();
        };
    </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}