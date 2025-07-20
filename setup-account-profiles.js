import { SupabaseClient } from './src/database/supabase-client.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Use service role for schema operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupAccountProfiles() {
  try {
    console.log('🚀 Setting up account profiles schema...\n');
    
    // First, let's just create the sample account profile using upsert
    console.log('📝 Creating sample account profile...');
    const { error: insertError } = await supabase
      .from('account_profiles')
      .upsert({
        username: 'fashionista_lj',
        display_name: 'Fashion LJ',
        account_type: 'owned',
        target_audience: {
          age: '18-25',
          interests: ['streetwear', 'sneakers', 'urban culture'],
          location: 'urban',
          gender: 'mixed'
        },
        content_strategy: {
          aestheticFocus: ['streetwear', 'casual', 'urban'],
          colorPalette: ['neutral', 'earth tones'],
          contentTypes: ['outfit posts', 'styling tips'],
          postingStyle: 'authentic'
        },
        performance_goals: {
          primaryMetric: 'likes',
          targetRate: 0.08,
          secondaryMetric: 'saves',
          growthGoal: 'engagement'
        },
        posting_schedule: {
          frequency: 'daily',
          bestTimes: ['18:00', '20:00', '12:00'],
          timezone: 'EST'
        }
      });
    
    if (insertError) {
      console.log('⚠️  Table may not exist yet. Let me check what tables we have...');
      
      // Check what tables exist
      const { data: tables, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');
      
      if (!tablesError) {
        console.log('📊 Existing tables:');
        tables.forEach(table => console.log(`   - ${table.table_name}`));
      }
      
      console.log('\n💡 You need to create the account_profiles table in your Supabase dashboard.');
      console.log('📝 Go to: https://supabase.com/dashboard/project/oxskatabfilwdufzqdzd/editor');
      console.log('🔧 Run this SQL in the SQL Editor:');
      console.log(`
CREATE TABLE account_profiles (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  account_type VARCHAR(50) DEFAULT 'owned',
  platform VARCHAR(50) DEFAULT 'tiktok',
  target_audience JSONB DEFAULT '{}',
  content_strategy JSONB DEFAULT '{}',
  performance_goals JSONB DEFAULT '{}',
  posting_schedule JSONB DEFAULT '{}',
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  total_posts INTEGER DEFAULT 0,
  avg_engagement_rate DECIMAL(5,4) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE generated_posts (
  id SERIAL PRIMARY KEY,
  account_username VARCHAR(255) NOT NULL,
  generation_id VARCHAR(255),
  image_paths TEXT[],
  selected_image_path TEXT,
  caption TEXT,
  hashtags TEXT[],
  platform_post_id VARCHAR(255),
  posted_at TIMESTAMP WITH TIME ZONE,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  saves_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,4) DEFAULT 0,
  performance_snapshots JSONB DEFAULT '[]',
  last_performance_check TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE performance_analytics (
  id SERIAL PRIMARY KEY,
  account_username VARCHAR(255) NOT NULL,
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  period_type VARCHAR(50),
  aesthetic_performance JSONB DEFAULT '{}',
  color_performance JSONB DEFAULT '{}',
  posting_time_performance JSONB DEFAULT '{}',
  total_posts INTEGER DEFAULT 0,
  avg_engagement_rate DECIMAL(5,4) DEFAULT 0,
  best_performing_aesthetic VARCHAR(255),
  best_performing_time VARCHAR(10),
  insights JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
      `);
      
      return;
    }
    
    console.log('✅ Account profiles schema setup complete!\n');
    
    // Verify the setup
    console.log('🔍 Verifying setup...');
    const { data: profiles, error: verifyError } = await supabase
      .from('account_profiles')
      .select('*');
    
    if (verifyError) {
      console.error('❌ Error verifying setup:', verifyError);
      return;
    }
    
    console.log(`📊 Found ${profiles.length} account profiles:`);
    profiles.forEach(profile => {
      console.log(`   - ${profile.username} (${profile.display_name})`);
      console.log(`     Target: ${profile.target_audience.age}, ${profile.target_audience.interests.join(', ')}`);
      console.log(`     Focus: ${profile.content_strategy.aestheticFocus.join(', ')}`);
      console.log(`     Goal: ${profile.performance_goals.targetRate * 100}% ${profile.performance_goals.primaryMetric}\n`);
    });
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  }
}

setupAccountProfiles(); 