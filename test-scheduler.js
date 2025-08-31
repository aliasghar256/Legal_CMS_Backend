#!/usr/bin/env node

/**
 * Standalone Reminder Scheduler Test Script
 * 
 * This script can be used to test the reminder scheduler independently
 * without starting the full server.
 * 
 * Usage:
 * node test-scheduler.js [options]
 * 
 * Options:
 * --pattern - Custom cron pattern (default: every 2 minutes for testing)
 * --timezone - Custom timezone (default: America/New_York)
 * --duration - Test duration in seconds (default: 60)
 * --no-auto-stop - Don't auto-stop after duration
 */

const reminderScheduler = require('./reminderScheduler');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};

args.forEach(arg => {
  if (arg.startsWith('--pattern=')) {
    options.cronPattern = arg.split('=')[1];
  } else if (arg.startsWith('--timezone=')) {
    options.timezone = arg.split('=')[1];
  } else if (arg.startsWith('--duration=')) {
    options.testDuration = parseInt(arg.split('=')[1]);
  } else if (arg === '--no-auto-stop') {
    options.autoStop = false;
  }
});

// Default test configuration
const testConfig = {
  cronPattern: options.cronPattern || '*/2 * * * *', // Every 2 minutes for testing
  timezone: options.timezone || 'America/New_York',
  runOnStart: true,
  autoStart: true,
  testDuration: options.testDuration || 60, // 60 seconds
  autoStop: options.autoStop !== false
};

console.log('🧪 Reminder Scheduler Test Script');
console.log('================================');
console.log('📋 Test Configuration:');
console.log(`   🕐 Cron Pattern: ${testConfig.cronPattern}`);
console.log(`   🌍 Timezone: ${testConfig.timezone}`);
console.log(`   ⏱️  Test Duration: ${testConfig.testDuration} seconds`);
console.log(`   🔄 Auto Stop: ${testConfig.autoStop}`);
console.log('');

async function runTest() {
  try {
    console.log('🚀 Initializing Reminder Scheduler...');
    
    // Initialize the scheduler
    await reminderScheduler.initialize(testConfig);
    
    console.log('✅ Scheduler initialized successfully');
    console.log('📊 Initial Status:', reminderScheduler.getStatus());
    console.log('');
    
    // Set up test duration timer
    if (testConfig.autoStop) {
      console.log(`⏰ Test will run for ${testConfig.testDuration} seconds...`);
      console.log('🔄 You should see reminder processing attempts based on the cron pattern');
      console.log('💡 Tip: Create some test reminders in your database to see actual processing');
      console.log('');
      
      setTimeout(() => {
        console.log('\n⏰ Test duration reached. Stopping scheduler...');
        stopTest();
      }, testConfig.testDuration * 1000);
    } else {
      console.log('🔄 Scheduler running indefinitely. Press Ctrl+C to stop.');
      console.log('');
    }
    
    // Add a test custom task
    try {
      reminderScheduler.addCustomTask(
        'test-task',
        '*/3 * * * *', // Every 3 minutes
        async () => {
          console.log('🧪 Test custom task executed!');
          const status = reminderScheduler.getStatus();
          console.log(`📊 Current Stats: ${JSON.stringify(status.service.stats, null, 2)}`);
        }
      );
      console.log('📋 Added test custom task (runs every 3 minutes)');
    } catch (error) {
      console.log('⚠️  Could not add custom task (might already exist):', error.message);
    }
    
    // Manual trigger test
    console.log('🔄 Testing manual trigger...');
    try {
      await reminderScheduler.triggerNow();
      console.log('✅ Manual trigger test completed');
    } catch (error) {
      console.error('❌ Manual trigger test failed:', error.message);
    }
    
    console.log('');
    console.log('📈 Monitoring scheduler activity...');
    console.log('=================================');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

function stopTest() {
  try {
    console.log('🛑 Stopping Reminder Scheduler...');
    reminderScheduler.stop();
    
    const finalStatus = reminderScheduler.getStatus();
    console.log('📊 Final Status:', finalStatus);
    
    console.log('✅ Test completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during test shutdown:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Received SIGINT. Shutting down gracefully...');
  stopTest();
});

process.on('SIGTERM', () => {
  console.log('\n👋 Received SIGTERM. Shutting down gracefully...');
  stopTest();
});

// Start the test
runTest().catch(error => {
  console.error('❌ Unhandled error in test:', error);
  process.exit(1);
});