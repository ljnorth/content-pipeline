import dotenv from 'dotenv';
import { TikTokAPI } from './src/automation/tiktok-api.js';
import { Logger } from './src/utils/logger.js';
import readline from 'readline';

// Load environment variables
dotenv.config();

const logger = new Logger();
const tiktokAPI = new TikTokAPI();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupTikTokOAuth() {
  logger.info('🔗 TikTok OAuth Setup Helper');
  logger.info('This will help you connect your TikTok accounts to the automation system.');
  
  try {
    // Check if credentials are configured
    if (!process.env.TIKTOK_CLIENT_KEY || !process.env.TIKTOK_CLIENT_SECRET) {
      logger.error('❌ TikTok credentials not found in .env file');
      logger.info('Make sure these are set:');
      logger.info('  TIKTOK_CLIENT_KEY=your_client_key');
      logger.info('  TIKTOK_CLIENT_SECRET=your_client_secret');
      logger.info('  TIKTOK_SANDBOX_MODE=true');
      process.exit(1);
    }

    logger.info('✅ TikTok credentials found');
    logger.info(`📍 Mode: ${process.env.TIKTOK_SANDBOX_MODE === 'true' ? 'Sandbox' : 'Production'}`);
    
    // Get account username
    const accountUsername = await question('Enter the account username you want to connect: ');
    
    if (!accountUsername) {
      logger.error('❌ Account username is required');
      process.exit(1);
    }

    // Generate redirect URI
    const redirectUri = 'http://localhost:3000/auth/tiktok/callback';
    
    // Generate OAuth URL
    const { authUrl, state } = tiktokAPI.generateAuthUrl(accountUsername, redirectUri);
    
    logger.info('🎯 OAuth Flow Started');
    logger.info(`📱 Account: @${accountUsername}`);
    logger.info(`🔗 Authorization URL: ${authUrl}`);
    logger.info('');
    logger.info('📋 Next Steps:');
    logger.info('1. Copy the URL above and open it in your browser');
    logger.info('2. Log in to your TikTok account');
    logger.info('3. Authorize the app to access your account');
    logger.info('4. Copy the authorization code from the callback URL');
    logger.info('');
    
    // Wait for authorization code
    const authCode = await question('Enter the authorization code from the callback: ');
    
    if (!authCode) {
      logger.error('❌ Authorization code is required');
      process.exit(1);
    }

    // Exchange code for tokens
    logger.info('🔄 Exchanging authorization code for access token...');
    
    const credentials = await tiktokAPI.exchangeCodeForToken(authCode, redirectUri);
    
    // Save credentials to database
    await tiktokAPI.saveAccountCredentials(accountUsername, credentials);
    
    logger.info('🎉 TikTok OAuth setup complete!');
    logger.info(`✅ @${accountUsername} is now connected`);
    logger.info(`🔑 Access token expires: ${new Date(Date.now() + credentials.expires_in * 1000).toLocaleString()}`);
    logger.info('');
    logger.info('🚀 You can now run the automation in real mode:');
    logger.info('   npm run automation:test');
    
  } catch (error) {
    logger.error(`❌ OAuth setup failed: ${error.message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Check if this script is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupTikTokOAuth();
}

export { setupTikTokOAuth }; 