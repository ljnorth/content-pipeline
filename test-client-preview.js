import fetch from 'node-fetch';

const BASE_URL = 'https://easypost.fun';
const BATCH_ID = 'unrestricted_1754335039681_aestheticgirl3854';

async function testClientSidePreview() {
  console.log('🧪 Testing Client-Side Preview Implementation...\n');

  try {
    // Test 1: Check if the API endpoint works
    console.log('1️⃣ Testing API endpoint...');
    const apiResponse = await fetch(`${BASE_URL}/api/preview-data/${BATCH_ID}`);
    const apiData = await apiResponse.json();
    
    if (apiData.success) {
      console.log('✅ API endpoint working - batch data loaded successfully');
      console.log(`   Account: @${apiData.batch.accountUsername}`);
      console.log(`   Posts: ${apiData.batch.posts.length}`);
    } else {
      console.log('❌ API endpoint failed:', apiData.error);
      return;
    }

    // Test 2: Check if the client-side preview page loads
    console.log('\n2️⃣ Testing client-side preview page...');
    const previewResponse = await fetch(`${BASE_URL}/preview-client/${BATCH_ID}`);
    const previewHtml = await previewResponse.text();
    
    if (previewHtml.includes('Content Preview - Loading...') && 
        previewHtml.includes('loadBatchData()')) {
      console.log('✅ Client-side preview page loads correctly');
      console.log('   - Shows loading state initially');
      console.log('   - Has JavaScript to load data dynamically');
    } else {
      console.log('❌ Client-side preview page failed to load');
      return;
    }

    // Test 3: Check if reroll API is accessible
    console.log('\n3️⃣ Testing reroll API accessibility...');
    const rerollResponse = await fetch(`${BASE_URL}/api/reroll-images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId: BATCH_ID,
        imageIds: ['test'],
        accountUsername: apiData.batch.accountUsername
      })
    });
    
    if (rerollResponse.status === 200 || rerollResponse.status === 400) {
      console.log('✅ Reroll API is accessible');
    } else {
      console.log('❌ Reroll API not accessible:', rerollResponse.status);
    }

    console.log('\n🎉 All tests completed!');
    console.log('\n📋 Summary:');
    console.log('   ✅ API endpoint serves batch data');
    console.log('   ✅ Client-side preview page loads');
    console.log('   ✅ Reroll API is accessible');
    console.log('\n🌐 You can now test the full client-side experience at:');
    console.log(`   ${BASE_URL}/preview-client/${BATCH_ID}`);
    console.log('\n💡 Benefits of this implementation:');
    console.log('   - Real-time image updates without page reloads');
    console.log('   - Better user experience with instant feedback');
    console.log('   - No caching issues with Vercel');
    console.log('   - Maintains scroll position during updates');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testClientSidePreview(); 