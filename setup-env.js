#!/usr/bin/env node

/**
 * Environment Setup Helper
 * 
 * This script helps you set up the environment variables needed for
 * TikTok upload verification and testing.
 */

import fs from 'fs';
import path from 'path';

console.log('🔧 Environment Setup Helper');
console.log('============================\n');

// Check if .env file exists
const envPath = path.join(process.cwd(), '.env');
const envExists = fs.existsSync(envPath);

if (envExists) {
  console.log('✅ .env file already exists');
  console.log('📝 Current environment variables:');
  
  // Load and display current .env contents
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  
  lines.forEach(line => {
    const [key] = line.split('=');
    if (key) {
      console.log(`   - ${key}`);
    }
  });
} else {
  console.log('⚠️  No .env file found');
  console.log('📝 Creating .env template...');
  
  const envTemplate = `# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# TikTok API Configuration
TIKTOK_CLIENT_KEY=your_tiktok_client_key_here
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret_here
TIKTOK_SANDBOX_MODE=true

# Web Interface Configuration
BASE_URL=http://localhost:3000
PORT=3000

# Optional: Logging
LOG_LEVEL=info
`;

  fs.writeFileSync(envPath, envTemplate);
  console.log('✅ Created .env template file');
}

console.log('\n📋 Required Environment Variables:');
console.log('==================================');
console.log('');
console.log('🔗 Supabase (Database):');
console.log('   SUPABASE_URL - Your Supabase project URL');
console.log('   SUPABASE_ANON_KEY - Public API key');
console.log('   SUPABASE_SERVICE_ROLE_KEY - Service role key (for admin operations)');
console.log('');
console.log('📱 TikTok API:');
console.log('   TIKTOK_CLIENT_KEY - Your TikTok app client key');
console.log('   TIKTOK_CLIENT_SECRET - Your TikTok app client secret');
console.log('   TIKTOK_SANDBOX_MODE - Set to "true" for testing');
console.log('');
console.log('🌐 Web Interface:');
console.log('   BASE_URL - Your web interface URL (default: http://localhost:3000)');
console.log('   PORT - Port for web server (default: 3000)');
console.log('');

console.log('💡 How to get these values:');
console.log('===========================');
console.log('');
console.log('🔗 Supabase:');
console.log('   1. Go to https://supabase.com/dashboard');
console.log('   2. Select your project');
console.log('   3. Go to Settings → API');
console.log('   4. Copy the URL and keys');
console.log('');
console.log('📱 TikTok:');
console.log('   1. Go to https://developers.tiktok.com/');
console.log('   2. Create a new app or use existing one');
console.log('   3. Go to App Management → App Info');
console.log('   4. Copy Client Key and Client Secret');
console.log('   5. Add your TikTok account to Sandbox for testing');
console.log('');

if (!envExists) {
  console.log('🎯 Next Steps:');
  console.log('==============');
  console.log('1. Edit the .env file with your actual values');
  console.log('2. Run: node check-upload-status.js');
  console.log('3. Run: npm run web (to start web interface)');
  console.log('4. Test your TikTok connection');
} else {
  console.log('🎯 To verify your setup:');
  console.log('=======================');
  console.log('1. Run: node check-upload-status.js');
  console.log('2. Run: npm run web');
  console.log('3. Check if TikTok connection works');
}

console.log('\n📚 For more help, see: UPLOAD_VERIFICATION_GUIDE.md'); 