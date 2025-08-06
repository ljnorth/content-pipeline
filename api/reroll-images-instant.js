import { SupabaseClient } from '../src/database/supabase-client.js';
import { Logger } from '../src/utils/logger.js';

const logger = new Logger();
let db = null;

try {
  db = new SupabaseClient();
} catch (error) {
  logger.error('❌ Failed to initialize database:', error.message);
}

// Helper function for instant reroll
async function generateInstantReplacementImages(accountUsername, count, existingImageIds, accountAesthetics) {
  logger.info(`🎨 Generating ${count} replacement images...`);

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

    logger.info(`📸 Found ${allImages.length} total images`);

    // Filter by account aesthetics
    const matchingImages = allImages.filter(img => {
      if (!img.aesthetic) return false;
      
      const imgAesthetic = img.aesthetic.toLowerCase();
      return accountAesthetics.some(targetAesthetic => 
        imgAesthetic.includes(targetAesthetic.toLowerCase()) ||
        targetAesthetic.toLowerCase().includes(imgAesthetic)
      );
    });

    logger.info(`✅ Found ${matchingImages.length} images matching account aesthetics`);

    // If we don't have enough matching images, use all images
    if (matchingImages.length < count * 2) {
      logger.info('⚠️ Not enough matching images, using all images');
      matchingImages.push(...allImages);
    }

    logger.info(`🚫 Excluding ${existingImageIds.length} existing image IDs`);

    // Filter out existing images and randomly select new ones
    const availableImages = matchingImages.filter(img => !existingImageIds.includes(img.id));
    const shuffledImages = availableImages.sort(() => Math.random() - 0.5);
    const selectedImages = shuffledImages.slice(0, count);

    logger.info(`✅ Selected ${selectedImages.length} unique replacement images`);

    // Format the new images
    return selectedImages.map(img => ({
      id: img.id,
      imagePath: img.image_path,
      image_path: img.image_path,
      aesthetic: img.aesthetic || 'mixed',
      colors: img.colors || ['neutral'],
      season: img.season || 'any',
      occasion: img.occasion || 'casual',
      selection_score: 100 + Math.random() * 50,
      is_cover_slide: false
    }));

  } catch (error) {
    logger.error('❌ Error generating replacement images:', error);
    return [];
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageIds, accountUsername, existingImageIds } = req.body;

  if (!imageIds || !accountUsername || !existingImageIds) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    logger.info(`🔄 Instantly rerolling ${imageIds.length} images for @${accountUsername}`);

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
    logger.info(`🎯 Account aesthetics: ${accountAesthetics.join(', ')}`);

    // Generate new images, excluding existing ones
    const newImages = await generateInstantReplacementImages(accountUsername, imageIds.length, existingImageIds, accountAesthetics);

    if (newImages.length === 0) {
      return res.status(500).json({ error: 'Failed to generate replacement images' });
    }

    logger.info(`✅ Generated ${newImages.length} replacement images`);

    // Return the new images
    res.json({
      success: true,
      replacedImageIds: imageIds,
      newImages: newImages
    });

  } catch (error) {
    logger.error('❌ Instant reroll error:', error);
    res.status(500).json({ error: error.message });
  }
}