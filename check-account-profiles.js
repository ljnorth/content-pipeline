import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkAccountProfiles() {
  console.log('👤 Checking account profiles in database...\n');

  try {
    const { data: profiles, error } = await supabase
      .from('account_profiles')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch account profiles: ${error.message}`);
    }

    if (!profiles || profiles.length === 0) {
      console.log('❌ No active account profiles found in database.');
      console.log('💡 You need to create account profiles before generating content.');
      console.log('   Use the web interface or API to add account profiles.');
      return;
    }

    console.log(`✅ Found ${profiles.length} active account profiles:\n`);

    profiles.forEach((profile, index) => {
      console.log(`${index + 1}. @${profile.username}`);
      console.log(`   Display Name: ${profile.display_name || 'N/A'}`);
      console.log(`   Target Audience: ${profile.target_audience?.age || 'N/A'} ${profile.target_audience?.gender || 'N/A'}`);
      console.log(`   Aesthetic Focus: ${profile.content_strategy?.aestheticFocus?.join(', ') || 'N/A'}`);
      console.log(`   Created: ${new Date(profile.created_at).toLocaleDateString()}`);
      console.log('');
    });

    console.log('💡 These are the accounts available for content generation.');
    console.log('   Only use accounts from this list for generating posts.');

  } catch (error) {
    console.error('❌ Error checking account profiles:', error.message);
  }
}

checkAccountProfiles(); 