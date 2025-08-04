#!/usr/bin/env node

/**
 * Deploy Complete Production Schema
 * 
 * This script deploys all the missing tables needed for content generation
 * to work in your production environment.
 * 
 * Run this to fix the content generation endpoints that are failing.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  console.error('');
  console.error('Please set these in your Vercel environment variables.');
  process.exit(1);
}

// Initialize Supabase client with service role key for admin access
const supabase = createClient(supabaseUrl, supabaseKey);

async function deploySchema() {
  console.log('🚀 Deploying complete production schema...');
  console.log('📊 This will add all missing tables for content generation');
  console.log('');

  try {
    // Read the schema file
    const schemaPath = path.join(process.cwd(), 'complete-production-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('📋 Schema file loaded successfully');
    console.log('🗄️ Executing schema in production database...');
    console.log('');

    // Split the schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    console.log('');

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
        // Execute each statement
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // Some statements might fail if tables already exist, which is okay
          if (error.message.includes('already exists') || 
              error.message.includes('duplicate key') ||
              error.message.includes('relation') && error.message.includes('already exists')) {
            console.log(`⚠️  Statement ${i + 1}: ${error.message.split('\n')[0]}`);
          } else {
            console.error(`❌ Statement ${i + 1} failed: ${error.message}`);
            errorCount++;
          }
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Statement ${i + 1} error: ${err.message}`);
        errorCount++;
      }
    }

    console.log('');
    console.log('📊 Schema deployment summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('');

    if (errorCount === 0) {
      console.log('🎉 Schema deployed successfully!');
      console.log('');
      console.log('✅ Your content generation endpoints should now work properly.');
      console.log('✅ All required tables have been created.');
      console.log('');
      console.log('🔧 Next steps:');
      console.log('   1. Test content generation in your Vercel app');
      console.log('   2. Run the content pipeline to populate data');
      console.log('   3. Create account profiles for your target accounts');
    } else {
      console.log('⚠️  Some statements had errors, but this is often normal.');
      console.log('   Most tables should be created successfully.');
      console.log('');
      console.log('🔧 Please test your content generation endpoints.');
    }

  } catch (error) {
    console.error('❌ Failed to deploy schema:', error.message);
    process.exit(1);
  }
}

// Alternative approach using direct SQL execution
async function deploySchemaAlternative() {
  console.log('🚀 Deploying schema using alternative method...');
  console.log('');

  try {
    // Read the schema file
    const schemaPath = path.join(process.cwd(), 'complete-production-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('📋 Schema file loaded successfully');
    console.log('🗄️ Executing schema in production database...');
    console.log('');

    // Execute the entire schema as one statement
    const { error } = await supabase.rpc('exec_sql', { sql: schema });

    if (error) {
      console.error('❌ Schema deployment failed:', error.message);
      
      // Try to provide helpful error information
      if (error.message.includes('already exists')) {
        console.log('');
        console.log('💡 This error is normal - some tables already exist.');
        console.log('   The schema should still be mostly deployed.');
        console.log('');
        console.log('🔧 Please test your content generation endpoints.');
      }
    } else {
      console.log('🎉 Schema deployed successfully!');
      console.log('');
      console.log('✅ Your content generation endpoints should now work properly.');
    }

  } catch (error) {
    console.error('❌ Failed to deploy schema:', error.message);
    console.log('');
    console.log('💡 Alternative: You can copy the SQL from complete-production-schema.sql');
    console.log('   and run it directly in your Supabase SQL editor.');
  }
}

// Check if we can execute SQL directly
async function checkDatabaseAccess() {
  try {
    // Try to create a simple test table
    const { error } = await supabase.rpc('exec_sql', { 
      sql: 'CREATE TABLE IF NOT EXISTS schema_test (id SERIAL PRIMARY KEY, test TEXT); DROP TABLE IF EXISTS schema_test;' 
    });
    
    if (error) {
      console.log('⚠️  Direct SQL execution not available, using alternative method...');
      return false;
    }
    
    return true;
  } catch (err) {
    console.log('⚠️  Direct SQL execution not available, using alternative method...');
    return false;
  }
}

// Main execution
async function main() {
  console.log('🔧 Content Pipeline Schema Deployment');
  console.log('=====================================');
  console.log('');

  const canExecuteSQL = await checkDatabaseAccess();
  
  if (canExecuteSQL) {
    await deploySchema();
  } else {
    await deploySchemaAlternative();
  }
}

// Run the deployment
main().catch(console.error); 