// Serverless function for /preview/:username
// Self-contained version that works in Vercel

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  const { username, batchId } = req.query;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  let initialPost = null;
  let initialSaved = false;

  // If batchId provided, load the saved post
  if (batchId) {
    try {
      const { data, error } = await supabase
        .from('preview_batches')
        .select('*')
        .eq('preview_id', batchId)
        .single();
      
      if (!error && data) {
        initialPost = data.posts[0];
        initialSaved = true;
      }
    } catch(err) {
      console.error('Error loading saved post:', err);
    }
  }

  const html = generateHTML(username, initialPost, initialSaved);
  
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}

function generateHTML(username, initialPost, initialSaved) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${initialSaved ? 'Saved Post' : 'Live Preview'} - @${username} | EasyPost</title>
    <style>
        body { font-family: system-ui, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; color: #333; margin: 0; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; color: white; }
        .header h1 { font-size: 2.5rem; margin-bottom: 10px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
        .controls { background: white; border-radius: 12px; padding: 20px; margin-bottom: 30px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); display: flex; gap: 15px; flex-wrap: wrap; align-items: center; }
        .btn { padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s ease; }
        .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .btn-secondary { background: #f8f9fa; color: #495057; border: 2px solid #dee2e6; }
        .btn-success { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; }
        .post-container { background: white; border-radius: 12px; padding: 30px; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1); }
        .images-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
        .image-item { position: relative; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .image-item img { width: 100%; height: 200px; object-fit: cover; }
        .image-controls { position: absolute; top: 10px; right: 10px; background: rgba(255, 255, 255, 0.95); border-radius: 6px; padding: 5px; }
        .loading { text-align: center; padding: 40px; color: #666; }
        .message-container { position: fixed; top: 20px; right: 20px; z-index: 1000; max-width: 400px; }
        .message { padding: 12px 16px; margin-bottom: 10px; border-radius: 8px; font-weight: 500; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .success-message { background: #d1edff; color: #0c5aa6; border-left: 4px solid #28a745; }
        .error-message { background: #f8d7da; color: #721c24; border-left: 4px solid #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${initialSaved ? '📎 Saved Post' : '✨ Live Preview'}</h1>
            <div>@${username}</div>
        </div>

        <div class="controls">
            ${!initialSaved ? `
            <button class="btn btn-primary" onclick="generateNewPost()">🎲 Generate New Post</button>
            <button class="btn btn-secondary" onclick="rerollSelectedImages()" disabled id="rerollBtn">🔄 Replace Selected</button>
            <button class="btn btn-success" onclick="savePost()" id="saveBtn">💾 Save Post</button>
            ` : `
            <a href="/preview/${username}" class="btn btn-primary">✨ Create New Post</a>
            `}
            <button class="btn btn-secondary" onclick="selectAllImages()">✅ Select All</button>
            <button class="btn btn-secondary" onclick="deselectAllImages()">❌ Deselect All</button>
            <button class="btn btn-success" onclick="downloadSelectedImages()">📥 Download Selected</button>
            <button class="btn btn-success" onclick="downloadAllImages()">📥 Download All</button>
            <span id="selected-count">0 images selected</span>
        </div>

        <div id="message-container" class="message-container"></div>

        <div class="post-container">
            <div id="content">
                <div class="loading">Loading preview...</div>
            </div>
        </div>
    </div>

    <script>
        const initialPost = ${JSON.stringify(initialPost)};
        const initialSaved = ${initialSaved};
        let currentPost = null;
        let isSaved = initialSaved;

        window.onload = function() {
            if (initialPost) {
                currentPost = initialPost;
                renderPost();
            } else {
                generateNewPost();
            }
        };

        async function generateNewPost() {
            clearMessages();
            showLoadingState();
            
            try {
                const response = await fetch('/api/generate-preview', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ accountUsername: '${username}', imageCount: 10 })
                });

                if (!response.ok) {
                    const error = await response.json();
                    showErrorMessage('Failed to generate post: ' + (error.error || 'Unknown error'));
                    return;
                }

                const data = await response.json();
                currentPost = data.post;
                isSaved = false;
                renderPost();
                showSuccessMessage('New post generated successfully!');
                
            } catch (error) {
                console.error('Error generating post:', error);
                showErrorMessage('Failed to generate post. Please try again.');
            }
        }

        async function rerollSelectedImages() {
            const selectedCheckboxes = document.querySelectorAll('.image-checkbox:checked');
            const selectedImageIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value));
            
            if (selectedImageIds.length === 0) {
                showErrorMessage('Please select at least one image to replace.');
                return;
            }

            clearMessages();
            showSuccessMessage('Replacing ' + selectedImageIds.length + ' images...');
            
            try {
                const existingImageIds = currentPost.images.map(img => img.id);
                
                const response = await fetch('/api/reroll-images-instant', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        imageIds: selectedImageIds,
                        accountUsername: '${username}',
                        existingImageIds: existingImageIds
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    showErrorMessage('Failed to replace images: ' + (error.error || 'Unknown error'));
                    return;
                }

                const result = await response.json();
                
                result.replacedImageIds.forEach((oldId, index) => {
                    const imageIndex = currentPost.images.findIndex(img => img.id === oldId);
                    if (imageIndex !== -1) {
                        currentPost.images[imageIndex] = result.newImages[index];
                    }
                });

                renderPost();
                showSuccessMessage('Replaced ' + selectedImageIds.length + ' images successfully!');
                
            } catch (error) {
                console.error('Error replacing images:', error);
                showErrorMessage('Failed to replace images. Please try again.');
            }
        }

        async function savePost() {
            if (!currentPost) return;
            clearMessages();
            showSuccessMessage('Saving post...');
            
            try {
                const response = await fetch('/api/save-post', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ post: currentPost, accountUsername: '${username}' })
                });

                if (!response.ok) {
                    const error = await response.json();
                    showErrorMessage('Failed to save post: ' + (error.error || 'Unknown error'));
                    return;
                }

                const result = await response.json();
                isSaved = true;
                
                document.getElementById('saveBtn').style.display = 'none';
                showSuccessMessage('Post saved successfully!');
                
                const newUrl = '/preview/${username}?batchId=' + result.batchId;
                window.history.pushState({}, '', newUrl);
                
            } catch (error) {
                console.error('Error saving post:', error);
                showErrorMessage('Failed to save post. Please try again.');
            }
        }

        function renderPost() {
            if (!currentPost) return;

            const content = document.getElementById('content');
            content.innerHTML = '<div><h3>📝 Caption</h3><div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">' + 
                (currentPost.caption || 'No caption generated') + '</div>' +
                '<h3>📸 Images (' + currentPost.images.length + ')</h3>' +
                '<div class="images-grid">' +
                currentPost.images.map((image, index) => 
                    '<div class="image-item">' +
                    '<img src="' + (image.imagePath || image.image_path) + '" alt="Post image ' + (index + 1) + '">' +
                    '<div class="image-controls">' +
                    '<input type="checkbox" class="image-checkbox" value="' + image.id + '" onchange="updateSelectedCount()">' +
                    '</div></div>'
                ).join('') +
                '</div></div>';
            
            updateSelectedCount();
        }

        function showLoadingState() {
            document.getElementById('content').innerHTML = '<div class="loading">Generating new post...</div>';
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
            const rerollBtn = document.getElementById('rerollBtn');
            if (rerollBtn) rerollBtn.disabled = count === 0;
        }

        function showSuccessMessage(message) { showMessage(message, 'success'); }
        function showErrorMessage(message) { showMessage(message, 'error'); }

        function showMessage(message, type) {
            const container = document.getElementById('message-container');
            const messageDiv = document.createElement('div');
            messageDiv.className = type + '-message message';
            messageDiv.textContent = message;
            container.appendChild(messageDiv);
            setTimeout(() => { if (messageDiv.parentNode) messageDiv.remove(); }, 5000);
        }

        function clearMessages() {
            document.getElementById('message-container').innerHTML = '';
        }

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

        async function downloadAllImages() {
            if (!currentPost || !currentPost.images || currentPost.images.length === 0) {
                showErrorMessage('No images to download.');
                return;
            }
            await downloadImages(currentPost.images, 'all');
        }

        async function downloadImages(images, type) {
            clearMessages();
            showSuccessMessage('Preparing download of ' + images.length + ' images...');

            try {
                const response = await fetch('/api/download-images', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ images: images, accountUsername: '${username}', type: type })
                });

                if (!response.ok) {
                    const error = await response.json();
                    showErrorMessage('Failed to download images: ' + (error.error || 'Unknown error'));
                    return;
                }

                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = type + '_images_${username}_' + Date.now() + '.zip';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                showSuccessMessage('Downloaded ' + images.length + ' images successfully!');
                
            } catch (error) {
                console.error('Error downloading images:', error);
                showErrorMessage('Failed to download images. Please try again.');
            }
        }
    </script>
</body>
</html>`;
}