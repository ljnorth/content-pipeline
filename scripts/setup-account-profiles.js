import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupAccountProfiles() {
  try {
    console.log('🔧 Setting up account profiles table...\n');
    
    // Create account_profiles table if it doesn't exist
    const { error: createError } = await supabase.rpc('create_account_profiles_table');
    
    if (createError) {
      console.error('❌ Error creating table:', createError);
      return;
    }
    
    console.log('✅ Account profiles table created/verified\n');
    
    // Insert sample account profiles
    const sampleProfiles = [
      {
        username: 'fashionista_style',
        platform: 'instagram',
        aesthetic: 'Streetwear',
        target_vibe: 'Urban, edgy, street culture',
        content_focus: 'Street fashion, sneakers, urban lifestyle',
        hashtag_strategy: 'trending, streetwear, fashion, lifestyle',
        posting_frequency: 'daily',
        engagement_rate: 0.045,
        follower_count: 12500,
        is_active: true
      },
      {
        username: 'elegant_living',
        platform: 'instagram', 
        aesthetic: 'Elegant',
        target_vibe: 'Sophisticated, luxury, timeless',
        content_focus: 'High-end fashion, luxury lifestyle, elegance',
        hashtag_strategy: 'luxury, elegant, sophisticated, fashion',
        posting_frequency: '3x_week',
        engagement_rate: 0.032,
        follower_count: 8900,
        is_active: true
      },
      {
        username: 'casual_vibes',
        platform: 'instagram',
        aesthetic: 'Casual',
        target_vibe: 'Relaxed, comfortable, everyday style',
        content_focus: 'Casual fashion, comfort, daily outfits',
        hashtag_strategy: 'casual, comfort, everyday, style',
        posting_frequency: 'daily',
        engagement_rate: 0.038,
        follower_count: 15600,
        is_active: true
      }
    ];
    
    console.log('📝 Inserting sample account profiles...');
    
    for (const profile of sampleProfiles) {
      const { error: insertError } = await supabase
        .from('account_profiles')
        .upsert(profile, { onConflict: 'username' });
      
      if (insertError) {
        console.error(`❌ Error inserting ${profile.username}:`, insertError);
      } else {
        console.log(`✅ Added profile for @${profile.username}`);
      }
    }
    
    console.log('\n🎉 Account profiles setup complete!');
    console.log('📊 Sample profiles created:');
    sampleProfiles.forEach(profile => {
      console.log(`   • @${profile.username} (${profile.aesthetic} aesthetic)`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

setupAccountProfiles(); 