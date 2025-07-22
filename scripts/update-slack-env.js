import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function updateSlackWebhook(webhookUrl, channel = '#content-pipeline') {
  const envPath = path.join(__dirname, '../.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env file not found!');
    return;
  }
  
  // Read current .env file
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Update Slack webhook URL
  envContent = envContent.replace(
    /SLACK_WEBHOOK_URL=.*/,
    `SLACK_WEBHOOK_URL=${webhookUrl}`
  );
  
  // Update channel if provided
  if (channel) {
    envContent = envContent.replace(
      /SLACK_CHANNEL=.*/,
      `SLACK_CHANNEL=${channel}`
    );
  }
  
  // Write back to .env
  fs.writeFileSync(envPath, envContent);
  
  console.log('✅ Updated .env file with new Slack configuration');
  console.log(`   Webhook URL: ${webhookUrl.substring(0, 50)}...`);
  console.log(`   Channel: ${channel}`);
  console.log('\n🧪 Test your Slack integration:');
  console.log('   node scripts/test-slack.js');
}

// Check if webhook URL provided as argument
const webhookUrl = process.argv[2];
const channel = process.argv[3];

if (!webhookUrl) {
  console.log('📋 Slack Webhook Setup Guide:');
  console.log('============================');
  console.log('');
  console.log('1. Go to https://api.slack.com/apps');
  console.log('2. Click "Create New App" → "From scratch"');
  console.log('3. App Name: Content Pipeline Bot');
  console.log('4. Select your workspace');
  console.log('5. Go to "Incoming Webhooks" → Toggle ON');
  console.log('6. Click "Add New Webhook to Workspace"');
  console.log('7. Select #content-pipeline channel');
  console.log('8. Copy the webhook URL');
  console.log('');
  console.log('Then run:');
  console.log('node scripts/update-slack-env.js "YOUR_WEBHOOK_URL" "#content-pipeline"');
  console.log('');
  console.log('Example:');
  console.log('node scripts/update-slack-env.js "https://hooks.slack.com/services/T123.../B456.../xyz789..." "#content-pipeline"');
} else {
  if (!webhookUrl.startsWith('https://hooks.slack.com/services/')) {
    console.log('❌ Invalid webhook URL format!');
    console.log('   Expected: https://hooks.slack.com/services/T.../B.../...');
    console.log('   Received:', webhookUrl);
  } else {
    updateSlackWebhook(webhookUrl, channel);
  }
} 