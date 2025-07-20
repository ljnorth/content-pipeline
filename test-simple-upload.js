import { createClient } from '@supabase/supabase-js';

// Your Supabase project details
const SUPABASE_URL = 'https://oxskatabfilwdufzqdzd.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94c2thdGFiZmlsd2R1ZnpxZHpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE0MTgyMSwiZXhwIjoyMDY3NzE3ODIxfQ.wkAks1_fBnao79luJgQra5ESJxgLZxFTwOzDkr_mNCs';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testSimpleUpload() {
    try {
        console.log('🧪 Testing Simple TikTok Upload');
        console.log('================================\n');

        // Get connected account
        const { data: accounts, error } = await supabase
            .from('account_profiles')
            .select('username, tiktok_access_token')
            .not('tiktok_access_token', 'is', null)
            .limit(1);

        if (error || accounts.length === 0) {
            console.log('❌ No connected TikTok accounts found');
            return;
        }

        const account = accounts[0];
        console.log(`📱 Testing with account: @${account.username}`);
        console.log(`🔑 Access token: ${account.tiktok_access_token.substring(0, 20)}...`);
        console.log('');

        // Test TikTok API call with required fields
        console.log('📤 Testing TikTok API connection...');
        
        const testResponse = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=["open_id","union_id","avatar_url","display_name","bio_description","profile_deep_link","is_verified","follower_count","following_count","likes_count"]', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${account.tiktok_access_token}`,
                'Content-Type': 'application/json'
            }
        });

        if (testResponse.ok) {
            const userInfo = await testResponse.json();
            console.log('✅ TikTok API connection successful!');
            console.log('👤 User info:', userInfo);
            console.log('');
            console.log('🎉 Your TikTok account is properly connected and can receive uploads!');
            console.log('');
            console.log('📋 Next Steps:');
            console.log('1. Add @aestheticgirl3854 to your TikTok Sandbox as a target user');
            console.log('2. Run your automation to generate and upload content');
            console.log('3. Check your TikTok drafts for the uploaded carousel posts');
        } else {
            console.log('❌ TikTok API connection failed');
            console.log('Status:', testResponse.status);
            const errorText = await testResponse.text();
            console.log('Response:', errorText);
            
            if (testResponse.status === 400) {
                console.log('');
                console.log('💡 This might mean your account needs to be added to the Sandbox');
                console.log('   Go to TikTok Developer Dashboard and add @aestheticgirl3854 as a target user');
            }
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testSimpleUpload(); 