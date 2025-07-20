#!/usr/bin/env node

import { DailyAutomation } from './src/automation/daily-automation.js';

const automation = new DailyAutomation();

// Parse command line arguments
const args = process.argv.slice(2);
const isTest = args.includes('--test');
const isDryRun = args.includes('--dry-run');
const accountsArg = args.find(arg => arg.startsWith('--accounts='));
const testAccounts = accountsArg ? accountsArg.split('=')[1].split(',') : null;

console.log('🤖 TikTok Daily Automation CLI');
console.log('===============================');

if (isTest || isDryRun) {
  console.log('🧪 Running in TEST mode');
  
  if (testAccounts) {
    console.log(`🎯 Testing with accounts: ${testAccounts.join(', ')}`);
  }
  
  automation.testAutomation(testAccounts)
    .then((result) => {
      console.log('\n✅ Test completed successfully!');
      console.log(`📊 Summary: ${result.summary.accountsProcessed} accounts, ${result.summary.postsGenerated} posts generated`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error.message);
      process.exit(1);
    });
} else {
  console.log('🚀 Running daily automation...');
  
  automation.shouldRunAutomation()
    .then(shouldRun => {
      if (!shouldRun) {
        console.log('ℹ️  Daily automation already completed today');
        process.exit(0);
        return;
      }
      
      return automation.runDailyAutomation();
    })
    .then((result) => {
      if (result) {
        console.log('\n🎉 Daily automation completed successfully!');
        console.log(`📊 Summary: ${result.summary.accountsProcessed} accounts, ${result.summary.postsGenerated} posts generated`);
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Automation failed:', error.message);
      process.exit(1);
    });
} 