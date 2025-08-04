import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkAvailableAccounts() {
  console.log('📊 Checking accounts with images in database...');
  
  try {
    const { data, error } = await supabase
      .from('images')
      .select('username')
      .not('username', 'is', null)
      .not('image_path', 'is', null)
      .limit(1000);
    
    if (error) {
      console.log('❌ Error:', error);
      return;
    }
    
    const accountCounts = {};
    data.forEach(img => {
      accountCounts[img.username] = (accountCounts[img.username] || 0) + 1;
    });
    
    const accounts = Object.entries(accountCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
    
    console.log(`\n✅ Found ${Object.keys(accountCounts).length} accounts with images:`);
    console.log('👥 Top accounts by image count:');
    
    accounts.forEach(([account, count]) => {
      console.log(`  • ${account}: ${count} images`);
    });
    
    if (accounts.length > 0) {
      const topAccount = accounts[0][0];
      console.log(`\n💡 To test MVP generation, try:`);
      console.log(`   node run-mvp-content.js ${topAccount} --no-slack`);
    }
    
  } catch (error) {
    console.log('❌ Error checking accounts:', error.message);
  }
}

checkAvailableAccounts(); 