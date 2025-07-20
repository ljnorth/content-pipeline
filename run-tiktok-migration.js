import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Your Supabase project details
const SUPABASE_URL = 'https://oxskatabfilwdufzqdzd.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94c2thdGFiZmlsd2R1ZnpxZHpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE0MTgyMSwiZXhwIjoyMDY3NzE3ODIxfQ.wkAks1_fBnao79luJgQra5ESJxgLZxFTwOzDkr_mNCs';

// Create Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runMigration() {
    try {
        console.log('🚀 Starting TikTok columns migration...');
        
        // Read the migration SQL
        const migrationSQL = fs.readFileSync('add-tiktok-columns.sql', 'utf8');
        
        console.log('📝 Migration SQL:');
        console.log(migrationSQL);
        
        // Execute the migration using rpc
        const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
        
        if (error) {
            console.error('❌ Migration failed:', error);
            
            // If rpc doesn't work, try direct SQL execution
            console.log('🔄 Trying alternative method...');
            const { data: data2, error: error2 } = await supabase
                .from('account_profiles')
                .select('*')
                .limit(1);
                
            if (error2) {
                console.error('❌ Database connection test failed:', error2);
                return;
            }
            
            console.log('✅ Database connection successful');
            console.log('📋 Please run the migration manually in the Supabase dashboard SQL editor');
            console.log('🔗 Go to: https://supabase.com/dashboard/project/oxskatabfilwdufzqdzd/sql');
            console.log('📝 Copy and paste the SQL from add-tiktok-columns.sql');
            
        } else {
            console.log('✅ Migration completed successfully!');
            console.log('📊 Result:', data);
        }
        
    } catch (err) {
        console.error('❌ Unexpected error:', err);
        console.log('📋 Please run the migration manually in the Supabase dashboard SQL editor');
        console.log('🔗 Go to: https://supabase.com/dashboard/project/oxskatabfilwdufzqdzd/sql');
        console.log('📝 Copy and paste the SQL from add-tiktok-columns.sql');
    }
}

runMigration(); 