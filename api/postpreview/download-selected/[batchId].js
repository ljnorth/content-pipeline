const { SupabaseClient } = require('../../../src/database/supabase-client.js');
const JSZip = require('jszip');

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
    res.status(400).json({ error: 'No batch ID provided' });
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
      res.status(404).json({ error: 'Preview batch not found' });
      return;
    }

    const posts = batch.posts || [];
    const selectedImageIds = req.query.imageIds ? req.query.imageIds.split(',') : [];
    
    if (selectedImageIds.length === 0) {
      res.status(400).json({ error: 'No images selected for download' });
      return;
    }

    // Create ZIP file
    const zip = new JSZip();
    
    // Add metadata file
    const metadata = {
      account_username: batch.account_username,
      created_at: batch.created_at,
      selected_images: selectedImageIds.length,
      total_images: posts.reduce((sum, post) => sum + (post.images?.length || 0), 0)
    };
    
    zip.file('metadata.json', JSON.stringify(metadata, null, 2));
    
    // Process each post and find selected images
    let downloadedCount = 0;
    
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const postNumber = post.postNumber || (i + 1);
      const postFolder = `post_${postNumber}`;
      
      // Add post metadata
      const postMetadata = {
        post_number: postNumber,
        caption: post.caption || '',
        hashtags: post.hashtags || [],
        images: post.images?.length || 0,
        aesthetic: post.images?.[0]?.aesthetic || 'Mixed'
      };
      
      zip.file(`${postFolder}/metadata.json`, JSON.stringify(postMetadata, null, 2));
      
      // Add caption text file
      if (post.caption) {
        zip.file(`${postFolder}/caption.txt`, post.caption);
      }
      
      // Add hashtags file
      if (post.hashtags && post.hashtags.length > 0) {
        zip.file(`${postFolder}/hashtags.txt`, post.hashtags.join('\n'));
      }
      
      // Download and add only selected images
      if (post.images && post.images.length > 0) {
        for (let j = 0; j < post.images.length; j++) {
          const image = post.images[j];
          
          // Only include if this image is selected
          if (selectedImageIds.includes(image.id.toString())) {
            const imageUrl = image.imagePath || image.image_path;
            
            if (imageUrl) {
              try {
                // Use built-in fetch (available in Node.js 18+)
                const response = await fetch(imageUrl);
                if (response.ok) {
                  const arrayBuffer = await response.arrayBuffer();
                  const buffer = Buffer.from(arrayBuffer);
                  const extension = imageUrl.split('.').pop() || 'jpg';
                  zip.file(`${postFolder}/selected_image_${j + 1}.${extension}`, buffer);
                  downloadedCount++;
                }
              } catch (error) {
                console.warn(`Failed to download selected image ${j + 1} for post ${postNumber}:`, error.message);
              }
            }
          }
        }
      }
    }
    
    if (downloadedCount === 0) {
      res.status(400).json({ error: 'No selected images could be downloaded' });
      return;
    }
    
    // Generate ZIP file
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="selected-images-${batchId}.zip"`);
    res.setHeader('Content-Length', zipBuffer.length);
    
    // Send the ZIP file
    res.status(200).send(zipBuffer);

  } catch (error) {
    console.error('Download selected error:', error);
    res.status(500).json({ error: 'Failed to generate selected images download' });
  }
}; 