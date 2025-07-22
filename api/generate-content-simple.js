import { SupabaseClient } from '../src/database/supabase-client.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize database connection
    const db = new SupabaseClient();
    
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const { accountUsername, postCount = 1, imageCount = 5 } = req.body;
    
    console.log(`🎨 Generating content for @${accountUsername}: ${postCount} posts, ${imageCount} images each`);
    
    // Get available images from database (only basic tables)
    const { data: availableImages, error: imagesError } = await db.client
      .from('images')
      .select('id, image_path, username, post_id')
      .not('image_path', 'is', null);
    
    if (imagesError) {
      console.error('❌ Error fetching images:', imagesError);
      return res.status(500).json({ error: 'Failed to fetch images from database' });
    }
    
    if (!availableImages || availableImages.length === 0) {
      return res.status(404).json({ error: 'No images found in database' });
    }
    
    console.log(`📊 Found ${availableImages.length} available images`);
    
    // Check if we have enough images
    if (availableImages.length < postCount * imageCount) {
      return res.status(400).json({ 
        error: `Not enough images available. Need ${postCount * imageCount}, have ${availableImages.length}` 
      });
    }

    // Generate simple themes based on current time
    const themes = generateSimpleThemes();
    console.log(`🎯 Generated ${themes.length} themes:`, themes.map(t => t.name));

    const posts = [];
    const generationId = `simple_${Date.now()}_${accountUsername}`;
    
    // Generate each post
    for (let postIndex = 0; postIndex < postCount; postIndex++) {
      console.log(`🎨 Generating post ${postIndex + 1}/${postCount}...`);
      
      // Select random images for this post
      const shuffled = [...availableImages].sort(() => 0.5 - Math.random());
      const postImages = shuffled.slice(0, imageCount);
      
      // Remove these images from available pool to avoid duplicates
      availableImages.splice(0, imageCount);
      
      // Get theme for this post
      const theme = themes[postIndex % themes.length];
      
      // Generate simple caption and hashtags
      const { caption, hashtags } = generateSimpleContent(postImages, theme, postIndex + 1);
      
      const post = {
        postNumber: postIndex + 1,
        caption,
        hashtags,
        images: postImages.map(img => ({
          id: img.id,
          imagePath: img.image_path,
          username: img.username,
          postId: img.post_id
        })),
        theme: theme.name,
        generatedAt: new Date().toISOString()
      };
      
      posts.push(post);
      console.log(`✅ Generated post ${postIndex + 1} with theme: ${theme.name}`);
    }

    // Create generation summary
    const generation = {
      id: generationId,
      accountUsername,
      postCount,
      imageCount,
      posts,
      generatedAt: new Date().toISOString()
    };

    console.log(`🎉 Successfully generated ${posts.length} posts`);
    
    res.json({
      success: true,
      generation,
      posts
    });

  } catch (error) {
    console.error('❌ Content generation error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Generate simple themes based on current time
function generateSimpleThemes() {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const dayOfWeek = now.getDay(); // 0-6 (Sunday = 0)
  
  const themes = [];
  
  // Seasonal themes
  if (month >= 8 && month <= 9) {
    themes.push({
      name: 'Back to School',
      keywords: ['back to school', 'school outfit', 'campus style'],
      hashtags: ['#backtoschool', '#schooloutfit', '#campusstyle', '#studentfashion'],
      description: 'Back to school outfit inspiration'
    });
  }
  
  if (month >= 6 && month <= 8) {
    themes.push({
      name: 'Summer Style',
      keywords: ['summer', 'beach day', 'vacation outfit'],
      hashtags: ['#summer', '#beachday', '#vacationoutfit', '#summerstyle'],
      description: 'Perfect summer and vacation outfits'
    });
  }
  
  if (month >= 12 || month <= 2) {
    themes.push({
      name: 'Winter Fashion',
      keywords: ['winter', 'cold weather', 'winter outfit'],
      hashtags: ['#winter', '#coldweather', '#winteroutfit', '#winterfashion'],
      description: 'Stylish winter outfits for cold weather'
    });
  }
  
  if (month >= 3 && month <= 5) {
    themes.push({
      name: 'Spring Fashion',
      keywords: ['spring', 'spring outfit', 'spring fashion'],
      hashtags: ['#spring', '#springoutfit', '#springfashion', '#springvibes'],
      description: 'Fresh spring outfits and styles'
    });
  }
  
  // Weekly themes
  if (dayOfWeek === 5 || dayOfWeek === 6) { // Friday/Saturday
    themes.push({
      name: 'Weekend Vibes',
      keywords: ['weekend', 'night out', 'weekend outfit'],
      hashtags: ['#weekend', '#nightout', '#weekendoutfit', '#weekendvibes'],
      description: 'Perfect weekend and night out outfits'
    });
  }
  
  if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Weekdays
    themes.push({
      name: 'Daily Style',
      keywords: ['daily', 'everyday', 'casual outfit'],
      hashtags: ['#daily', '#everyday', '#casualoutfit', '#dailyoutfit'],
      description: 'Stylish everyday outfits'
    });
  }
  
  // Default theme if none match
  if (themes.length === 0) {
    themes.push({
      name: 'Fashion Inspiration',
      keywords: ['fashion', 'style', 'outfit'],
      hashtags: ['#fashion', '#style', '#outfit', '#fashioninspo'],
      description: 'Fashion inspiration and style tips'
    });
  }
  
  return themes;
}

// Generate simple content without requiring complex data
function generateSimpleContent(images, theme, postNumber) {
  const imageCount = images.length;
  
  // Simple caption based on theme and image count
  let caption = '';
  
  if (imageCount === 1) {
    caption = `${theme.description} ✨ Perfect for ${theme.keywords[0]}!`;
  } else {
    caption = `${theme.description} ✨ ${imageCount} amazing looks for ${theme.keywords[0]}!`;
  }
  
  // Add some variety based on post number
  if (postNumber === 1) {
    caption += ' Which one is your favorite? 👀';
  } else if (postNumber === 2) {
    caption += ' Drop a ❤️ if you love these!';
  } else {
    caption += ' Save this for later! 📌';
  }
  
  // Combine theme hashtags with some general ones
  const hashtags = [
    ...theme.hashtags,
    '#fashion',
    '#style',
    '#outfit',
    '#fashioninspo',
    '#trending',
    '#viral'
  ];
  
  // Add hashtags to caption
  caption += `\n\n${hashtags.join(' ')}`;
  
  return {
    caption,
    hashtags
  };
} 