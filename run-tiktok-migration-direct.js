import { createClient } from '@supabase/supabase-js';

// Your Supabase project details
const SUPABASE_URL = 'https://oxskatabfilwdufzqdzd.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94c2thdGFiZmlsd2R1ZnpxZHpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE0MTgyMSwiZXhwIjoyMDY3NzE3ODIxfQ.wkAks1_fBnao79luJgQra5ESJxgLZxFTwOzDkr_mNCs';

// Create Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runMigration() {
    try {
        console.log('🚀 Starting TikTok columns migration...');
        
        // Test database connection first
        console.log('🔍 Testing database connection...');
        const { data: testData, error: testError } = await supabase
            .from('account_profiles')
            .select('username')
            .limit(1);
            
        if (testError) {
            console.error('❌ Database connection failed:', testError);
            return;
        }
        
        console.log('✅ Database connection successful');
        console.log('📊 Found existing accounts:', testData?.length || 0);
        
        // Check if columns already exist
        console.log('🔍 Checking existing columns...');
        const { data: columns, error: columnsError } = await supabase
            .from('account_profiles')
            .select('*')
            .limit(1);
            
        if (columnsError) {
            console.error('❌ Error checking columns:', columnsError);
            return;
        }
        
        const existingColumns = Object.keys(columns[0] || {});
        console.log('📋 Existing columns:', existingColumns);
        
        const requiredColumns = [
            'tiktok_access_token',
            'tiktok_refresh_token', 
            'tiktok_expires_at',
            'tiktok_connected_at'
        ];
        
        const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
        
        if (missingColumns.length === 0) {
            console.log('✅ All TikTok columns already exist!');
            return;
        }
        
        console.log('📝 Missing columns:', missingColumns);
        console.log('📋 Please run the migration manually in the Supabase dashboard SQL editor');
        console.log('🔗 Go to: https://supabase.com/dashboard/project/oxskatabfilwdufzqdzd/sql');
        console.log('📝 Copy and paste this SQL:');
        console.log('');
        console.log('-- Add TikTok API connection columns if they don\'t exist');
        console.log('DO $$ ');
        console.log('BEGIN');
        console.log('    -- Add tiktok_access_token column');
        console.log('    IF NOT EXISTS (SELECT 1 FROM information_schema.columns ');
        console.log('                   WHERE table_name = \'account_profiles\' ');
        console.log('                   AND column_name = \'tiktok_access_token\') THEN');
        console.log('        ALTER TABLE account_profiles ADD COLUMN tiktok_access_token TEXT;');
        console.log('    END IF;');
        console.log('    ');
        console.log('    -- Add tiktok_refresh_token column');
        console.log('    IF NOT EXISTS (SELECT 1 FROM information_schema.columns ');
        console.log('                   WHERE table_name = \'account_profiles\' ');
        console.log('                   AND column_name = \'tiktok_refresh_token\') THEN');
        console.log('        ALTER TABLE account_profiles ADD COLUMN tiktok_refresh_token TEXT;');
        console.log('    END IF;');
        console.log('    ');
        console.log('    -- Add tiktok_expires_at column');
        console.log('    IF NOT EXISTS (SELECT 1 FROM information_schema.columns ');
        console.log('                   WHERE table_name = \'account_profiles\' ');
        console.log('                   AND column_name = \'tiktok_expires_at\') THEN');
        console.log('        ALTER TABLE account_profiles ADD COLUMN tiktok_expires_at TIMESTAMP WITH TIME ZONE;');
        console.log('    END IF;');
        console.log('    ');
        console.log('    -- Add tiktok_connected_at column');
        console.log('    IF NOT EXISTS (SELECT 1 FROM information_schema.columns ');
        console.log('                   WHERE table_name = \'account_profiles\' ');
        console.log('                   AND column_name = \'tiktok_connected_at\') THEN');
        console.log('        ALTER TABLE account_profiles ADD COLUMN tiktok_connected_at TIMESTAMP WITH TIME ZONE;');
        console.log('    END IF;');
        console.log('    ');
        console.log('    RAISE NOTICE \'TikTok columns added successfully to account_profiles table\';');
        console.log('END $$;');
        
    } catch (err) {
        console.error('❌ Unexpected error:', err);
        console.log('📋 Please run the migration manually in the Supabase dashboard SQL editor');
        console.log('🔗 Go to: https://supabase.com/dashboard/project/oxskatabfilwdufzqdzd/sql');
    }
}

runMigration(); 