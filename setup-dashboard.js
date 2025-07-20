#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🚀 Setting up Content Pipeline Dashboard...\n');

async function setupDashboard() {
    try {
        // Check if port 3000 is already in use
        console.log('📋 Checking if port 3000 is available...');
        try {
            await execAsync('lsof -ti:3000');
            console.log('⚠️  Port 3000 is already in use. Please stop any existing server first.');
            console.log('💡 You can kill the process using: lsof -ti:3000 | xargs kill -9');
            process.exit(1);
        } catch (error) {
            // Port is available
            console.log('✅ Port 3000 is available');
        }

        console.log('\n📊 Dashboard Setup Complete!');
        console.log('\n📝 Next Steps:');
        console.log('1. Run the migration script in Supabase SQL Editor:');
        console.log('   - Copy the contents of migrate-existing-data.sql');
        console.log('   - Paste it into your Supabase SQL Editor');
        console.log('   - Click "Run" to update your existing data');
        console.log('\n2. Start the dashboard server:');
        console.log('   npm run web');
        console.log('\n3. Open your browser to: http://localhost:3000');
        console.log('\n🎯 The dashboard will now show:');
        console.log('   - Trending aesthetics, seasons, and colors');
        console.log('   - Performance analysis for each trait');
        console.log('   - Advanced filtering by stylistic traits');
        console.log('   - Content generation with diversity controls');
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        process.exit(1);
    }
}

setupDashboard(); 