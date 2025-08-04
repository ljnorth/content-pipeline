#!/usr/bin/env node

/**
 * Performance-Based Theme Discovery Runner
 * 
 * This script analyzes your high-performing posts and discovers themes that work well.
 * Think of it as creating a "recipe book" of successful content patterns.
 * 
 * Usage:
 *   node run-theme-discovery.js [options]
 * 
 * Options:
 *   --min-engagement 0.05    Minimum engagement rate (default: 5%)
 *   --max-themes 20          Maximum themes to discover (default: 20)
 *   --deploy-schema          Deploy the database schema first
 */

import { config } from 'dotenv';
config();

import { ThemeDiscoveryAnalyzer } from './src/stages/theme-discovery-analyzer.js';
import { SupabaseClient } from './src/database/supabase-client.js';
import { Logger } from './src/utils/logger.js';
import fs from 'fs-extra';

const logger = new Logger();

async function deploySchema() {
  logger.info('📋 Deploying discovered themes schema...');
  
  try {
    const db = new SupabaseClient();
    const schemaSQL = await fs.readFile('./schema-discovered-themes.sql', 'utf8');
    
    // Execute the schema SQL
    const { error } = await db.client.rpc('exec_sql', { sql: schemaSQL });
    
    if (error) {
      // If the RPC function doesn't exist, try direct execution
      logger.warn('RPC function not found, trying direct execution...');
      
      // Split the SQL into individual statements and execute them
      const statements = schemaSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
      
      for (const statement of statements) {
        if (statement.toLowerCase().includes('create') || 
            statement.toLowerCase().includes('alter') ||
            statement.toLowerCase().includes('comment')) {
          const { error: stmtError } = await db.client.rpc('exec', { sql: statement });
          if (stmtError) {
            logger.warn(`⚠️ Statement failed (may already exist): ${stmtError.message}`);
          }
        }
      }
    }
    
    logger.info('✅ Schema deployment completed');
    return true;
    
  } catch (error) {
    logger.error(`❌ Schema deployment failed: ${error.message}`);
    logger.info('💡 You may need to run the SQL manually in your Supabase dashboard');
    return false;
  }
}

