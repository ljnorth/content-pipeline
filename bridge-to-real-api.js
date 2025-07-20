import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Configuration
const REAL_API_BASE = process.env.REAL_API_BASE || 'https://easypost.fun'; // Your deployed API
const PORT = 3003;

console.log(`🌉 API Bridge starting...`);
console.log(`🔗 Real API: ${REAL_API_BASE}`);
console.log(`🔗 Slack: ${process.env.SLACK_WEBHOOK_URL ? 'Configured ✅' : 'Not configured ❌'}`);

// Bridge endpoint: Connect simple UI to real content generation
app.post('/api/bridge-generate-workflow', async (req, res) => {
  try {
    const { accountUsername, postCount = 3, imageCount = 2 } = req.body;
    
    console.log(`🚀 Bridging workflow request for @${accountUsername}`);
    console.log(`📊 Requested: ${postCount} posts, ${imageCount} images each`);
    
    // Step 1: Call your REAL content generation endpoint
    console.log(`🎨 Calling real generation: ${REAL_API_BASE}/api/generate-workflow-content`);
    
    const generationResponse = await fetch(`${REAL_API_BASE}/api/generate-workflow-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accountUsername,
        postCount,
        imageCount
      })
    });

    if (!generationResponse.ok) {
      const errorText = await generationResponse.text();
      console.log(`❌ Real API error (${generationResponse.status}):`, errorText);
      
      // Handle specific error cases
      if (generationResponse.status === 404) {
        return res.status(404).json({
          success: false,
          error: `Account profile '@${accountUsername}' not found. Create it first in the dashboard.`,
          suggestion: 'Go to Owned Accounts tab and create an account profile'
        });
      }
      
      throw new Error(`Real API error: ${generationResponse.status} - ${errorText}`);
    }

    const generationResult = await generationResponse.json();
    console.log(`✅ Real generation successful: ${generationResult.posts?.length || 0} posts`);

    // Step 2: Call your REAL Slack upload endpoint  
    console.log(`📤 Calling real Slack upload: ${REAL_API_BASE}/api/upload-workflow-to-slack`);
    
    const slackResponse = await fetch(`${REAL_API_BASE}/api/upload-workflow-to-slack`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accountUsername,
        posts: generationResult.posts
      })
    });

    if (!slackResponse.ok) {
      const errorText = await slackResponse.text();
      console.log(`❌ Slack API error (${slackResponse.status}):`, errorText);
      throw new Error(`Slack API error: ${slackResponse.status} - ${errorText}`);
    }

    const slackResult = await slackResponse.json();
    console.log(`✅ Slack upload successful: ${slackResult.uploads?.filter(u => u.success).length || 0}/${slackResult.uploads?.length || 0} posts sent`);

    // Step 3: Return combined result
    res.json({
      success: true,
      message: `Complete workflow successful! ${slackResult.uploads?.filter(u => u.success).length || 0}/${slackResult.uploads?.length || 0} posts sent to Slack`,
      generation: generationResult.generation,
      posts: generationResult.posts,
      slackResult: slackResult,
      usingRealAPI: true
    });

  } catch (error) {
    console.error('❌ Bridge workflow error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      suggestion: error.message.includes('Account profile') 
        ? 'Create an account profile first' 
        : 'Check that your real API is running and accessible'
    });
  }
});

// Test endpoint to check if real API is accessible
app.get('/api/test-real-api', async (req, res) => {
  try {
    console.log(`🧪 Testing connection to: ${REAL_API_BASE}`);
    
    const response = await fetch(`${REAL_API_BASE}/api/account-profiles`, {
      method: 'GET'
    });
    
    if (response.ok) {
      const data = await response.json();
      res.json({
        success: true,
        realApiUrl: REAL_API_BASE,
        status: response.status,
        profilesFound: Array.isArray(data) ? data.length : 'unknown',
        message: 'Real API is accessible!'
      });
    } else {
      res.status(response.status).json({
        success: false,
        realApiUrl: REAL_API_BASE,
        status: response.status,
        error: `Real API returned ${response.status}`
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      realApiUrl: REAL_API_BASE,
      error: error.message,
      message: 'Cannot connect to real API'
    });
  }
});

// Serve a simple test page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Real API Bridge</title>
        <style>
            body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
            .card { background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }
            .btn { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; }
            .success { color: #28a745; }
            .error { color: #dc3545; }
        </style>
    </head>
    <body>
        <h1>🌉 Real API Bridge</h1>
        <div class="card">
            <h3>Configuration</h3>
            <p><strong>Real API:</strong> ${REAL_API_BASE}</p>
            <p><strong>Slack:</strong> ${process.env.SLACK_WEBHOOK_URL ? '✅ Configured' : '❌ Not configured'}</p>
            <button class="btn" onclick="testRealAPI()">Test Real API Connection</button>
        </div>
        
        <div class="card">
            <h3>Test Workflow</h3>
            <form onsubmit="testWorkflow(event)">
                <input type="text" id="accountUsername" placeholder="Account username" value="test_account" style="width: 200px; padding: 8px; margin: 5px;">
                <button type="submit" class="btn">Test Real Workflow</button>
            </form>
        </div>
        
        <div id="results" class="card" style="display: none;">
            <h3>Results</h3>
            <div id="resultsContent"></div>
        </div>

        <script>
            async function testRealAPI() {
                try {
                    const response = await fetch('/api/test-real-api');
                    const result = await response.json();
                    showResults(result.success ? 'success' : 'error', JSON.stringify(result, null, 2));
                } catch (error) {
                    showResults('error', 'Connection failed: ' + error.message);
                }
            }

            async function testWorkflow(event) {
                event.preventDefault();
                const accountUsername = document.getElementById('accountUsername').value;
                
                try {
                    showResults('info', 'Testing workflow...');
                    
                    const response = await fetch('/api/bridge-generate-workflow', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            accountUsername,
                            postCount: 2,
                            imageCount: 2
                        })
                    });
                    
                    const result = await response.json();
                    showResults(result.success ? 'success' : 'error', JSON.stringify(result, null, 2));
                } catch (error) {
                    showResults('error', 'Workflow failed: ' + error.message);
                }
            }

            function showResults(type, content) {
                const results = document.getElementById('results');
                const resultsContent = document.getElementById('resultsContent');
                resultsContent.innerHTML = '<pre style="white-space: pre-wrap;" class="' + type + '">' + content + '</pre>';
                results.style.display = 'block';
            }
        </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🌉 API Bridge running on http://localhost:${PORT}`);
  console.log(`🧪 Test page: http://localhost:${PORT}`);
  console.log('');
  console.log('This bridge connects simple UI to your real deployed API endpoints.');
  console.log('It bypasses the need for local Supabase credentials.');
}); 