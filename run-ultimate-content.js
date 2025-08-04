#!/usr/bin/env node

/**
 * Ultimate Smart Content Generation Runner
 * 
 * This script generates the BEST possible content by combining:
 * 1. Performance-based themes (from your successful posts)
 * 2. Hook slides (engaging cover images)
 * 3. Account profiles (tailored to your audience)
 * 
 * Think of this as having a professional content strategist, designer, 
 * and account manager all working together to create your content.
 * 
 * Usage:
 *   node run-ultimate-content.js [account] [options]
 */

import { config } from 'dotenv';
config();

import { UnifiedSmartContentGenerator } from './src/stages/unified-smart-content-generator.js';
import { Logger } from './src/utils/logger.js';

const logger = new Logger();

async function main() {
  logger.info('🚀 ULTIMATE Smart Content Generation');
  logger.info('🎯 Intelligently adapting based on available data (Account Profile + Optional Themes/Hooks)');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
🚀 ULTIMATE Smart Content Generation

This generates the BEST possible content by intelligently combining:
• Account profiles (tailored to your audience) - REQUIRED
• Performance-based themes (from your successful posts) - OPTIONAL
• Hook slides (engaging cover images) - OPTIONAL

The system automatically adapts based on what data is available!

Usage: node run-ultimate-content.js <account> [options]

Arguments:
  account                  Account username (required)

Options:
  --posts 3               Number of posts to generate (default: 3)
  --images 5              Images per post (default: 5)
  --no-hook-slides        Disable hook slide usage
  --confidence low        Theme confidence level (low/medium/high, default: medium)
  --no-variety           Use only the best theme (no variety)
  --help, -h             Show this help message

Examples:
  node run-ultimate-content.js aestheticgirl3854
  node run-ultimate-content.js aestheticgirl3854 --posts 5 --images 8
  node run-ultimate-content.js aestheticgirl3854 --confidence high --no-hook-slides

Prerequisites:
  • Account profile must exist (target audience, content strategy)
  
Optional Enhancements (auto-detected):
  • Theme discovery (run: node run-theme-discovery.js)
  • Hook slides detection (run: node run-enhanced-pipeline.js)
    `);
    process.exit(0);
  }
  
  const accountUsername = args[0];
  const options = {
    postCount: 3,
    imageCount: 5,
    useHookSlides: true,
    minThemeConfidence: 'medium',
    ensureVariety: true
  };
  
  // Parse options
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--posts' && i + 1 < args.length) {
      options.postCount = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--images' && i + 1 < args.length) {
      options.imageCount = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--confidence' && i + 1 < args.length) {
      options.minThemeConfidence = args[i + 1];
      i++;
    } else if (arg === '--no-hook-slides') {
      options.useHookSlides = false;
    } else if (arg === '--no-variety') {
      options.ensureVariety = false;
    }
  }
  
  logger.info(`📋 Configuration:`);
  logger.info(`   👤 Account: @${accountUsername}`);
  logger.info(`   📝 Posts: ${options.postCount}`);
  logger.info(`   🖼️ Images per post: ${options.imageCount}`);
  logger.info(`   ✨ Use hook slides: ${options.useHookSlides ? 'Yes' : 'No'}`);
  logger.info(`   🎯 Theme confidence: ${options.minThemeConfidence}`);
  logger.info(`   🎨 Ensure variety: ${options.ensureVariety ? 'Yes' : 'No'}`);
  
  try {
    // Initialize the ultimate content generator
    const generator = new UnifiedSmartContentGenerator();
    
    // Generate ultimate content
    logger.info('🎯 Starting ultimate content generation...');
    const result = await generator.generateUltimateContent(accountUsername, options);
    
    if (result.success) {
      logger.info('🎉 ULTIMATE Content Generation Complete!');
      logger.info('');
      logger.info('📊 GENERATION SUMMARY:');
      logger.info(`   📝 Posts generated: ${result.posts.length}`);
      logger.info(`   🎨 Themes used: ${result.summary.themesUsed.join(', ')}`);
      logger.info(`   ✨ Hook slides used: ${result.summary.hookSlidesUsed}/${options.postCount}`);
      logger.info(`   👤 Account optimization: ✅ Applied`);
      logger.info(`   💰 Total AI cost: $${result.summary.totalCost.toFixed(4)}`);
      logger.info(`   🚀 Approach: ${result.summary.approach}`);
      logger.info('');
      
      // Show detailed post information
      logger.info('📝 GENERATED POSTS:');
      result.posts.forEach((post, index) => {
        logger.info(`   ${index + 1}. Theme: "${post.theme}"`);
        logger.info(`      📊 Performance Score: ${post.themePerformanceScore || 'N/A'}/100`);
        logger.info(`      ✨ Hook Slide: ${post.hookSlide ? `"${post.hookSlide.theme}"` : 'None'}`);
        logger.info(`      🎯 Confidence: ${post.strategy?.confidenceLevel || 'medium'}`);
        logger.info(`      🖼️ Images: ${post.images.length}`);
        logger.info(`      📱 Caption: "${post.caption.substring(0, 80)}${post.caption.length > 80 ? '...' : ''}"`);
        logger.info('');
      });
      
      // Show optimization breakdown
      logger.info('🔍 OPTIMIZATION BREAKDOWN:');
      const hasThemes = result.summary.themesUsed.length > 0;
      const hasHookSlides = result.summary.hookSlidesUsed > 0;
      const hasAccountProfile = result.summary.accountOptimized;
      
      logger.info(`   🎯 Performance Themes: ${hasThemes ? '✅ Applied' : '❌ Not used'}`);
      logger.info(`   ✨ Hook Slides: ${hasHookSlides ? '✅ Applied' : '❌ Not used'}`);
      logger.info(`   👤 Account Profile: ${hasAccountProfile ? '✅ Applied' : '❌ Not used'}`);
      
      const optimizationScore = (hasThemes ? 1 : 0) + (hasHookSlides ? 1 : 0) + (hasAccountProfile ? 1 : 0);
      logger.info(`   📊 Optimization Level: ${optimizationScore}/3 approaches used`);
      
      if (optimizationScore === 3) {
        logger.info('   🏆 ULTIMATE OPTIMIZATION: All approaches combined!');
      } else if (optimizationScore === 2) {
        logger.info('   🎯 HIGH OPTIMIZATION: Two approaches combined');
      } else {
        logger.info('   ⚠️ BASIC OPTIMIZATION: Limited approaches available');
      }
      
      logger.info('');
      logger.info('💡 NEXT STEPS:');
      logger.info('   1. Review the generated content');
      logger.info('   2. Post to your TikTok account or save for later');
      logger.info('   3. Track performance to validate theme effectiveness');
      logger.info('   4. Run theme discovery monthly to find new patterns');
      
      if (!hasThemes) {
        logger.info('');
        logger.info('💡 TO IMPROVE RESULTS:');
        logger.info('   • Run theme discovery: node run-theme-discovery.js');
      }
      
      if (!hasHookSlides) {
        logger.info('   • Run enhanced pipeline to detect hook slides: node run-enhanced-pipeline.js');
      }
      
    } else {
      logger.error('❌ Ultimate content generation failed');
      process.exit(1);
    }
    
  } catch (error) {
    logger.error(`❌ Ultimate content generation failed: ${error.message}`);
    
    // Provide helpful troubleshooting
    logger.info('');
    logger.info('🔧 TROUBLESHOOTING:');
    
    if (error.message.includes('Account profile not found')) {
      logger.info('   ISSUE: Account profile missing');
      logger.info('   SOLUTION: Create an account profile with target audience and content strategy');
      logger.info('   COMMAND: Use your dashboard or API to create account profile');
    } else if (error.message.includes('No compatible themes found')) {
      logger.info('   ISSUE: No performance themes available');
      logger.info('   SOLUTION: Run theme discovery to analyze your successful posts');
      logger.info('   COMMAND: node run-theme-discovery.js --deploy-schema');
    } else if (error.message.includes('No suitable images found')) {
      logger.info('   ISSUE: No images match the criteria');
      logger.info('   SOLUTION: Run content pipeline to scrape and analyze more images');
      logger.info('   COMMAND: node run-enhanced-pipeline.js');
    } else if (error.message.includes('database') || error.message.includes('connection')) {
      logger.info('   ISSUE: Database connection problem');
      logger.info('   SOLUTION: Check Supabase credentials and table existence');
      logger.info('   COMMAND: Verify .env file and run schema deployment');
    }
    
    logger.info('');
    logger.info('📚 SETUP CHECKLIST:');
    logger.info('   □ Account profile created with target audience');
    logger.info('   □ Theme discovery run (node run-theme-discovery.js)');
    logger.info('   □ Content pipeline run (node run-enhanced-pipeline.js)');
    logger.info('   □ Database schema deployed');
    logger.info('   □ Supabase credentials configured');
    
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  logger.info('\n⏹️ Process interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('\n⏹️ Process terminated');
  process.exit(0);
});

// Run the main function
main().catch(error => {
  logger.error(`❌ Unexpected error: ${error.message}`);
  process.exit(1);
}); 