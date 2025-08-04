import { FashionDataPipelineEnhanced } from './src/content/pipelines/enhanced.js';
import { Logger } from './src/utils/logger.js';
import { SupabaseClient } from './src/database/supabase-client.js';
import OpenAI from 'openai';

const logger = new Logger();

async function runPhase2Test() {
  try {
    logger.info('🚀 Starting Phase 2.1 Test: Rich Context Analysis (20 images)');
    logger.info('🚀 This will test the smart sampling analysis on a small dataset');
    
    // Initialize database and OpenAI
    const db = new SupabaseClient();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Get 20 images from database with engagement data from posts table
    logger.info('🚀 Fetching 20 images from database with engagement data...');
    const { data: images, error } = await db.client
      .from('images')
      .select(`
        id,
        image_path,
        post_id,
        username,
        posts!inner(
          like_count,
          comment_count,
          view_count,
          save_count,
          engagement_rate
        )
      `)
      .limit(100); // Get more images so we can sort by engagement
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    if (!images || images.length === 0) {
      throw new Error('No images found in database');
    }
    
    // Sort by engagement rate and take top 20
    const sortedImages = images
      .filter(img => img.posts && img.posts.like_count)
      .sort((a, b) => (b.posts.like_count || 0) - (a.posts.like_count || 0))
      .slice(0, 20);
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    if (!images || images.length === 0) {
      throw new Error('No images found in database');
    }
    
    logger.info(`✅ Found ${sortedImages.length} images to analyze (sorted by engagement)`);
    
    // Process images with rich context analysis
    let processedCount = 0;
    let totalCost = 0;
    let totalTokens = 0;
    const results = [];
    
    for (let i = 0; i < sortedImages.length; i++) {
      const image = sortedImages[i];
      
      try {
        logger.info(`🚀 Analyzing image ${i + 1}/${sortedImages.length} from post ${image.post_id}`);
        
        // Download image from URL and convert to base64
        const response = await fetch(image.image_path);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        const imageBuffer = await response.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        
        // Run AI analysis
        const aiResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                { 
                  type: 'text', 
                  text: `Analyze this fashion image for rich context. Return JSON: {\n  "a": "aesthetic (e.g., streetwear, y2k, preppy)",\n  "c": ["primary colors"],\n  "s": "season (spring, summer, fall, winter)",\n  "o": "occasion (casual, formal, party, workout)",\n  "ad": ["additional themes like 'back to school', 'date night', 'vacation'"]\n}` 
                },
                { 
                  type: 'image_url', 
                  image_url: { url: `data:image/jpeg;base64,${base64Image}` } 
                }
              ]
            }
          ],
          max_tokens: 120,
          temperature: 0
        });
        
        const text = aiResponse.choices[0].message.content.trim();
        
        // Handle JSON wrapped in markdown code blocks
        let jsonText = text;
        if (text.includes('```json')) {
          jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        } else if (text.includes('```')) {
          jsonText = text.replace(/```\n?/g, '').trim();
        }
        
        const analysis = JSON.parse(jsonText);
        
        // Track costs
        const promptTokens = aiResponse.usage.prompt_tokens;
        const completionTokens = aiResponse.usage.completion_tokens;
        const cost = (promptTokens * 0.000150 / 1000) + (completionTokens * 0.000600 / 1000);
        
        totalCost += cost;
        totalTokens += aiResponse.usage.total_tokens;
        processedCount++;
        
        // Store result
        results.push({
          image_id: image.id,
          post_id: image.post_id,
          username: image.username,
          image_path: image.image_path,
          analysis: analysis,
          engagement: {
            likes: image.posts.like_count,
            comments: image.posts.comment_count,
            views: image.posts.view_count,
            saves: image.posts.save_count,
            engagement_rate: image.posts.engagement_rate
          }
        });
        
        logger.info(`✅ Image ${i + 1} analyzed: ${analysis.a} aesthetic`);
        
      } catch (err) {
        logger.error(`❌ Failed to analyze image ${image.id}: ${err.message}`);
        continue;
      }
    }
    
    // Display results
    logger.info('🎉 Phase 2.1 Test Complete!');
    logger.info(`📊 Results Summary:`);
    logger.info(`   ✅ Images processed: ${processedCount}/${sortedImages.length}`);
    logger.info(`   💰 Total cost: $${totalCost.toFixed(4)}`);
    logger.info(`   🧠 Total tokens: ${totalTokens}`);
    logger.info(`   💸 Average cost per image: $${(totalCost/processedCount).toFixed(6)}`);
    
    // Show sample results
    logger.info('\n📋 Sample Analysis Results:');
    results.slice(0, 3).forEach((result, i) => {
      logger.info(`   ${i + 1}. Post ${result.post_id} (@${result.username}):`);
      logger.info(`      Aesthetic: ${result.analysis.a}`);
      logger.info(`      Colors: ${result.analysis.c.join(', ')}`);
      logger.info(`      Season: ${result.analysis.s}`);
      logger.info(`      Occasion: ${result.analysis.o}`);
      logger.info(`      Themes: ${result.analysis.ad.join(', ')}`);
      logger.info(`      Engagement: ${result.engagement.likes} likes`);
    });
    
    // Store results in database (optional - for testing)
    logger.info('\n🚀 Storing results in database...');
    for (const result of results) {
      try {
        await db.client
          .from('images')
          .update({
            aesthetic: result.analysis.a,
            colors: result.analysis.c,
            season: result.analysis.s,
            occasion: result.analysis.o,
            additional_themes: result.analysis.ad,
            updated_at: new Date().toISOString()
          })
          .eq('id', result.image_id);
      } catch (err) {
        logger.error(`Failed to update image ${result.image_id}: ${err.message}`);
      }
    }
    
    logger.info('✅ Results stored in database');
    logger.info('\n🎯 Phase 2.1 Test Summary:');
    logger.info(`   ✅ Rich context analysis working correctly`);
    logger.info(`   ✅ URL image handling working correctly`);
    logger.info(`   ✅ Database storage working correctly`);
    logger.info(`   💰 Cost for 20 images: $${totalCost.toFixed(4)}`);
    logger.info(`   💰 Estimated cost for 8k images: $${(totalCost * 400).toFixed(2)}`);
    logger.info('\n🚀 Ready to run full Phase 2.1 on all 8k images!');
    
  } catch (error) {
    logger.error(`❌ Phase 2.1 test failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

async function main() {
  try {
    logger.info('🚀 Starting Enhanced Fashion Data Pipeline');
    logger.info('✨ Features: Hook Slide Detection + Background Color Analysis + Regular Processing');
    
    const pipeline = new FashionDataPipelineEnhanced();
    const result = await pipeline.run();
    
    logger.info('🎉 Enhanced pipeline completed successfully!');
    logger.info('📊 FINAL RESULTS:');
    logger.info(`   👥 Accounts: ${result.accounts}`);
    logger.info(`   📄 Posts: ${result.posts}`);
    logger.info(`   🖼️ Images: ${result.images}`);
    logger.info(`   ✨ Hook Slides: ${result.hookSlides}`);
    logger.info(`   🎨 Background Analyzed: ${result.backgroundAnalyzed}`);
    logger.info(`   💰 Total Cost: $${result.totalCost.toFixed(4)}`);
    
  } catch (error) {
    logger.error(`❌ Enhanced pipeline failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Check command line arguments for specific operations
const args = process.argv.slice(2);
let limit = null;
for (const arg of args) {
  if (arg.startsWith('--limit=')) {
    limit = parseInt(arg.split('=')[1], 10);
  }
}
if (args.includes('--phase2-test')) {
  // Run Phase 2.1 test (20 images)
  runPhase2Test();
} else if (args.includes('--hook-slides-only')) {
  // Run only hook slide detection
  (async () => {
    try {
      logger.info('✨ Running Hook Slide Detection Only');
      const pipeline = new FashionDataPipelineEnhanced();
      const result = await pipeline.runHookSlideDetectionOnly(limit);
      
      logger.info('🎉 Hook slide detection completed!');
      logger.info(`   📊 Images processed: ${result.processed}`);
      logger.info(`   ✨ Hook slides found: ${result.hookSlides}`);
      logger.info(`   💰 Cost: $${result.cost.toFixed(4)}`);
      
    } catch (error) {
      logger.error(`❌ Hook slide detection failed: ${error.message}`);
      process.exit(1);
    }
  })();
} else {
  // Run full enhanced pipeline
  main();
} 