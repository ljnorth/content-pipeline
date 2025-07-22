import { SupabaseClient } from '../../src/database/supabase-client.js';

const db = new SupabaseClient();

export default async function handler(req, res) {
  const { batchId } = req.query;

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Get batch data from database
    const { data: batch, error } = await db.client
      .from('preview_batches')
      .select('*')
      .eq('batch_id', batchId)
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

    const posts = batch.posts_data;
    const totalImages = batch.total_images;

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
            background: rgba(118, 75, 162, 0.1);
            padding: 15px 25px;
            border-radius: 10px;
            text-align: center;
        }
        .stat-number {
            font-size: 2em;
            font-weight: bold;
            color: #764ba2;
        }
        .stat-label {
            color: #666;
            font-size: 0.9em;
        }
        .download-section {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 25px;
            margin-bottom: 30px;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        .download-btn {
            display: inline-block;
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 10px;
            font-weight: bold;
            font-size: 1.1em;
            margin: 10px;
            transition: transform 0.3s ease;
        }
        .download-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        }
        .posts-grid {
            display: grid;
            gap: 30px;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
        }
        .post-card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s ease;
        }
        .post-card:hover {
            transform: translateY(-5px);
        }
        .post-header {
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white;
            padding: 20px;
            text-align: center;
        }
        .post-number {
            font-size: 1.5em;
            font-weight: bold;
        }
        .post-meta {
            font-size: 0.9em;
            opacity: 0.9;
            margin-top: 5px;
        }
        .images-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 10px;
            padding: 20px;
        }
        .image-container {
            position: relative;
            aspect-ratio: 1;
            border-radius: 10px;
            overflow: hidden;
            background: #f0f0f0;
        }
        .image-container img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.3s ease;
        }
        .image-container:hover img {
            transform: scale(1.05);
        }
        .aesthetic-badge {
            position: absolute;
            top: 5px;
            right: 5px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 2px 6px;
            border-radius: 5px;
            font-size: 0.7em;
        }
        .caption-section {
            padding: 20px;
        }
        .caption {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 15px;
            font-style: italic;
            line-height: 1.5;
        }
        .hashtags {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
        }
        .hashtag {
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 0.8em;
            text-decoration: none;
        }
        .footer {
            text-align: center;
            margin-top: 50px;
            color: rgba(255, 255, 255, 0.8);
        }
        @media (max-width: 768px) {
            .container { padding: 10px; }
            .header h1 { font-size: 2em; }
            .stats { gap: 15px; }
            .posts-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎨 Content Preview</h1>
            <p>Generated content for <strong>@${batch.account_username}</strong></p>
            <div class="stats">
                <div class="stat">
                    <div class="stat-number">${posts.length}</div>
                    <div class="stat-label">Posts</div>
                </div>
                <div class="stat">
                    <div class="stat-number">${totalImages}</div>
                    <div class="stat-label">Images</div>
                </div>
                <div class="stat">
                    <div class="stat-number">${new Date(batch.created_at).toLocaleDateString()}</div>
                    <div class="stat-label">Created</div>
                </div>
            </div>
        </div>

        <div class="download-section">
            <h3 style="margin-bottom: 15px;">📥 Download Options</h3>
            <a href="/api/postpreview/download/${batchId}" class="download-btn">
                📦 Download All Images & Content
            </a>
        </div>

        <div class="posts-grid">
            ${posts.map(post => `
                <div class="post-card" id="post${post.postNumber}">
                    <div class="post-header">
                        <div class="post-number">Post #${post.postNumber}</div>
                        <div class="post-meta">${post.images?.length || 0} images • ${post.images?.[0]?.aesthetic || 'Mixed'} aesthetic</div>
                    </div>
                    
                    ${post.images?.length ? `
                        <div class="images-grid">
                            ${post.images.map((img, i) => `
                                <div class="image-container">
                                    <img src="${img.imagePath}" alt="Post ${post.postNumber} Image ${i + 1}" 
                                         onerror="this.src='data:image/svg+xml,<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"150\\" height=\\"150\\"><rect width=\\"100%\\" height=\\"100%\\" fill=\\"#f0f0f0\\"/><text x=\\"50%\\" y=\\"50%\\" text-anchor=\\"middle\\" dy=\\".3em\\" fill=\\"#999\\">Image ${i + 1}</text></svg>'">
                                    ${img.aesthetic ? `<div class="aesthetic-badge">${img.aesthetic}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    <div class="caption-section">
                        ${post.caption ? `
                            <div class="caption">${post.caption}</div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="footer">
            <p>✨ Generated by <strong>easypost.fun</strong> Content Pipeline</p>
            <p style="font-size: 0.9em; margin-top: 10px; opacity: 0.7;">
                Batch ID: ${batchId} • Created: ${new Date(batch.created_at).toLocaleString()}
            </p>
        </div>
    </div>

    <script>
        // Add smooth scrolling for anchor links
        if (window.location.hash) {
            setTimeout(() => {
                document.querySelector(window.location.hash)?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
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
        <title>Error - easypost.fun</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          h1 { color: #e74c3c; }
        </style>
      </head>
      <body>
        <h1>⚠️ Preview Error</h1>
        <p>Sorry, there was an error loading this preview.</p>
        <p>Please try again later or contact support.</p>
      </body>
      </html>
    `);
  }
} 