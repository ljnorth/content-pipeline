import JSZip from 'jszip';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { images, accountUsername, type = 'selected' } = req.body;

  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'No images provided' });
  }

  if (!accountUsername) {
    return res.status(400).json({ error: 'Account username is required' });
  }

  try {
    console.log(`📥 Preparing to download ${images.length} images for @${accountUsername}`);

    // Create a new zip file
    const zip = new JSZip();
    const folder = zip.folder(`${accountUsername}_${type}_${Date.now()}`);

    // Process each image
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      console.log(`📥 Processing image ${i + 1}/${images.length}: ${image.id}`);

      try {
        // The imagePath is already a full URL
        const fullImageUrl = image.imagePath || image.image_path;
        
        // Ensure we have a valid URL
        if (!fullImageUrl || !fullImageUrl.startsWith('http')) {
          console.error(`❌ Invalid image URL for image ${image.id}`);
          continue;
        }

        // Fetch the image
        const response = await fetch(fullImageUrl);
        
        if (!response.ok) {
          console.error(`❌ Failed to fetch image ${image.id}: ${response.status}`);
          continue;
        }

        const imageBuffer = await response.buffer();
        
        // Determine file extension from path or default to jpg
        const extension = image.imagePath.split('.').pop() || 'jpg';
        const fileName = `${i + 1}_${image.aesthetic || 'image'}_${image.id}.${extension}`;

        // Add image to zip
        folder.file(fileName, imageBuffer);
        console.log(`✅ Added ${fileName} to zip`);

      } catch (error) {
        console.error(`❌ Error processing image ${image.id}:`, error.message);
        // Continue with other images even if one fails
      }
    }

    // Generate the zip file
    const zipBuffer = await zip.generateAsync({ 
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    console.log(`✅ Successfully created zip file with ${images.length} images`);

    // Send the zip file
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${accountUsername}_${type}_images_${Date.now()}.zip"`);
    res.status(200).send(zipBuffer);

  } catch (error) {
    console.error('❌ Download error:', error);
    res.status(500).json({ error: error.message });
  }
}