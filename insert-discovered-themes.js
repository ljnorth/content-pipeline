import { config } from 'dotenv';
config();

import { SupabaseClient } from './src/database/supabase-client.js';
import { Logger } from './src/utils/logger.js';

const logger = new Logger();
const db = new SupabaseClient();

// The themes we discovered from the theme discovery run
const discoveredThemes = [
  {
    theme_name: "Urban Edge",
    description: "Embrace the bold and dynamic spirit of urban streetwear this Spring/Summer with a focus on edgy aesthetics and monochromatic tones.",
    keywords: ["urban", "edge", "streetwear", "bold", "dynamic"],
    hashtags: ["#urbanedge", "#streetwear", "#edgy", "#monochromatic"],
    aesthetic: "urban",
    season: "spring",
    occasion: "casual",
    colors: ["black", "white", "grey"],
    avg_engagement_rate: 24.9575,
    post_count: 4,
    performance_score: 100.0,
    confidence_level: "low",
    is_active: true
  },
  {
    theme_name: "Chic Summer Escapes",
    description: "Embrace effortless style with a blend of casual aesthetics perfect for summer outings. This theme highlights versatile outfits that combine comfort and trendiness, ideal for sunny adventures.",
    keywords: ["chic", "summer", "escapes", "effortless", "casual"],
    hashtags: ["#chicsummer", "#summervibes", "#effortless", "#casual"],
    aesthetic: "casual",
    season: "summer",
    occasion: "casual",
    colors: ["light", "bright", "summery"],
    avg_engagement_rate: 24.9271,
    post_count: 7,
    performance_score: 100.0,
    confidence_level: "medium",
    is_active: true
  },
  {
    theme_name: "Spring Casual Chic",
    description: "Embrace the effortless elegance of spring with a collection of casual outfits that blend comfort and style, perfect for everyday wear.",
    keywords: ["spring", "casual", "chic", "effortless", "elegance"],
    hashtags: ["#springchic", "#casualstyle", "#effortless", "#spring"],
    aesthetic: "casual",
    season: "spring",
    occasion: "everyday",
    colors: ["pastels", "light", "spring"],
    avg_engagement_rate: 24.0140,
    post_count: 5,
    performance_score: 100.0,
    confidence_level: "medium",
    is_active: true
  },
  {
    theme_name: "Autumn Casual Chic",
    description: "Cozy autumn outfits with warm colors and layering, perfect for fall weather and casual occasions.",
    keywords: ["autumn", "casual", "chic", "cozy", "layering"],
    hashtags: ["#autumnchic", "#fallvibes", "#cozy", "#layering"],
    aesthetic: "casual",
    season: "autumn",
    occasion: "casual",
    colors: ["warm", "earth tones", "autumn"],
    avg_engagement_rate: 21.01,
    post_count: 42,
    performance_score: 95.0,
    confidence_level: "high",
    is_active: true
  },
  {
    theme_name: "Urban Autumn Aesthetics",
    description: "Urban style meets autumn vibes with sophisticated street fashion and seasonal colors.",
    keywords: ["urban", "autumn", "aesthetics", "street", "sophisticated"],
    hashtags: ["#urbanautumn", "#streetfashion", "#fallstyle", "#urban"],
    aesthetic: "urban",
    season: "autumn",
    occasion: "casual",
    colors: ["earth tones", "dark", "autumn"],
    avg_engagement_rate: 21.2725,
    post_count: 28,
    performance_score: 92.0,
    confidence_level: "high",
    is_active: true
  }
];

async function insertThemes() {
  logger.info('🚀 Inserting discovered themes into database...');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const theme of discoveredThemes) {
    try {
      const { error } = await db.client
        .from('discovered_themes')
        .upsert(theme, { 
          onConflict: 'theme_name',
          ignoreDuplicates: false 
        });

      if (error) {
        logger.error(`❌ Failed to insert theme "${theme.theme_name}": ${error.message}`);
        errorCount++;
      } else {
        logger.info(`✅ Inserted theme: "${theme.theme_name}"`);
        successCount++;
      }

    } catch (error) {
      logger.error(`❌ Error inserting theme "${theme.theme_name}": ${error.message}`);
      errorCount++;
    }
  }
  
  logger.info(`🎉 Theme insertion complete: ${successCount} successful, ${errorCount} failed`);
  return { successCount, errorCount };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  insertThemes()
    .then(() => {
      logger.info('✅ Theme insertion completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      logger.error(`❌ Theme insertion failed: ${error.message}`);
      process.exit(1);
    });
} 