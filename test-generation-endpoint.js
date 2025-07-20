import fetch from 'node-fetch';

async function testGenerationEndpoint() {
    console.log('🧪 Testing generation endpoint on live site...');
    
    try {
        const response = await fetch('https://easypost.fun/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                imageCount: 5,
                performanceMetric: 'engagement_rate',
                diversityLevel: 'medium',
                maxPerPost: 2,
                filters: {
                    aesthetics: ['streetwear'],
                    colors: [],
                    occasions: [],
                    seasons: [],
                    additional: [],
                    usernames: []
                }
            })
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        const text = await response.text();
        console.log('Response body (first 500 chars):', text.substring(0, 500));
        
        if (response.ok) {
            try {
                const data = JSON.parse(text);
                console.log('✅ Success! Generated', data.images?.length || 0, 'images');
            } catch (parseError) {
                console.log('❌ Response is not valid JSON:', parseError.message);
            }
        } else {
            console.log('❌ Request failed with status:', response.status);
        }
        
    } catch (error) {
        console.log('❌ Network error:', error.message);
    }
}

testGenerationEndpoint(); 