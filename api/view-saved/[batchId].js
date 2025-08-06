import { SupabaseClient } from '../../src/database/supabase-client.js';

export default async function handler(req, res) {
  const { batchId } = req.query;

  if (!batchId) {
    return res.status(400).json({ error: 'Batch ID is required' });
  }

  try {
    const db = new SupabaseClient();
    
    // Fetch the saved batch
    const { data, error } = await db.client
      .from('preview_batches')
      .select('*')
      .eq('preview_id', batchId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const batch = data;
    const post = batch.posts[0]; // Assuming single post per batch
    const username = batch.account_username;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Saved Post - @${username} | easypost.fun</title>
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
        .batch-info {
            background: #28a745;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.9em;
            display: inline-block;
            margin-top: 10px;
        }
        .action-buttons {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin-top: 20px;
            flex-wrap: wrap;
        }
        .action-btn {
            background: #17a2b8;
            color: white;
            border: none;
            padding: 12px 25px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1em;
            font-weight: 600;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
        }
        .action-btn:hover {
            background: #138496;
            transform: translateY(-2px);
        }
        .download-btn {
            background: #28a745;
        }
        .download-btn:hover {
            background: #218838;
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
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📌 Saved Post</h1>
            <p>Viewing saved content for @${username}</p>
            <div class="batch-info">Batch ID: ${batchId}</div>
            <div class="action-buttons">
                <a href="/instant-preview/${username}" class="action-btn">
                    🎨 Create New Post
                </a>
                <button class="action-btn download-btn" onclick="downloadAllImages()">
                    📦 Download All Images
                </button>
            </div>
        </div>

        <div class="post-container">
            <div class="post-caption">${post.caption}</div>
            <div class="images-grid">
                ${post.images.map((img, index) => `
                    <div class="image-container">
                        <img src="${img.imagePath || img.image_path}" 
                             alt="Post image" 
                             class="post-image"
                             onerror="this.style.display='none'">
                        <div class="image-info">
                            ${img.aesthetic || 'Mixed'}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>

    <script>
        const postData = ${JSON.stringify(post)};
        const username = '${username}';

        async function downloadAllImages() {
            try {
                const response = await fetch('/api/download-images', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        images: postData.images,
                        accountUsername: username,
                        type: 'all'
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    alert('Failed to download images: ' + (error.error || 'Unknown error'));
                    return;
                }

                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = \`saved_\${Date.now()}_images.zip\`;
                
                document.body.appendChild(a);
                a.click();
                
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } catch (error) {
                console.error('Download error:', error);
                alert('Failed to download images. Please try again.');
            }
        }
    </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  } catch (error) {
    console.error('Error fetching batch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}