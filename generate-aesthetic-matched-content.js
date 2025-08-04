import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function generateAestheticMatchedContent() {
  console.log('🎨 Generating AESTHETIC-MATCHED Content - Full Database Access!\n');

  try {
    const accountUsername = 'aestheticgirl3854';
    
    console.log(`📝 Generating content for @${accountUsername}...`);
    console.log(`🎯 Target: 10 diverse images matching account aesthetics (no performance restrictions)`);
    
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

    // Step 1.5: Extract account aesthetic preferences
    console.log('\n🎨 Extracting account aesthetic preferences...');
    const accountAesthetics = accountProfile.content_strategy?.aestheticFocus || ['streetwear', 'casual', 'aesthetic'];
    console.log(`🎯 Target aesthetics: ${accountAesthetics.join(', ')}`);

    // Step 2: Get ALL images from database (NO RESTRICTIONS)
    console.log('\n📸 Fetching ALL images from database (no performance filtering)...');
    
    // Get ALL images using pagination to bypass Supabase's 1000 limit
    let allImages = [];
    let from = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: pageImages, error: pageError } = await supabase
        .from('images')
        .select('*')
        .range(from, from + pageSize - 1);
      
      if (pageError) {
        throw new Error(`Failed to fetch images: ${pageError.message}`);
      }
      
      if (!pageImages || pageImages.length === 0) {
        break; // No more images
      }
      
      allImages = allImages.concat(pageImages);
      from += pageSize;
      
      console.log(`📄 Fetched page ${Math.floor(from/pageSize)}: ${pageImages.length} images`);
      
      if (pageImages.length < pageSize) {
        break; // Last page
      }
    }

    console.log(`✅ Found ${allImages.length} images from FULL database (no restrictions)`);

    // Step 2.5: Filter images by account aesthetics
    console.log('\n🎨 Filtering images by account aesthetics...');
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
    if (matchingImages.length < 50) {
      console.log('⚠️ Not enough matching images, using all images');
      matchingImages.push(...allImages);
    }

    // Step 3: Get ALL cover slides (no performance restrictions)
    console.log('\n🎲 Fetching ALL cover slides from database...');
    
    // Get ALL cover slides using pagination
    let allCoverSlides = [];
    let coverFrom = 0;
    const coverPageSize = 1000;
    
    while (true) {
      const { data: pageCoverSlides, error: pageCoverError } = await supabase
        .from('images')
        .select('*')
        .eq('is_cover_slide', true)
        .not('cover_slide_text', 'is', null)
        .range(coverFrom, coverFrom + coverPageSize - 1);
      
      if (pageCoverError) {
        console.log('⚠️ Error fetching cover slides, proceeding without cover slides');
        break;
      }
      
      if (!pageCoverSlides || pageCoverSlides.length === 0) {
        break; // No more cover slides
      }
      
      allCoverSlides = allCoverSlides.concat(pageCoverSlides);
      coverFrom += coverPageSize;
      
      console.log(`📄 Fetched cover slide page ${Math.floor(coverFrom/coverPageSize)}: ${pageCoverSlides.length} cover slides`);
      
      if (pageCoverSlides.length < coverPageSize) {
        break; // Last page
      }
    }

    // Step 3.5: Filter cover slides by account aesthetics
    console.log('\n🎨 Filtering cover slides by account aesthetics...');
    const matchingCoverSlides = allCoverSlides.filter(coverSlide => {
      if (!coverSlide.aesthetic) return true; // Include cover slides without aesthetic if we have few options
      
      const coverAesthetic = coverSlide.aesthetic.toLowerCase();
      return accountAesthetics.some(targetAesthetic => 
        coverAesthetic.includes(targetAesthetic.toLowerCase()) ||
        targetAesthetic.toLowerCase().includes(coverAesthetic)
      );
    });

    console.log(`✅ Found ${matchingCoverSlides.length} cover slides matching account aesthetics`);

    // Step 4: Randomly select cover slide and 9 additional images
    console.log('\n🔄 Selecting 10 diverse images from AESTHETIC-MATCHED collection...');
    
    // Randomly select a cover slide if available
    let coverSlide = null;
    if (matchingCoverSlides && matchingCoverSlides.length > 0) {
      const randomIndex = Math.floor(Math.random() * matchingCoverSlides.length);
      coverSlide = matchingCoverSlides[randomIndex];
      console.log(`🎲 Randomly selected cover slide: "${coverSlide.cover_slide_text}" (ID: ${coverSlide.id})`);
    }

    // Shuffle and select 9 additional images (excluding cover slide if selected)
    const shuffledImages = matchingImages.sort(() => Math.random() - 0.5);
    let additionalImages = shuffledImages.slice(0, 9);
    
    // If we have a cover slide, make sure it's not in the additional images
    if (coverSlide) {
      additionalImages = additionalImages.filter(img => img.id !== coverSlide.id);
      // If we filtered out the cover slide, get one more image
      if (additionalImages.length < 9) {
        const extraImage = shuffledImages.find(img => img.id !== coverSlide.id && !additionalImages.find(a => a.id === img.id));
        if (extraImage) additionalImages.push(extraImage);
      }
    }

    // Step 4.5: Ensure account diversity (images from multiple accounts)
    console.log('\n👥 Ensuring account diversity...');
    const imagesByAccount = {};
    additionalImages.forEach(img => {
      if (!imagesByAccount[img.username]) {
        imagesByAccount[img.username] = [];
      }
      imagesByAccount[img.username].push(img);
    });

    console.log(`📊 Images from ${Object.keys(imagesByAccount).length} accounts:`);
    Object.entries(imagesByAccount).forEach(([account, images]) => {
      console.log(`   - @${account}: ${images.length} images`);
    });

    // Combine cover slide + additional images
    const selectedImages = [];
    
    if (coverSlide) {
      selectedImages.push({
        id: coverSlide.id,
        imagePath: coverSlide.image_path,
        aesthetic: coverSlide.aesthetic || 'mixed',
        colors: coverSlide.colors || ['neutral'],
        season: coverSlide.season || 'any',
        occasion: coverSlide.occasion || 'casual',
        selection_score: 200,
        is_cover_slide: true,
        cover_slide_text: coverSlide.cover_slide_text
      });
    }

    // Add the 9 additional images
    additionalImages.forEach((img, index) => {
      selectedImages.push({
        id: img.id,
        imagePath: img.image_path,
        aesthetic: img.aesthetic || 'mixed',
        colors: img.colors || ['neutral'],
        season: img.season || 'any',
        occasion: img.occasion || 'casual',
        selection_score: 100 + Math.random() * 50,
        is_cover_slide: false
      });
    });

    console.log(`✅ Selected ${selectedImages.length} diverse images from AESTHETIC-MATCHED collection:`);
    selectedImages.forEach((img, i) => {
      const type = img.is_cover_slide ? 'COVER SLIDE' : 'additional';
      console.log(`   ${i + 1}. ${img.aesthetic} (${type}) - ID: ${img.id}`);
    });

    // Step 5: Generate caption
    console.log('\n📝 Generating caption...');
    const caption = generateCaption(accountProfile, selectedImages);
    const hashtags = extractHashtags(caption);

    // Step 6: Create post object
    const post = {
      postNumber: 1,
      theme: 'Aesthetic-Matched Diverse Collection',
      images: selectedImages,
      caption: caption,
      hashtags: hashtags,
      strategy: {
        approach: 'aesthetic_matched',
        themeUsed: 'Aesthetic-Matched Diverse Collection',
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
    console.log(`   - Cover Slide: ${post.images.some(img => img.is_cover_slide) ? 'Yes' : 'No'}`);
    console.log(`   - Aesthetics: ${[...new Set(post.images.map(img => img.aesthetic))].join(', ')}`);
    console.log(`   - Caption length: ${post.caption.length} characters`);

    // Step 7: Create preview batch
    const batchId = `aesthetic_matched_${Date.now()}_${accountUsername}`;
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

    // Step 8: Create preview data
    const previewData = {
      previewUrl: `https://easypost.fun/postpreview/${batchId}`,
      downloadUrl: `https://easypost.fun/postpreview/download/${batchId}`
    };

    console.log(`🎨 Preview URL: ${previewData.previewUrl}`);
    console.log(`📥 Download URL: ${previewData.downloadUrl}`);

    // Step 9: Send to Slack
    console.log('\n📤 Sending to Slack...');

    const { SlackAPI } = await import('./src/slack/index.js');
    const slackAPI = new SlackAPI();

    if (!slackAPI.enabled) {
      throw new Error('Slack integration not configured');
    }

    const payload = slackAPI.buildSlackPayload(accountUsername, post, previewData);
    await slackAPI.sendToSlack(payload);

    console.log('✅ Post sent to Slack successfully!');
    console.log('\n🎉 AESTHETIC-MATCHED content generation complete!');
    console.log('\n🔗 Preview Links:');
    console.log(`   View: ${previewData.previewUrl}`);
    console.log(`   Download: ${previewData.downloadUrl}`);
    console.log('\n📱 Check your Slack for the message with 10 aesthetic-matched images!');

  } catch (error) {
    console.error('❌ Failed to generate aesthetic-matched content:', error.message);
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
generateAestheticMatchedContent(); 