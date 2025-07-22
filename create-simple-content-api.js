import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { SlackAPI } from './src/slack/index.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Sample fashion images (using placeholder images for demo)
const sampleImages = [
  { id: 1, url: 'https://picsum.photos/400/500?random=1', aesthetic: 'Streetwear', description: 'Urban style outfit' },
  { id: 2, url: 'https://picsum.photos/400/500?random=2', aesthetic: 'Elegant', description: 'Sophisticated evening look' },
  { id: 3, url: 'https://picsum.photos/400/500?random=3', aesthetic: 'Casual', description: 'Comfortable daily wear' },
  { id: 4, url: 'https://picsum.photos/400/500?random=4', aesthetic: 'Y2K', description: 'Retro futuristic style' },
  { id: 5, url: 'https://picsum.photos/400/500?random=5', aesthetic: 'Minimalist', description: 'Clean simple lines' },
  { id: 6, url: 'https://picsum.photos/400/500?random=6', aesthetic: 'Boho', description: 'Free-spirited bohemian' },
  { id: 7, url: 'https://picsum.photos/400/500?random=7', aesthetic: 'Preppy', description: 'Classic collegiate style' },
  { id: 8, url: 'https://picsum.photos/400/500?random=8', aesthetic: 'Grunge', description: 'Alternative edgy style' }
];

// Content generation templates
const captionTemplates = {
  Streetwear: [
    "Street style vibes hitting different today 🔥 Perfect for the city hustle!",
    "Urban energy in every thread ⚡ This look speaks volumes without saying a word.",
    "Concrete jungle ready 🏙️ When comfort meets street credibility."
  ],
  Elegant: [
    "Elegance is the only beauty that never fades ✨ Timeless sophistication at its finest.",
    "Sometimes you need a look that whispers luxury 💫 This is that moment.",
    "Refined details for those who appreciate the finer things 🌟"
  ],
  Casual: [
    "Effortless style for everyday adventures 🌈 Comfort never looked so good!",
    "When you want to look put-together without trying too hard ☀️",
    "Casual vibes, confident energy 💛 Ready for whatever the day brings."
  ],
  Y2K: [
    "Bringing back the future one outfit at a time 🌌 Y2K nostalgia hits different!",
    "Cyber dreams and digital vibes 💫 The future is now, and it's fashionable.",
    "Retro-futuristic energy activated 🚀 When past meets future in perfect harmony."
  ],
  Minimalist: [
    "Less is more, always ⚪ Clean lines and intentional choices.",
    "Simplicity is the ultimate sophistication 🤍 Every piece has purpose.",
    "Minimal effort, maximum impact ✨ When quality speaks louder than quantity."
  ],
  Boho: [
    "Free spirit, wild heart 🌸 Bohemian dreams in every thread.",
    "Earth tones and good vibes only 🌿 Living that boho lifestyle.",
    "Flower child energy with modern twist 🦋 Peace, love, and great style."
  ],
  Preppy: [
    "Classic never goes out of style 📚 Collegiate vibes with timeless appeal.",
    "Polished perfection meets casual confidence 🎓 Preppy and proud.",
    "Traditional with a twist ⚓ When heritage meets contemporary cool."
  ],
  Grunge: [
    "Alternative vibes, authentic energy 🖤 Not for everyone, and that's the point.",
    "Raw, real, and unapologetically different ⚡ Grunge never died, it just evolved.",
    "Rebellion in fabric form 🔥 When your outfit is your statement."
  ]
};

const hashtagSets = {
  Streetwear: ['#streetwear', '#urban', '#hypebeast', '#streetstyle', '#fashion'],
  Elegant: ['#elegant', '#sophisticated', '#timeless', '#luxury', '#chic'],
  Casual: ['#casual', '#everyday', '#comfortable', '#effortless', '#style'],
  Y2K: ['#y2k', '#retro', '#futuristic', '#nostalgic', '#cyber'],
  Minimalist: ['#minimalist', '#simple', '#clean', '#modern', '#less'],
  Boho: ['#boho', '#bohemian', '#freespirit', '#earthy', '#natural'],
  Preppy: ['#preppy', '#classic', '#collegiate', '#traditional', '#timeless'],
  Grunge: ['#grunge', '#alternative', '#edgy', '#authentic', '#rebel']
};

