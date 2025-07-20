import { createClient } from '@supabase/supabase-js';

// Your Supabase project details
const SUPABASE_URL = 'https://oxskatabfilwdufzqdzd.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94c2thdGFiZmlsd2R1ZnpxZHpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE0MTgyMSwiZXhwIjoyMDY3NzE3ODIxfQ.wkAks1_fBnao79luJgQra5ESJxgLZxFTwOzDkr_mNCs';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testContentGeneration() {
    try {
        console.log('🧪 Testing Content Generation');
        console.log('=============================\n');

        // Test with your account
        const account = {
            username: 'aestheticgirl3854',
            display_name: 'aestheticgirl',
            content_strategy: {
                aestheticFocus: ['minimalist', 'streetwear', 'vintage'],
                colorPalette: ['navy', 'white', 'black'],
                brandVoice: 'authentic',
                contentTypes: ['fashion', 'outfit'],
                postingStyle: 'casual'
            },
            target_audience: {
                age: '16-20',
                location: 'US',
                interests: ['fashion', 'school outfits', 'outfit inspo', 'brandy melville'],
                demographics: 'General'
            },
            performance_goals: {
                targetRate: 0.1,
                primaryMetric: 'comments',
                secondaryMetric: 'reach'
            }
        };

        console.log('🎯 Testing image curation for account:', account.username);
        
        // Test image curation directly with Supabase
        let query = supabase
            .from('images')
            .select('id, image_path, aesthetic, colors, season, occasion, username, post_id, additional')
            .not('aesthetic', 'is', null)
            .order('created_at', { ascending: false })
            .limit(50);

        const { data: allImages, error } = await query;
        
        if (error) {
            throw new Error(`Failed to fetch images: ${error.message}`);
        }

        console.log(`📊 Found ${allImages?.length || 0} total images with aesthetics`);

        // Filter images in JavaScript based on account preferences
        let filteredImages = allImages || [];

        // Apply aesthetic filters
        if (account.content_strategy?.aestheticFocus?.length > 0) {
            const aesthetics = account.content_strategy.aestheticFocus.filter(a => a && a.trim() !== '');
            if (aesthetics.length > 0) {
                filteredImages = filteredImages.filter(img => 
                    img.aesthetic && aesthetics.some(aesthetic => 
                        img.aesthetic.toLowerCase().includes(aesthetic.toLowerCase())
                    )
                );
            }
        }

        // Apply color filters
        if (account.content_strategy?.colorPalette?.length > 0) {
            const colors = account.content_strategy.colorPalette.filter(c => c && c.trim() !== '');
            if (colors.length > 0) {
                filteredImages = filteredImages.filter(img => 
                    img.colors && Array.isArray(img.colors) && colors.some(color => 
                        img.colors.some(imgColor => imgColor.toLowerCase().includes(color.toLowerCase()))
                    )
                );
            }
        }

        console.log(`🎯 After filtering: ${filteredImages.length} images match account preferences`);

        if (filteredImages && filteredImages.length > 0) {
            console.log('\n✅ Sample images found:');
            filteredImages.slice(0, 5).forEach((img, i) => {
                console.log(`  ${i + 1}. ${img.aesthetic} (${img.colors?.join(', ') || 'no colors'}) - ${img.season}`);
            });

            if (filteredImages.length >= 5) {
                console.log('\n🎉 SUCCESS: Content generation should work now!');
                console.log('You have enough images to generate posts.');
            } else {
                console.log(`\n⚠️ Found ${filteredImages.length} images, but need 5 for a post.`);
            }
        } else {
            console.log('\n❌ No images found matching the criteria.');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testContentGeneration(); 