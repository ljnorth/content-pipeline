import fetch from 'node-fetch';

async function testWorkflowEndpoint() {
    console.log('🧪 Testing workflow generation endpoint...');
    
    try {
        const response = await fetch('https://easypost.fun/api/generate-workflow-content', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                accountUsername: 'aestheticgirl3854', // Use your test account
                postCount: 1,
                imageCount: 3
            })
        });
        
        console.log('Response status:', response.status);
        
        const text = await response.text();
        console.log('Response body (first 500 chars):', text.substring(0, 500));
        
        if (response.ok) {
            try {
                const data = JSON.parse(text);
                console.log('✅ Success! Generated', data.posts?.length || 0, 'posts');
                console.log('Generation ID:', data.generation?.id);
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

testWorkflowEndpoint(); 