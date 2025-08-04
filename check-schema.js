import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkDatabaseSchema() {
  console.log('🔍 Checking current database schema and data...');
  
  // Get a sample record to see what fields exist
  const { data: sample, error } = await supabase
    .from('images')
    .select('*')
    .limit(1);
    
  if (!error && sample && sample.length > 0) {
    console.log('📋 Current fields in images table:');
    const fields = Object.keys(sample[0]);
    
    // Categorize the fields
    const hookFields = fields.filter(f => f.includes('hook') || f.includes('cover_slide'));
    const bgFields = fields.filter(f => f.includes('bg_') || f.includes('background') || f.includes('uniformity') || f.includes('suitable'));
    const otherFields = fields.filter(f => !hookFields.includes(f) && !bgFields.includes(f));
    
    console.log('\n🎯 Hook/Cover slide fields (duplicates):');
    hookFields.forEach(f => {
      const value = sample[0][f];
      console.log(`  - ${f}: ${value === null ? 'NULL' : value}`);
    });
    
    console.log('\n🗑️  Background analysis fields (to remove):');
    bgFields.forEach(f => {
      const value = sample[0][f];
      console.log(`  - ${f}: ${value === null ? 'NULL' : value}`);
    });
    
    console.log('\n✅ Other fields:');
    otherFields.slice(0, 10).forEach(f => {
      console.log(`  - ${f}`);
    });
    if (otherFields.length > 10) {
      console.log(`  ... and ${otherFields.length - 10} more fields`);
    }
    
    console.log(`\n📊 Total fields: ${fields.length}`);
  } else {
    console.log('❌ Error fetching sample data:', error?.message);
  }
}

checkDatabaseSchema().catch(console.error); 