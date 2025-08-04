import { SupabaseClient } from '../src/database/supabase-client.js';

const db = new SupabaseClient();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { batchId, imageIds, accountUsername } = req.body;

  if (!batchId || !imageIds || !accountUsername) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    console.log(`🔄 Rerolling ${imageIds.length} images for batch ${batchId}`);

    // Step 1: Load existing post
    const { data: batch, error: batchError } = await db.client
      .from('preview_batches')
      .select('*')
      .eq('preview_id', batchId)
      .single();

    if (batchError || !batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    console.log(`✅ Found existing batch with ${batch.posts[0].images.length} images`);

    // Step 2: Get account profile
    const { data: accountProfile, error: profileError } = await db.client
      .from('account_profiles')
      .select('*')
      .eq('username', accountUsername)
      .single();

    if (profileError || !accountProfile) {
      return res.status(404).json({ error: 'Account profile not found' });
    }

    const accountAesthetics = accountProfile.content_strategy?.aestheticFocus || ['streetwear', 'casual', 'aesthetic'];
    console.log(`🎯 Account aesthetics: ${accountAesthetics.join(', ')}`);

    // Step 3: Generate new images for selected slots
    const newImages = await generateReplacementImages(accountUsername, imageIds.length, batch.posts[0], accountAesthetics);

    if (newImages.length === 0) {
      return res.status(500).json({ error: 'Failed to generate replacement images' });
    }

    console.log(`✅ Generated ${newImages.length} replacement images`);

    // Step 4: Replace selected images in the post
    const updatedPost = replaceImagesInPost(batch.posts[0], imageIds, newImages);

    // Step 5: Update database
    const { error: updateError } = await db.client
      .from('preview_batches')
      .update({
        posts: [updatedPost]
      })
      .eq('preview_id', batchId);

    if (updateError) {
      console.error('❌ Failed to update batch:', updateError);
      return res.status(500).json({ error: 'Failed to update batch' });
    }

    console.log('✅ Successfully updated batch with new images');

    // Step 6: Return updated post data
    res.json({
      success: true,
      updatedPost,
      rerollCount: 1, // Default to 1 since we don't have tracking yet
      replacedImageIds: imageIds,
      newImageIds: newImages.map(img => img.id)
    });

  } catch (error) {
    console.error('❌ Reroll error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function generateReplacementImages(accountUsername, count, existingPost, accountAesthetics) {
  console.log(`🎨 Generating ${count} replacement images...`);

  try {
    // Get ALL images using pagination
    let allImages = [];
    let from = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: pageImages, error: pageError } = await db.client
        .from('images')
        .select('*')
        .range(from, from + pageSize - 1);
      
      if (pageError || !pageImages || pageImages.length === 0) {
        break;
      }
      
      allImages = allImages.concat(pageImages);
      from += pageSize;
      
      if (pageImages.length < pageSize) {
        break;
      }
    }

    console.log(`📸 Found ${allImages.length} total images`);

    // Filter by account aesthetics
    const matchingImages = allImages.filter(img => {
      if (!img.aesthetic) return false;
      
      const imgAesthetic = img.aesthetic.toLowerCase();
      return accountAesthetics.some(targetAesthetic => 
        imgAesthetic.includes(targetAesthetic.toLowerCase()) ||
        targetAesthetic.toLowerCase().includes(imgAesthetic)
      );
    });

    console.log(`✅ Found ${matchingImages.length} images matching account aesthetics`);

    // If we don't have enough matching images, use all images
    if (matchingImages.length < count * 2) {
      console.log('⚠️ Not enough matching images, using all images');
      matchingImages.push(...allImages);
    }

    // Get existing image IDs to avoid duplicates
    const existingImageIds = existingPost.images.map(img => img.id);
    console.log(`🚫 Excluding ${existingImageIds.length} existing image IDs`);

    // Filter out existing images and randomly select new ones
    const availableImages = matchingImages.filter(img => !existingImageIds.includes(img.id));
    const shuffledImages = availableImages.sort(() => Math.random() - 0.5);
    const selectedImages = shuffledImages.slice(0, count);

    console.log(`✅ Selected ${selectedImages.length} unique replacement images`);

    // Format the new images
    return selectedImages.map(img => ({
      id: img.id,
      imagePath: img.image_path,
      aesthetic: img.aesthetic || 'mixed',
      colors: img.colors || ['neutral'],
      season: img.season || 'any',
      occasion: img.occasion || 'casual',
      selection_score: 100 + Math.random() * 50,
      is_cover_slide: false
    }));

  } catch (error) {
    console.error('❌ Error generating replacement images:', error);
    return [];
  }
}

function replaceImagesInPost(post, imageIdsToReplace, newImages) {
  console.log(`🔄 Replacing ${imageIdsToReplace.length} images in post...`);

  const updatedImages = [...post.images];
  let newImageIndex = 0;

  // Replace selected images with new ones
  for (let i = 0; i < updatedImages.length; i++) {
    if (imageIdsToReplace.includes(updatedImages[i].id)) {
      if (newImageIndex < newImages.length) {
        console.log(`🔄 Replacing image ${updatedImages[i].id} with ${newImages[newImageIndex].id}`);
        updatedImages[i] = newImages[newImageIndex];
        newImageIndex++;
      }
    }
  }

  return {
    ...post,
    images: updatedImages,
    rerolledAt: new Date().toISOString(),
    rerollCount: (post.rerollCount || 0) + 1
  };
} 