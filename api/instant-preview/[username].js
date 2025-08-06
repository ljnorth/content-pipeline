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
    <title>Instant Preview - @${username} | easypost.fun</title>
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
        .save-btn {
            background: #28a745;
        }
        .save-btn:hover {
            background: #218838;
        }
        .generate-btn {
            background: #667eea;
        }
        .reroll-btn {
            background: #ff6b35;
        }
        .reroll-btn:hover {
            background: #ff5722;
        }
        .loading {
            text-align: center;
            padding: 50px;
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
        .post-container {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        .post-caption {
            font-size: 1.2em;
            color: #333;
            margin-bottom: 20px;
            padding: 15px;
            background: rgba(103, 126, 234, 0.1);
            border-radius: 10px;
        }
        .images-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .image-container {
            position: relative;
            background: #f8f9fa;
            border-radius: 10px;
            overflow: hidden;
            aspect-ratio: 1;
        }
        .post-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.3s ease;
        }
        .post-image:hover {
            transform: scale(1.05);
        }
        .image-checkbox {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 25px;
            height: 25px;
            cursor: pointer;
            z-index: 10;
        }
        .image-info {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%);
            color: white;
            padding: 15px 10px 10px;
            font-size: 0.85em;
        }
        .selection-controls {
            background: rgba(255, 255, 255, 0.9);
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 15px;
        }
        .selection-info {
            font-size: 1.1em;
            color: #666;
        }
        .selection-buttons {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
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
        .saved-indicator {
            background: #28a745;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.9em;
            display: inline-block;
            margin-left: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎨 Instant Content Preview</h1>
            <p>Generate and preview content for @${username}</p>
            <div class="action-buttons">
                <button class="action-btn generate-btn" onclick="generateNewPost()">
                    🎲 Generate New Post
                </button>
                <button class="action-btn save-btn" onclick="saveCurrentPost()" style="display: none;" id="saveBtn">
                    💾 Save This Post
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
                    <span id="saved-indicator" class="saved-indicator" style="display: none;">✓ Saved</span>
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
        let isSaved = false;

        // Generate a new post
        async function generateNewPost() {
            showLoading(true);
            hideSaveButton();
            clearMessages();
            isSaved = false;
            updateSavedIndicator();

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
                    showSaveButton();
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

            document.getElementById('post-caption').textContent = currentPost.caption;
            
            const imagesGrid = document.getElementById('images-grid');
            imagesGrid.innerHTML = currentPost.images.map((img, index) => \`
                <div class="image-container">
                    <img src="\${img.imagePath}" 
                         alt="Post image" 
                         class="post-image"
                         onerror="this.style.display='none'">
                    <input type="checkbox" 
                           class="image-checkbox" 
                           value="\${img.id}"
                           onchange="updateSelectedCount()">
                    <div class="image-info">
                        \${img.aesthetic || 'Mixed'}
                    </div>
                </div>
            \`).join('');

            document.getElementById('post-container').style.display = 'block';
            updateSelectedCount();
        }

        // Reroll selected images instantly
        async function rerollSelectedImages() {
            const selectedCheckboxes = document.querySelectorAll('.image-checkbox:checked');
            const selectedImageIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value));

            if (selectedImageIds.length === 0) {
                showErrorMessage('Please select at least one image to replace.');
                return;
            }

            clearMessages();
            isSaved = false;
            updateSavedIndicator();

            // Get all current image IDs
            const allImageIds = currentPost.images.map(img => img.id);

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
                    showSuccessMessage(\`✅ Successfully replaced \${selectedImageIds.length} images!\`);
                } else {
                    showErrorMessage('Failed to replace images: ' + (result.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Reroll error:', error);
                showErrorMessage('Failed to replace images. Please try again.');
            }
        }

        // Save the current post
        async function saveCurrentPost() {
            if (!currentPost) {
                showErrorMessage('No post to save.');
                return;
            }

            if (isSaved) {
                showErrorMessage('This post has already been saved.');
                return;
            }

            clearMessages();

            try {
                const response = await fetch('/api/save-post', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        post: currentPost,
                        accountUsername: '${username}'
                    })
                });

                const result = await response.json();

                if (result.success) {
                    isSaved = true;
                    updateSavedIndicator();
                    showSuccessMessage(\`✅ Post saved successfully! Batch ID: \${result.batchId}\`);
                } else {
                    showErrorMessage('Failed to save post: ' + (result.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Save error:', error);
                showErrorMessage('Failed to save post. Please try again.');
            }
        }

        // UI Helper functions
        function showLoading(show) {
            document.getElementById('loading').style.display = show ? 'block' : 'none';
        }

        function showSaveButton() {
            document.getElementById('saveBtn').style.display = 'inline-block';
        }

        function hideSaveButton() {
            document.getElementById('saveBtn').style.display = 'none';
        }

        function updateSavedIndicator() {
            document.getElementById('saved-indicator').style.display = isSaved ? 'inline-block' : 'none';
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
            messageDiv.className = type + '-message message';
            messageDiv.textContent = message;
            container.appendChild(messageDiv);
            
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.remove();
                }
            }, 5000);
        }

        function clearMessages() {
            document.getElementById('message-container').innerHTML = '';
        }

        // Download selected images
        async function downloadSelectedImages() {
            const selectedCheckboxes = document.querySelectorAll('.image-checkbox:checked');
            const selectedImages = Array.from(selectedCheckboxes).map(cb => {
                const imageId = parseInt(cb.value);
                return currentPost.images.find(img => img.id === imageId);
            }).filter(img => img);

            if (selectedImages.length === 0) {
                showErrorMessage('Please select at least one image to download.');
                return;
            }

            await downloadImages(selectedImages, 'selected');
        }

        // Download all images
        async function downloadAllImages() {
            if (!currentPost || !currentPost.images || currentPost.images.length === 0) {
                showErrorMessage('No images to download.');
                return;
            }

            await downloadImages(currentPost.images, 'all');
        }

        // Common download function
        async function downloadImages(images, type) {
            clearMessages();
            showSuccessMessage(\`Preparing download of \${images.length} images...\`);

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

                if (!response.ok) {
                    const error = await response.json();
                    showErrorMessage('Failed to download images: ' + (error.error || 'Unknown error'));
                    return;
                }

                // Get the blob from the response
                const blob = await response.blob();
                
                // Create a download link
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = \`\${type}_images_\${Date.now()}.zip\`;
                
                // Trigger download
                document.body.appendChild(a);
                a.click();
                
                // Cleanup
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                showSuccessMessage(\`✅ Successfully downloaded \${images.length} images!\`);
            } catch (error) {
                console.error('Download error:', error);
                showErrorMessage('Failed to download images. Please try again.');
            }
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