// Generate content endpoint
app.post('/api/simple-generate-content', async (req, res) => {
  try {
    const { accountUsername, postCount = 3, imageCount = 2 } = req.body;
    
    console.log(`🎨 Generating ${postCount} posts for @${accountUsername} (${imageCount} images each)`);
    
    const posts = [];
    
    for (let i = 1; i <= postCount; i++) {
      // Randomly select aesthetic
      const randomAesthetic = Object.keys(captionTemplates)[Math.floor(Math.random() * Object.keys(captionTemplates).length)];
      
      // Select images for this aesthetic
      const aestheticImages = sampleImages.filter(img => img.aesthetic === randomAesthetic);
      const allImages = aestheticImages.length > 0 ? aestheticImages : sampleImages;
      
      const selectedImages = [];
      for (let j = 0; j < imageCount; j++) {
        const randomImage = allImages[Math.floor(Math.random() * allImages.length)];
        selectedImages.push({
          imagePath: randomImage.url,
          aesthetic: randomImage.aesthetic,
          description: randomImage.description
        });
      }
      
      // Generate caption
      const captions = captionTemplates[randomAesthetic] || captionTemplates.Casual;
      const caption = captions[Math.floor(Math.random() * captions.length)];
      
      // Get hashtags
      const hashtags = hashtagSets[randomAesthetic] || hashtagSets.Casual;
      
      posts.push({
        postNumber: i,
        caption: caption,
        hashtags: hashtags,
        images: selectedImages,
        aesthetic: randomAesthetic
      });
    }
    
    console.log(`✅ Generated ${posts.length} posts successfully`);
    
    res.json({
      success: true,
      generation: {
        id: `simple_gen_${Date.now()}`,
        accountUsername,
        generatedAt: new Date().toISOString(),
        postCount: posts.length,
        totalImages: posts.reduce((sum, post) => sum + post.images.length, 0)
      },
      posts: posts
    });
    
  } catch (error) {
    console.error('❌ Content generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Upload to Slack endpoint  
app.post('/api/simple-upload-to-slack', async (req, res) => {
  try {
    const { accountUsername, posts } = req.body;
    
    if (!accountUsername || !Array.isArray(posts)) {
      return res.status(400).json({ 
        success: false, 
        error: 'accountUsername and posts array are required' 
      });
    }
    
    const slack = new SlackAPI();
    if (!slack.enabled) {
      return res.status(400).json({ 
        success: false, 
        error: 'Slack integration not configured. Add SLACK_WEBHOOK_URL to .env' 
      });
    }
    
    console.log(`📤 Uploading ${posts.length} posts to Slack for @${accountUsername}`);
    
    const uploads = [];
    
    for (const post of posts) {
      try {
        await slack.sendPostToSlack(accountUsername, post);
        uploads.push({ 
          postNumber: post.postNumber, 
          success: true 
        });
        console.log(`✅ Post ${post.postNumber} sent to Slack`);
      } catch (error) {
        uploads.push({ 
          postNumber: post.postNumber, 
          success: false, 
          error: error.message 
        });
        console.log(`❌ Post ${post.postNumber} failed: ${error.message}`);
      }
    }
    
    const successfulUploads = uploads.filter(u => u.success).length;
    
    res.json({
      success: successfulUploads > 0,
      uploads: uploads,
      message: `${successfulUploads}/${uploads.length} posts sent to Slack`
    });
    
  } catch (error) {
    console.error('❌ Slack upload error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Complete simple workflow
app.post('/api/simple-complete-workflow', async (req, res) => {
  try {
    const { accountUsername, postCount = 3, imageCount = 2 } = req.body;
    
    console.log(`🚀 Starting simple workflow for @${accountUsername}`);
    
    // Step 1: Generate content
    console.log('🎨 Generating content...');
    const generationResponse = await fetch(`http://localhost:3002/api/simple-generate-content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountUsername, postCount, imageCount })
    });
    
    const generation = await generationResponse.json();
    if (!generation.success) {
      throw new Error(`Content generation failed: ${generation.error}`);
    }
    
    console.log('✅ Content generated successfully');
    
    // Step 2: Upload to Slack
    console.log('📤 Sending to Slack...');
    const slackResponse = await fetch(`http://localhost:3002/api/simple-upload-to-slack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        accountUsername, 
        posts: generation.posts 
      })
    });
    
    const slackResult = await slackResponse.json();
    if (!slackResult.success) {
      throw new Error(`Slack upload failed: ${slackResult.error}`);
    }
    
    console.log('✅ Workflow completed successfully');
    
    res.json({
      success: true,
      generation: generation.generation,
      posts: generation.posts,
      slackResult: slackResult,
      message: `Complete workflow successful! ${slackResult.message}`
    });
    
  } catch (error) {
    console.error('❌ Workflow error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Serve static files
app.use(express.static('src/web/public'));

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`🌐 Simple Content API running on http://localhost:${PORT}`);
  console.log(`📱 Dashboard: http://localhost:${PORT}`);
  console.log(`🔗 Slack: ${process.env.SLACK_WEBHOOK_URL ? 'Configured ✅' : 'Not configured ❌'}`);
}); 