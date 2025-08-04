import { UnifiedSmartContentGenerator } from '../src/stages/unified-smart-content-generator.js';

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
    const { 
      accountUsername, 
      postCount = 3, 
      imageCount = 5,
      useHookSlides = true,
      minThemeConfidence = 'medium',
      ensureVariety = true
    } = req.body;

    if (!accountUsername) {
      return res.status(400).json({ 
        error: 'Account username is required',
        example: {
          accountUsername: 'fashionista_lj',
          postCount: 3,
          imageCount: 5,
          useHookSlides: true,
          minThemeConfidence: 'medium',
          ensureVariety: true
        }
      });
    }

    console.log(`🚀 ULTIMATE Content Generation for @${accountUsername}`);
    console.log(`🎯 Combining: Performance Themes + Hook Slides + Account Profile`);
    console.log(`📋 Settings: ${postCount} posts, ${imageCount} images each`);

    // Initialize the unified smart content generator
    const generator = new UnifiedSmartContentGenerator();

    // Generate ultimate content using all three approaches
    const result = await generator.generateUltimateContent(accountUsername, {
      postCount,
      imageCount,
      useHookSlides,
      minThemeConfidence,
      ensureVariety
    });

    if (result.success) {
      console.log(`🎉 ULTIMATE Content Generation Complete!`);
      console.log(`   📝 Posts generated: ${result.posts.length}`);
      console.log(`   🎨 Themes used: ${result.summary.themesUsed.join(', ')}`);
      console.log(`   ✨ Hook slides used: ${result.summary.hookSlidesUsed}/${postCount}`);
      console.log(`   👤 Account optimization: ✅ Applied`);
      console.log(`   💰 Total cost: $${result.summary.totalCost.toFixed(4)}`);

      // Add helpful metadata for the frontend
      const enhancedResult = {
        ...result,
        metadata: {
          generationApproach: 'ultimate_smart',
          featuresUsed: {
            performanceThemes: result.summary.themesUsed.length > 0,
            hookSlides: result.summary.hookSlidesUsed > 0,
            accountOptimization: result.summary.accountOptimized
          },
          qualityIndicators: {
            averageThemeScore: result.posts
              .filter(p => p.themePerformanceScore)
              .reduce((sum, p) => sum + p.themePerformanceScore, 0) / 
              Math.max(1, result.posts.filter(p => p.themePerformanceScore).length),
            hookSlideUsageRate: (result.summary.hookSlidesUsed / postCount * 100).toFixed(1) + '%',
            overallConfidence: this.calculateAverageConfidence(result.posts)
          },
          recommendations: this.generateRecommendations(result)
        }
      };

      res.json({
        success: true,
        message: `Generated ${result.posts.length} ultimate posts using all optimization approaches`,
        ...enhancedResult
      });

    } else {
      console.error('❌ Ultimate content generation failed');
      res.status(500).json({ 
        error: 'Ultimate content generation failed',
        details: 'Check server logs for more information'
      });
    }

  } catch (error) {
    console.error('❌ Ultimate content generation error:', error);
    
    let errorMessage = error.message;
    let suggestions = [];
    let troubleshooting = {};

    // Provide specific error handling and suggestions
    if (error.message.includes('Account profile not found')) {
      errorMessage = 'Account profile required for ultimate generation';
      suggestions = [
        'Create an account profile first using the account setup endpoint',
        'Make sure the account profile has target_audience and content_strategy defined',
        'Check that the account username is correct'
      ];
      troubleshooting = {
        step1: 'Create account profile: POST /api/accounts/profiles',
        step2: 'Include target_audience, content_strategy, and performance_goals',
        step3: 'Verify the profile exists in your database'
      };
    } else if (error.message.includes('No compatible themes found')) {
      errorMessage = 'No performance themes found for this account';
      suggestions = [
        'Run theme discovery first: node run-theme-discovery.js',
        'Try lowering the confidence threshold to "low"',
        'The system will fall back to account-optimized generation'
      ];
      troubleshooting = {
        step1: 'Run: node run-theme-discovery.js --deploy-schema',
        step2: 'Wait for theme discovery to complete',
        step3: 'Try the request again'
      };
    } else if (error.message.includes('No suitable images found')) {
      errorMessage = 'No images match the account profile and theme criteria';
      suggestions = [
        'Run the content pipeline to scrape more images',
        'Check that images have been analyzed (aesthetic, colors, season)',
        'The system may need more diverse content in the database'
      ];
      troubleshooting = {
        step1: 'Run: node run-enhanced-pipeline.js',
        step2: 'Ensure images have AI analysis data',
        step3: 'Check database for analyzed images'
      };
    } else if (error.message.includes('database') || error.message.includes('connection')) {
      errorMessage = 'Database connection or schema error';
      suggestions = [
        'Check your Supabase credentials in .env',
        'Ensure all required tables exist',
        'Run schema deployment if needed'
      ];
      troubleshooting = {
        step1: 'Verify Supabase connection',
        step2: 'Check for account_profiles, discovered_themes, hook_slides tables',
        step3: 'Run: node run-theme-discovery.js --deploy-schema'
      };
    }

    res.status(500).json({ 
      error: errorMessage,
      suggestions,
      troubleshooting,
      fallback: {
        message: 'If ultimate generation fails, the system will attempt account-optimized generation as fallback',
        endpoints: [
          'POST /api/generate-ai-content (basic generation)',
          'POST /api/generate-for-account (account-optimized)',
          'POST /api/generate-performance-content (theme-based only)'
        ]
      }
    });
  }
}

// Helper function to calculate average confidence
function calculateAverageConfidence(posts) {
  const confidenceLevels = { 'low': 1, 'medium': 2, 'high': 3, 'very_high': 4 };
  const avgScore = posts.reduce((sum, post) => {
    return sum + (confidenceLevels[post.strategy?.confidenceLevel] || 2);
  }, 0) / posts.length;
  
  if (avgScore >= 3.5) return 'very_high';
  if (avgScore >= 2.5) return 'high';
  if (avgScore >= 1.5) return 'medium';
  return 'low';
}

// Helper function to generate recommendations
function generateRecommendations(result) {
  const recommendations = [];
  
  if (result.summary.hookSlidesUsed === 0) {
    recommendations.push('Consider creating more hook slides to improve engagement potential');
  }
  
  if (result.summary.themesUsed.length < 2) {
    recommendations.push('Run theme discovery more frequently to capture diverse high-performing patterns');
  }
  
  const avgThemeScore = result.posts
    .filter(p => p.themePerformanceScore)
    .reduce((sum, p) => sum + p.themePerformanceScore, 0) / 
    Math.max(1, result.posts.filter(p => p.themePerformanceScore).length);
    
  if (avgThemeScore < 70) {
    recommendations.push('Consider adjusting theme discovery criteria to find higher-performing patterns');
  }
  
  if (result.summary.totalCost > 0.10) {
    recommendations.push('Content generation cost is higher than usual - consider optimizing AI usage');
  }
  
  return recommendations;
} 