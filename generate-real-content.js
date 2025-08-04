import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function generateRealContent() {
  console.log('🚀 Generating REAL Content with 10 Diverse Images...\n');

  try {
    const accountUsername = 'aestheticgirl3854';
    
    console.log(`📝 Generating content for @${accountUsername}...`);
    console.log(`🎯 Target: 10 diverse images (not just cover slides)`);
    
    // Step 1: Get account profile
    console.log('\n👤 Getting account profile...');
    const { data: accountProfile, error: profileError } = await supabase
      .from('account_profiles')
      .select('*')
      .eq('username', accountUsername)
      .single();

    if (profileError || !accountProfile) {
      throw new Error('Account profile not found');
    }

    console.log(`✅ Account profile: ${accountProfile.target_audience?.age || 'general'} audience`);

    // Step 2: Get diverse images from database
    console.log('\n📸 Fetching diverse images from database...');
    
    // Get images that match the account's aesthetic focus
    const accountAesthetics = accountProfile.content_strategy?.aestheticFocus || ['streetwear', 'minimalist', 'aesthetic'];
    
    let { data: images, error: imagesError } = await supabase
      .from('images')
      .select('*')
      .in('aesthetic', accountAesthetics)
      .limit(100); // Get more images to ensure variety

    if (imagesError || !images || images.length === 0) {
      console.log('⚠️ No matching images found, getting any available images...');
      const { data: anyImages, error: anyError } = await supabase
        .from('images')
        .select('*')
        .limit(100);

      if (anyError || !anyImages || anyImages.length === 0) {
        throw new Error('No images found in database');
      }
      
      images = anyImages;
    }

    console.log(`✅ Found ${images.length} potential images`);

    // Step 2.1: Get actual cover slides from database
    console.log('\n🎲 Fetching real cover slides from database...');
    const { data: coverSlides, error: coverError } = await supabase
      .from('images')
      .select('*')
      .eq('is_cover_slide', true)
      .not('cover_slide_text', 'is', null)
      .limit(50);

    if (coverError || !coverSlides || coverSlides.length === 0) {
      throw new Error('No cover slides found in database');
    }

    // Randomly select one cover slide
    const randomCoverSlide = coverSlides[Math.floor(Math.random() * coverSlides.length)];
    console.log(`🎲 Selected cover slide: "${randomCoverSlide.cover_slide_text}" (ID: ${randomCoverSlide.id})`);

    // Step 3: Select 9 additional diverse images from multiple accounts
    console.log('\n🔄 Selecting 9 additional diverse images from multiple accounts...');
    
    // Filter out the cover slide from available images
    const filteredImages = images.filter(img => img.id !== randomCoverSlide.id);
    
    // Group images by account to ensure diversity
    const imagesByAccount = {};
    filteredImages.forEach(img => {
      if (!imagesByAccount[img.username]) {
        imagesByAccount[img.username] = [];
      }
      imagesByAccount[img.username].push(img);
    });
    
    console.log(`📊 Found images from ${Object.keys(imagesByAccount).length} accounts:`);
    Object.entries(imagesByAccount).forEach(([account, images]) => {
      console.log(`   - @${account}: ${images.length} images`);
    });
    
    // Ensure we select from at least 3 different accounts
    const targetAccounts = Math.min(3, Object.keys(imagesByAccount).length);
    const accountsToUse = Object.keys(imagesByAccount)
      .sort(() => Math.random() - 0.5) // Shuffle accounts
      .slice(0, targetAccounts);
    
    console.log(`🎯 Using ${targetAccounts} accounts: ${accountsToUse.map(acc => '@' + acc).join(', ')}`);
    
    // Distribute images across accounts (3 images per account if possible)
    const imagesPerAccount = Math.ceil(9 / targetAccounts);
    const additionalImages = [];
    
    for (const account of accountsToUse) {
      const accountImages = imagesByAccount[account]
        .sort(() => Math.random() - 0.5) // Shuffle images within account
        .slice(0, imagesPerAccount);
      
      additionalImages.push(...accountImages);
      
      if (additionalImages.length >= 9) break;
    }
    
    // If we don't have enough images, fill from remaining accounts
    if (additionalImages.length < 9) {
      const remainingAccounts = Object.keys(imagesByAccount).filter(acc => !accountsToUse.includes(acc));
      for (const account of remainingAccounts) {
        const remainingImages = imagesByAccount[account]
          .filter(img => !additionalImages.find(selected => selected.id === img.id))
          .sort(() => Math.random() - 0.5)
          .slice(0, 9 - additionalImages.length);
        
        additionalImages.push(...remainingImages);
        if (additionalImages.length >= 9) break;
      }
    }
    
    // Take exactly 9 additional images
    const finalAdditionalImages = additionalImages.slice(0, 9);
    
    console.log(`✅ Selected ${finalAdditionalImages.length} additional images from ${new Set(finalAdditionalImages.map(img => img.username)).size} accounts:`);
    finalAdditionalImages.forEach((img, i) => {
      console.log(`   ${i + 1}. ${img.aesthetic} from @${img.username} (ID: ${img.id})`);
    });

    // Combine cover slide + additional images
    const selectedImages = [
      {
        id: randomCoverSlide.id,
        imagePath: randomCoverSlide.image_path,
        aesthetic: randomCoverSlide.aesthetic || 'mixed',
        colors: randomCoverSlide.colors || ['neutral'],
        season: randomCoverSlide.season || 'any',
        occasion: randomCoverSlide.occasion || 'casual',
        selection_score: 200,
        is_cover_slide: true,
        cover_slide_text: randomCoverSlide.cover_slide_text
      },
      ...finalAdditionalImages.map(img => ({
        id: img.id,
        imagePath: img.image_path,
        aesthetic: img.aesthetic || 'mixed',
        colors: img.colors || ['neutral'],
        season: img.season || 'any',
        occasion: img.occasion || 'casual',
        selection_score: 100 + Math.random() * 50,
        is_cover_slide: false
      }))
    ];

    console.log(`✅ Selected ${selectedImages.length} images (1 cover slide + 9 additional):`);
    selectedImages.forEach((img, i) => {
      const type = img.is_cover_slide ? 'COVER SLIDE' : 'additional';
      console.log(`   ${i + 1}. ${img.aesthetic} (${type}) - ID: ${img.id}`);
    });

    // Step 4: Generate caption
    console.log('\n📝 Generating caption...');
    const caption = generateCaption(accountProfile, selectedImages);
    const hashtags = extractHashtags(caption);

    // Step 5: Create post object
    const post = {
      postNumber: 1,
      theme: 'Diverse Aesthetic Collection',
      images: selectedImages,
      caption: caption,
      hashtags: hashtags,
      strategy: {
        approach: 'diverse_collection',
        themeUsed: 'Diverse Aesthetic Collection',
        accountOptimized: true,
        expectedPerformance: 'high',
        confidenceLevel: 'high'
      },
      generatedAt: new Date().toISOString()
    };

    console.log('\n✅ Post generated successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Account: @${accountUsername}`);
    console.log(`   - Images: ${post.images.length} diverse images`);
    console.log(`   - Aesthetics: ${[...new Set(post.images.map(img => img.aesthetic))].join(', ')}`);
    console.log(`   - Caption length: ${post.caption.length} characters`);

    // Step 6: Create preview batch
    const batchId = `diverse_${Date.now()}_${accountUsername}`;
    console.log(`\n📋 Creating preview batch: ${batchId}`);
    
    const { data: previewBatch, error: previewError } = await supabase
      .from('preview_batches')
      .insert({
        preview_id: batchId,
        account_username: accountUsername,
        posts: [post],
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (previewError) {
      throw new Error(`Failed to create preview batch: ${previewError.message}`);
    }

    console.log('✅ Preview batch created successfully');

    // Step 7: Create preview data
    const previewData = {
      previewUrl: `https://easypost.fun/postpreview/${batchId}`,
      downloadUrl: `https://easypost.fun/postpreview/download/${batchId}`
    };

    console.log(`🎨 Preview URL: ${previewData.previewUrl}`);
    console.log(`📥 Download URL: ${previewData.downloadUrl}`);

    // Step 8: Send to Slack
    console.log('\n📤 Sending to Slack...');
    
    const { SlackAPI } = await import('./src/slack/index.js');
    const slackAPI = new SlackAPI();
    
    if (!slackAPI.enabled) {
      throw new Error('Slack integration not configured');
    }

    const payload = slackAPI.buildSlackPayload(accountUsername, post, previewData);
    await slackAPI.sendToSlack(payload);

    console.log('✅ Post sent to Slack successfully!');
    console.log('\n🎉 REAL content generation complete!');
    console.log('\n🔗 Preview Links:');
    console.log(`   View: ${previewData.previewUrl}`);
    console.log(`   Download: ${previewData.downloadUrl}`);
    console.log('\n📱 Check your Slack for the message with 10 diverse images!');

  } catch (error) {
    console.error('❌ Failed to generate content:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

function generateCaption(accountProfile, images) {
  const audience = accountProfile.target_audience?.age || '16-20';
  const aesthetics = [...new Set(images.map(img => img.aesthetic))];
  const mainAesthetic = aesthetics[0] || 'aesthetic';
  
  return `✨ ${mainAesthetic} vibes for ${audience} year olds ✨\n\n` +
         `perfect for those days when you want to look cute but stay comfy\n\n` +
         `#${mainAesthetic} #fashiongirl #outfitinspo #aesthetic #streetwear #fashionblogger #casualstyle`;
}

function extractHashtags(caption) {
  const hashtagRegex = /#(\w+)/g;
  const matches = caption.match(hashtagRegex);
  return matches ? matches.map(tag => tag.substring(1)) : [];
}

// Run the generation
generateRealContent(); 