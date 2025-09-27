import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Helper function for instant preview image generation
async function generateImagesForPreview(accountUsername, count, accountAesthetics) {
  log(`🎨 Selecting ${count} images for preview...`);

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

    log(`📸 Found ${allImages.length} total images`);

    // Filter by account aesthetics
    const matchingImages = allImages.filter(img => {
      if (!img.aesthetic) return false;
      
      const imgAesthetic = img.aesthetic.toLowerCase();
      return accountAesthetics.some(targetAesthetic => 
        imgAesthetic.includes(targetAesthetic.toLowerCase()) ||
        targetAesthetic.toLowerCase().includes(imgAesthetic)
      );
    });

    log(`✅ Found ${matchingImages.length} images matching account aesthetics`);

    // If we don't have enough matching images, use all images
    if (matchingImages.length < count) {
      log('⚠️ Not enough matching images, using all images');
      matchingImages.push(...allImages);
    }

    // Randomly select images
    const shuffledImages = matchingImages.sort(() => Math.random() - 0.5);
    const selectedImages = shuffledImages.slice(0, count);

    log(`✅ Selected ${selectedImages.length} unique images`);

    // Compute anchor deviation (cosine distance) if anchor exists
    let anchorVec = null;
    try{
      const { data: anchorRow } = await supabase
        .from('account_anchors')
        .select('anchor')
        .eq('username', accountUsername)
        .single();
      if (anchorRow && anchorRow.anchor){
        anchorVec = Array.isArray(anchorRow.anchor) ? anchorRow.anchor : null;
        if (!anchorVec && typeof anchorRow.anchor === 'string'){
          try { anchorVec = JSON.parse(anchorRow.anchor); } catch(_){ anchorVec = null; }
        }
      }
    }catch(_){ anchorVec = null; }

    const out = selectedImages.map((img, index) => ({
      id: img.id,
      imagePath: img.image_path,
      image_path: img.image_path,
      aesthetic: img.aesthetic || 'mixed',
      colors: img.colors || ['neutral'],
      season: img.season || 'any',
      occasion: img.occasion || 'casual',
      selection_score: 100 + Math.random() * 50,
      is_cover_slide: index === 0
    }));

    if (anchorVec && out.length){
      const ids = out.map(r => r.id);
      const { data: embRows } = await supabase
        .from('images')
        .select('id, embedding')
        .in('id', ids);
      const embMap = new Map();
      function parseEmb(e){
        if (Array.isArray(e)) return e;
        if (!e) return null;
        if (typeof e === 'string'){
          try {
            let s = e.trim();
            if (s.startsWith('(') && s.endsWith(')')) s = '['+s.slice(1,-1)+']';
            const arr = JSON.parse(s);
            if (Array.isArray(arr)) return arr.map(Number);
          } catch { return null; }
        }
        return null;
      }
      (embRows||[]).forEach(r => { const v = parseEmb(r.embedding); if (Array.isArray(v)) embMap.set(r.id, v); });
      function cosine(a,b){ let s=0; for (let i=0;i<a.length;i++) s+= a[i]*b[i]; return s; }
      function dist(a,b){ return 1 - cosine(a,b); }
      out.forEach(o => { const v = embMap.get(o.id); if (Array.isArray(v)) o.dist = dist(anchorVec, v); });
    }

    return out;

  } catch (error) {
    log('❌ Error generating preview images: ' + error.message);
    return [];
  }
}

// Simple caption generator
function generateSimpleCaption(accountProfile, coverImage) {
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountUsername, imageCount = 10 } = req.body;

  if (!accountUsername) {
    return res.status(400).json({ error: 'Account username is required' });
  }

  try {
    log(`🎨 Generating preview for @${accountUsername} with ${imageCount} images`);

    // Get account profile
    const { data: accountProfile, error: profileError } = await supabase
      .from('account_profiles')
      .select('*')
      .eq('username', accountUsername)
      .single();

    if (profileError || !accountProfile) {
      return res.status(404).json({ error: 'Account profile not found' });
    }

    const accountAesthetics = accountProfile.content_strategy?.aestheticFocus || ['streetwear', 'casual', 'aesthetic'];
    log(`🎯 Account aesthetics: ${accountAesthetics.join(', ')}`);

    // Generate images for the post
    const images = await generateImagesForPreview(accountUsername, imageCount, accountAesthetics);

    if (images.length === 0) {
      return res.status(500).json({ error: 'Failed to generate images' });
    }

    log(`✅ Generated ${images.length} images for preview`);

    // Generate caption
    const caption = generateSimpleCaption(accountProfile, images[0]);

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
    log('❌ Preview generation error: ' + error.message);
    res.status(500).json({ error: error.message });
  }
}