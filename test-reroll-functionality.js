import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testRerollFunctionality() {
  console.log('🧪 Testing Reroll Functionality...\n');

  try {
    // Get the latest batch
    const { data: batches, error: batchError } = await supabase
      .from('preview_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (batchError || !batches || batches.length === 0) {
      console.error('❌ No batches found');
      return;
    }

    const batch = batches[0];
    console.log(`📋 Testing with batch: ${batch.preview_id}`);
    console.log(`👤 Account: ${batch.account_username}`);
    console.log(`📸 Original Images: ${batch.posts[0].images.length}`);

    // Show original images
    console.log('\n📸 Original Images:');
    batch.posts[0].images.forEach((img, i) => {
      console.log(`   ${i + 1}. ${img.aesthetic} (ID: ${img.id})`);
    });

    // Select first 2 images to reroll
    const imagesToReroll = batch.posts[0].images.slice(0, 2).map(img => img.id);
    console.log(`\n🔄 Will reroll images: ${imagesToReroll.join(', ')}`);

    // Get account profile
    const { data: accountProfile, error: profileError } = await supabase
      .from('account_profiles')
      .select('*')
      .eq('username', batch.account_username)
      .single();

    if (profileError || !accountProfile) {
      console.error('❌ Account profile not found');
      return;
    }

    const accountAesthetics = accountProfile.content_strategy?.aestheticFocus || ['streetwear', 'casual', 'aesthetic'];
    console.log(`🎯 Account aesthetics: ${accountAesthetics.join(', ')}`);

    // Generate replacement images
    const newImages = await generateReplacementImages(batch.account_username, imagesToReroll.length, batch.posts[0], accountAesthetics);

    if (newImages.length === 0) {
      console.error('❌ Failed to generate replacement images');
      return;
    }

    console.log(`✅ Generated ${newImages.length} replacement images:`);
    newImages.forEach((img, i) => {
      console.log(`   ${i + 1}. ${img.aesthetic} (ID: ${img.id})`);
    });

    // Replace images in post
    const updatedPost = replaceImagesInPost(batch.posts[0], imagesToReroll, newImages);

    console.log('\n📸 Updated Images:');
    updatedPost.images.forEach((img, i) => {
      const isReplaced = imagesToReroll.includes(img.id);
      const marker = isReplaced ? '🔄 REPLACED' : '';
      console.log(`   ${i + 1}. ${img.aesthetic} (ID: ${img.id}) ${marker}`);
    });

    console.log('\n✅ Reroll functionality test successful!');
    console.log('📊 Summary:');
    console.log(`   - Original images: ${batch.posts[0].images.length}`);
    console.log(`   - Images replaced: ${imagesToReroll.length}`);
    console.log(`   - New images generated: ${newImages.length}`);
    console.log(`   - Updated post has: ${updatedPost.images.length} images`);

  } catch (error) {
    console.error('❌ Test error:', error);
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
      const { data: pageImages, error: pageError } = await supabase
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

testRerollFunctionality(); 