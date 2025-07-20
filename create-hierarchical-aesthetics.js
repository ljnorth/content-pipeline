import { SupabaseClient } from './src/database/supabase-client.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const db = new SupabaseClient();

// Hierarchical aesthetic taxonomy
const AESTHETIC_HIERARCHY = {
  // Main aesthetic families
  'streetwear': {
    name: 'Streetwear',
    description: 'Urban, casual, street-inspired fashion',
    color: '#FF6B35',
    subcategories: ['urban', 'casual', 'y2k', 'grunge'],
    standalone: true // Can be selected alone
  },
  
  'elevated': {
    name: 'Elevated',
    description: 'Sophisticated, refined, put-together looks',
    color: '#2E86AB',
    subcategories: ['chic', 'minimalist', 'preppy', 'glamorous'],
    standalone: true
  },
  
  'vintage': {
    name: 'Vintage',
    description: 'Retro, throwback, nostalgic styles',
    color: '#A23B72',
    subcategories: ['y2k'],
    standalone: true
  },
  
  'lifestyle': {
    name: 'Lifestyle',
    description: 'Activity or occasion-specific looks',
    color: '#F18F01',
    subcategories: ['athleisure', 'coastal', 'floral'],
    standalone: true
  },
  
  // Mood/vibe modifiers (can be combined with main categories)
  'casual': {
    name: 'Casual',
    description: 'Relaxed, comfortable, everyday',
    color: '#C73E1D',
    type: 'modifier',
    combinesWith: ['streetwear', 'elevated', 'vintage']
  },
  
  'urban': {
    name: 'Urban',
    description: 'City-inspired, downtown vibes',
    color: '#5D737E',
    type: 'modifier',
    combinesWith: ['streetwear', 'elevated']
  },
  
  'chic': {
    name: 'Chic',
    description: 'Stylish, fashionable, effortless',
    color: '#64A6BD',
    type: 'modifier',
    combinesWith: ['elevated', 'streetwear']
  },
  
  'y2k': {
    name: 'Y2K',
    description: '2000s nostalgic, tech-inspired',
    color: '#DA4167',
    type: 'era',
    combinesWith: ['streetwear', 'vintage']
  },
  
  'grunge': {
    name: 'Grunge',
    description: 'Edgy, alternative, rock-inspired',
    color: '#3C1518',
    type: 'mood',
    combinesWith: ['streetwear', 'vintage']
  },
  
  'minimalist': {
    name: 'Minimalist',
    description: 'Clean, simple, understated',
    color: '#8E9AAF',
    type: 'mood',
    combinesWith: ['elevated', 'streetwear']
  },
  
  'athleisure': {
    name: 'Athleisure',
    description: 'Athletic-inspired, sporty',
    color: '#90A955',
    type: 'category',
    standalone: true
  },
  
  'preppy': {
    name: 'Preppy',
    description: 'Classic, traditional, polished',
    color: '#4F5D75',
    type: 'mood',
    combinesWith: ['elevated']
  },
  
  'glamorous': {
    name: 'Glamorous',
    description: 'Luxurious, dramatic, high-end',
    color: '#B07156',
    type: 'mood',
    combinesWith: ['elevated']
  },
  
  'floral': {
    name: 'Floral',
    description: 'Feminine, botanical, nature-inspired',
    color: '#E09F7D',
    type: 'pattern',
    combinesWith: ['elevated', 'vintage', 'lifestyle']
  },
  
  'coastal': {
    name: 'Coastal',
    description: 'Beach-inspired, relaxed, nautical',
    color: '#95B8D1',
    type: 'lifestyle',
    combinesWith: ['lifestyle', 'casual']
  },
  
  'lingerie': {
    name: 'Lingerie',
    description: 'Intimate, delicate, feminine',
    color: '#E8B4CB',
    type: 'category',
    standalone: true
  }
};

// Suggested combinations for better moodboards
const SUGGESTED_COMBINATIONS = [
  ['streetwear', 'casual', 'urban'],
  ['streetwear', 'y2k'],
  ['streetwear', 'grunge'],
  ['elevated', 'chic', 'minimalist'],
  ['elevated', 'preppy'],
  ['vintage', 'y2k'],
  ['lifestyle', 'athleisure'],
  ['lifestyle', 'coastal', 'casual'],
  ['elevated', 'glamorous'],
  ['streetwear', 'urban', 'chic']
];

async function createHierarchicalSystem() {
  try {
    console.log('🎨 Creating hierarchical aesthetic system...\n');
    
    // Get current aesthetic distribution
    const { data: images, error } = await db.client
      .from('images')
      .select('aesthetic')
      .not('aesthetic', 'is', null);
    
    if (error) {
      console.error('❌ Error fetching images:', error);
      return;
    }
    
    const aestheticCounts = {};
    images.forEach(img => {
      aestheticCounts[img.aesthetic] = (aestheticCounts[img.aesthetic] || 0) + 1;
    });
    
    console.log('📊 Current aesthetic distribution:');
    console.log('=================================');
    
    // Group by hierarchy type
    const mainCategories = [];
    const modifiers = [];
    const specialized = [];
    
    Object.entries(AESTHETIC_HIERARCHY).forEach(([key, config]) => {
      const count = aestheticCounts[key] || 0;
      const item = { key, config, count };
      
      if (config.standalone) {
        mainCategories.push(item);
      } else if (config.type === 'modifier' || config.type === 'mood') {
        modifiers.push(item);
      } else {
        specialized.push(item);
      }
    });
    
    console.log('🎯 MAIN CATEGORIES (can stand alone):');
    mainCategories.forEach(({ key, config, count }) => {
      console.log(`   ${config.name} (${count} images) - ${config.description}`);
    });
    
    console.log('\n🎨 MODIFIERS (combine with main categories):');
    modifiers.forEach(({ key, config, count }) => {
      console.log(`   ${config.name} (${count} images) - ${config.description}`);
      console.log(`     → Combines with: ${config.combinesWith.join(', ')}`);
    });
    
    console.log('\n⚡ SPECIALIZED (specific use cases):');
    specialized.forEach(({ key, config, count }) => {
      console.log(`   ${config.name} (${count} images) - ${config.description}`);
    });
    
    console.log('\n💡 SUGGESTED COMBINATIONS for moodboards:');
    console.log('==========================================');
    SUGGESTED_COMBINATIONS.forEach((combo, i) => {
      const names = combo.map(key => AESTHETIC_HIERARCHY[key]?.name || key);
      const totalImages = combo.reduce((sum, key) => sum + (aestheticCounts[key] || 0), 0);
      console.log(`${i + 1}. ${names.join(' + ')} (${totalImages} total images)`);
    });
    
    console.log('\n🔥 EXAMPLE: "Streetwear + Casual + Urban" moodboard would include:');
    const exampleCombo = ['streetwear', 'casual', 'urban'];
    const exampleTotal = exampleCombo.reduce((sum, key) => sum + (aestheticCounts[key] || 0), 0);
    console.log(`   → ${exampleTotal} images total`);
    console.log(`   → Perfect for: relaxed city vibes, everyday streetwear`);
    
    console.log('\n🎨 WEB UI IMPLEMENTATION:');
    console.log('========================');
    console.log('Instead of single dropdown, create:');
    console.log('1. ✅ Multi-select checkboxes grouped by category');
    console.log('2. ✅ Suggested combination buttons');
    console.log('3. ✅ Visual color coding for each aesthetic');
    console.log('4. ✅ Live preview of total images for selection');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createHierarchicalSystem(); 