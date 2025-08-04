import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function extractCoverSlideThemes() {
  console.log('🔍 Extracting cover slide texts as themes...');
  
  // Get all unique cover slide texts
  const { data, error } = await supabase
    .from('images')
    .select('cover_slide_text, post_id, aesthetic, season, occasion')
    .eq('is_cover_slide', true)
    .not('cover_slide_text', 'is', null)
    .limit(100);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  // Group by unique text and extract theme info
  const themeMap = new Map();
  
  data.forEach(item => {
    const text = item.cover_slide_text.trim();
    if (!themeMap.has(text)) {
      themeMap.set(text, {
        theme_name: text,
        post_count: 0,
        aesthetics: new Set(),
        seasons: new Set(),
        occasions: new Set(),
        post_ids: []
      });
    }
    
    const theme = themeMap.get(text);
    theme.post_count++;
    theme.post_ids.push(item.post_id);
    if (item.aesthetic) theme.aesthetics.add(item.aesthetic);
    if (item.season) theme.seasons.add(item.season);
    if (item.occasion) theme.occasions.add(item.occasion);
  });

  console.log(`\n✨ Found ${themeMap.size} unique cover slide themes:\n`);
  
  // Convert to themes and display
  const themes = Array.from(themeMap.entries()).map(([text, data]) => ({
    theme_name: text,
    description: `Theme based on cover slide: "${text}"`,
    post_count: data.post_count,
    aesthetic: Array.from(data.aesthetics)[0] || 'mixed',
    season: Array.from(data.seasons)[0] || 'any',
    occasion: Array.from(data.occasions)[0] || 'casual',
    keywords: text.toLowerCase().split(' ').filter(w => w.length > 2),
    hashtags: [`#${text.toLowerCase().replace(/[^a-z0-9]/g, '')}`],
    performance_score: 85 // High score since these are proven cover slides
  }));

  // Sort by post count (most popular first)
  themes.sort((a, b) => b.post_count - a.post_count);

  themes.forEach((theme, i) => {
    console.log(`${i + 1}. "${theme.theme_name}"`);
    console.log(`   📊 Used in ${theme.post_count} posts`);
    console.log(`   🎨 Aesthetic: ${theme.aesthetic}`);
    console.log(`   🗓️ Season: ${theme.season}`);
    console.log(`   🎯 Keywords: ${theme.keywords.join(', ')}`);
    console.log('');
  });

  console.log('💡 These cover slide texts can be converted to themes for the Ultimate Content Generator!');
  
  return themes;
}

extractCoverSlideThemes().catch(console.error); 