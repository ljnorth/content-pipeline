import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function applyRerollMigration() {
  console.log('🔄 Applying reroll tracking migration...');

  try {
    // Check if columns already exist
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'preview_batches')
      .in('column_name', ['reroll_count', 'reroll_history']);

    if (columnsError) {
      console.error('❌ Error checking columns:', columnsError);
      return;
    }

    const existingColumns = columns.map(col => col.column_name);
    console.log('📊 Existing columns:', existingColumns);

    if (existingColumns.includes('reroll_count') && existingColumns.includes('reroll_history')) {
      console.log('✅ Reroll tracking columns already exist');
      return;
    }

    // Add reroll_count column if it doesn't exist
    if (!existingColumns.includes('reroll_count')) {
      console.log('➕ Adding reroll_count column...');
      const { error: countError } = await supabase
        .rpc('exec_sql', { 
          sql: 'ALTER TABLE preview_batches ADD COLUMN reroll_count INTEGER DEFAULT 0;' 
        });
      
      if (countError) {
        console.log('⚠️ reroll_count column might already exist or need manual addition');
      } else {
        console.log('✅ Added reroll_count column');
      }
    }

    // Add reroll_history column if it doesn't exist
    if (!existingColumns.includes('reroll_history')) {
      console.log('➕ Adding reroll_history column...');
      const { error: historyError } = await supabase
        .rpc('exec_sql', { 
          sql: 'ALTER TABLE preview_batches ADD COLUMN reroll_history JSONB DEFAULT \'[]\';' 
        });
      
      if (historyError) {
        console.log('⚠️ reroll_history column might already exist or need manual addition');
      } else {
        console.log('✅ Added reroll_history column');
      }
    }

    console.log('🎉 Reroll tracking migration completed!');

  } catch (error) {
    console.error('❌ Migration error:', error);
  }
}

applyRerollMigration(); 