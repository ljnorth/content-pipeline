import { SlackAPI } from '../src/slack/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testSlack() {
  console.log('🔗 Testing Slack Integration...\n');
  
  const slack = new SlackAPI();
  
  if (!slack.enabled) {
    console.log('❌ Slack not configured!');
    console.log('   Please set SLACK_WEBHOOK_URL in your .env file');
    console.log('   Example: SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL\n');
    return;
  }
  
  console.log('✅ Slack configuration found');
  console.log(`   Channel: ${slack.channel}`);
  console.log(`   Webhook: ${slack.webhookUrl.substring(0, 50)}...\n`);
  
  // Create test content
  const testContent = {
    results: [{
      success: true,
      account: 'test_account',
      posts: [{
        postNumber: 1,
        caption: 'This is a test post from the Content Pipeline! 🎉',
        hashtags: ['#test', '#contentpipeline', '#easypost'],
        images: [{
          imagePath: 'https://picsum.photos/400/500?random=1',
          aesthetic: 'Test'
        }]
      }]
    }]
  };
  
  try {
    console.log('📤 Sending test message to Slack...');
    const result = await slack.sendPostsToSlack(testContent);
    
    if (result.success) {
      console.log('✅ Test message sent successfully!');
      console.log('   Check your Slack channel for the preview');
      console.log(`   Preview URL will be: https://easypost.fun/postpreview/batch_${Date.now()}_test_account`);
    } else {
      console.log('❌ Failed to send test message');
      console.log('   Error:', result.error);
    }
    
  } catch (error) {
    console.log('❌ Slack test failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Check your SLACK_WEBHOOK_URL is correct');
    console.log('2. Make sure the webhook is for the right workspace');
    console.log('3. Verify the channel exists and the bot has access');
  }
}

testSlack(); 