import { SupabaseClient } from '../src/database/supabase-client.js';

const db = new SupabaseClient();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountUsername, imageCount = 10 } = req.body;

  if (!accountUsername) {
    return res.status(400).json({ error: 'Account username is required' });
  }

  try {
    console.log(`🎨 Generating preview for @${accountUsername} with ${imageCount} images`);

    // Get account profile
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

    // Generate images for the post
    const images = await generateImagesForPost(accountUsername, imageCount, accountAesthetics);

    if (images.length === 0) {
      return res.status(500).json({ error: 'Failed to generate images' });
    }

    console.log(`✅ Generated ${images.length} images for preview`);

    // Generate caption
    const caption = generateCaption(accountProfile, images[0]);

    // Create a temporary post object (not saved to database)
    const post = {
      id: `temp_${Date.now()}`,
      postNumber: 1,
      images: images,
      caption: caption,
      account_username: accountUsername,
      created_at: new Date().toISOString(),
      is_temporary: true
    };

    // Return the generated post
    res.json({
      success: true,
      post: post,
      account: {
        username: accountUsername,
        aesthetics: accountAesthetics
      }
    });

  } catch (error) {
    console.error('❌ Preview generation error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function generateImagesForPost(accountUsername, count, accountAesthetics) {
  console.log(`🎨 Selecting ${count} images...`);

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
    if (matchingImages.length < count) {
      console.log('⚠️ Not enough matching images, using all images');
      matchingImages.push(...allImages);
    }

    // Randomly select images
    const shuffledImages = matchingImages.sort(() => Math.random() - 0.5);
    const selectedImages = shuffledImages.slice(0, count);

    console.log(`✅ Selected ${selectedImages.length} unique images`);

    // Format the images
    return selectedImages.map((img, index) => ({
      id: img.id,
      imagePath: img.image_path,
      aesthetic: img.aesthetic || 'mixed',
      colors: img.colors || ['neutral'],
      season: img.season || 'any',
      occasion: img.occasion || 'casual',
      selection_score: 100 + Math.random() * 50,
      is_cover_slide: index === 0 // First image is cover
    }));

  } catch (error) {
    console.error('❌ Error generating images:', error);
    return [];
  }
}

function generateCaption(accountProfile, coverImage) {
  const aesthetics = accountProfile.content_strategy?.aestheticFocus || ['streetwear'];
  const aesthetic = coverImage?.aesthetic || aesthetics[0];
  
  // Simple caption generation based on aesthetic
  const captions = {
    streetwear: "Street style vibes 🔥 Which fit is your fave?",
    minimalist: "Less is more ✨ Minimalist fashion inspo",
    vintage: "Vintage finds that never go out of style 📸",
    casual: "Effortless everyday looks 💫",
    aesthetic: "Aesthetic fashion moments 🌸"
  };
  
  return captions[aesthetic.toLowerCase()] || "Fashion inspiration for you 💕";
}