async function main() {
  logger.info('🚀 Starting Performance-Based Theme Discovery');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    minEngagementRate: 0.05, // 5% default
    maxThemes: 20,
    deploySchema: false
  };
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--min-engagement' && i + 1 < args.length) {
      options.minEngagementRate = parseFloat(args[i + 1]);
      i++; // Skip next argument
    } else if (arg === '--max-themes' && i + 1 < args.length) {
      options.maxThemes = parseInt(args[i + 1]);
      i++; // Skip next argument
    } else if (arg === '--deploy-schema') {
      options.deploySchema = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Performance-Based Theme Discovery

This tool analyzes your high-performing posts and creates themes based on what works.

Usage: node run-theme-discovery.js [options]

Options:
  --min-engagement 0.05    Minimum engagement rate (default: 5%)
  --max-themes 20          Maximum themes to discover (default: 20)
  --deploy-schema          Deploy the database schema first
  --help, -h               Show this help message

Examples:
  node run-theme-discovery.js
  node run-theme-discovery.js --min-engagement 0.08 --max-themes 15
  node run-theme-discovery.js --deploy-schema
      `);
      process.exit(0);
    }
  }
  
  logger.info(`📋 Configuration:`);
  logger.info(`   📊 Minimum engagement rate: ${(options.minEngagementRate * 100).toFixed(1)}%`);
  logger.info(`   🎯 Maximum themes to discover: ${options.maxThemes}`);
  logger.info(`   🗄️ Deploy schema: ${options.deploySchema ? 'Yes' : 'No'}`);
  
  try {
    // Deploy schema if requested
    if (options.deploySchema) {
      const schemaDeployed = await deploySchema();
      if (!schemaDeployed) {
        logger.warn('⚠️ Schema deployment had issues, but continuing...');
      }
    }
    
    // Check database connection
    logger.info('🔗 Checking database connection...');
    const db = new SupabaseClient();
    const { data: testQuery, error: connectionError } = await db.client
      .from('posts')
      .select('count')
      .limit(1);
    
    if (connectionError) {
      throw new Error(`Database connection failed: ${connectionError.message}`);
    }
    
    logger.info('✅ Database connection successful');
    
    // Initialize theme discovery analyzer
    const analyzer = new ThemeDiscoveryAnalyzer();
    
    // Run theme discovery
    logger.info('🎯 Starting theme discovery process...');
    const result = await analyzer.runThemeDiscovery({
      minEngagementRate: options.minEngagementRate,
      maxThemes: options.maxThemes
    });
    
    if (result.success) {
      logger.info('🎉 Theme Discovery Completed Successfully!');
      logger.info('');
      logger.info('📊 SUMMARY:');
      logger.info(`   📈 High-performing images analyzed: ${result.summary.highPerformingImages}`);
      logger.info(`   🔍 Patterns identified: ${result.summary.patternsFound}`);
      logger.info(`   ✨ Themes discovered: ${result.summary.themesDiscovered}`);
      logger.info(`   💾 Themes stored in database: ${result.summary.themesStored}`);
      logger.info(`   💰 Total AI cost: $${result.summary.totalCost.toFixed(4)}`);
      logger.info('');
      
      // Show top 5 discovered themes
      if (result.themes && result.themes.length > 0) {
        logger.info('🏆 TOP DISCOVERED THEMES:');
        result.themes.slice(0, 5).forEach((theme, index) => {
          logger.info(`   ${index + 1}. "${theme.theme_name}"`);
          logger.info(`      📊 Performance: ${theme.performance_metrics.performance_score.toFixed(1)}/100`);
          logger.info(`      📈 Avg Engagement: ${(theme.performance_metrics.avg_engagement * 100).toFixed(2)}%`);
          logger.info(`      🎯 Confidence: ${theme.performance_metrics.confidence_level}`);
          logger.info(`      📝 Description: ${theme.description}`);
          logger.info('');
        });
      }
      
      logger.info('💡 NEXT STEPS:');
      logger.info('   1. Review the discovered themes in your database');
      logger.info('   2. Use these themes in your content generation');
      logger.info('   3. Run this analysis periodically to discover new trends');
      
    } else {
      logger.error('❌ Theme discovery failed');
      process.exit(1);
    }
    
  } catch (error) {
    logger.error(`❌ Theme discovery failed: ${error.message}`);
    logger.error(`❌ Stack trace: ${error.stack}`);
    
    // Provide helpful troubleshooting tips
    logger.info('');
    logger.info('🔧 TROUBLESHOOTING TIPS:');
    
    if (error.message.includes('No high-performing posts found')) {
      logger.info('   • Try lowering the minimum engagement rate with --min-engagement 0.02');
      logger.info('   • Make sure you have posts with engagement data in your database');
      logger.info('   • Run the content pipeline first to scrape and analyze posts');
    } else if (error.message.includes('database') || error.message.includes('connection')) {
      logger.info('   • Check your Supabase credentials in .env file');
      logger.info('   • Make sure your database is accessible');
      logger.info('   • Try running with --deploy-schema to create missing tables');
    } else if (error.message.includes('OpenAI') || error.message.includes('API')) {
      logger.info('   • Check your OpenAI API key in .env file');
      logger.info('   • Make sure you have sufficient API credits');
    } else {
      logger.info('   • Check the error message above for specific details');
      logger.info('   • Make sure all required tables exist in your database');
      logger.info('   • Try running with --deploy-schema first');
    }
    
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  logger.info('\n⏹️ Process interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('\n⏹️ Process terminated');
  process.exit(0);
});

// Run the main function
main().catch(error => {
  logger.error(`❌ Unexpected error: ${error.message}`);
  process.exit(1);
}); 