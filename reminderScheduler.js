const ScheduledReminderService = require('./services/ScheduledReminderService');

class ReminderScheduler {
  constructor() {
    this.scheduledService = new ScheduledReminderService();
    this.isInitialized = false;
  }

  /**
   * Initialize and start the reminder scheduler
   * @param {Object} [config] - Configuration options
   */
  async initialize(config = {}) {
    try {
      if (this.isInitialized) {
        console.log('ReminderScheduler is already initialized');
        return;
      }

      console.log('🚀 Initializing Reminder Scheduler...');

      // Default configuration
      const defaultConfig = {
        cronPattern: process.env.REMINDER_CRON_PATTERN || '*/5 * * * *', // Every 5 minutes
        timezone: process.env.REMINDER_TIMEZONE || 'America/New_York',
        runOnStart: process.env.REMINDER_RUN_ON_START !== 'false', // Default true
        autoStart: process.env.REMINDER_AUTO_START !== 'false', // Default true
      };

      const finalConfig = { ...defaultConfig, ...config };

      // Log configuration
      console.log('📋 Reminder Scheduler Configuration:');
      console.log(`   🕐 Cron Pattern: ${finalConfig.cronPattern}`);
      console.log(`   🌍 Timezone: ${finalConfig.timezone}`);
      console.log(`   ⚡ Run on Start: ${finalConfig.runOnStart}`);
      console.log(`   🤖 Auto Start: ${finalConfig.autoStart}`);

      // Start the service if auto start is enabled
      if (finalConfig.autoStart) {
        this.scheduledService.start(finalConfig);
      }

      this.isInitialized = true;
      console.log('✅ Reminder Scheduler initialized successfully');

      // Set up graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      console.error('❌ Failed to initialize Reminder Scheduler:', error);
      throw error;
    }
  }

  /**
   * Start the reminder service manually
   * @param {Object} [options] - Start options
   */
  start(options = {}) {
    if (!this.isInitialized) {
      throw new Error('ReminderScheduler must be initialized before starting');
    }

    this.scheduledService.start(options);
  }

  /**
   * Stop the reminder service
   */
  stop() {
    if (!this.isInitialized) {
      console.log('ReminderScheduler is not initialized');
      return;
    }

    this.scheduledService.stop();
  }

  /**
   * Get the status of the reminder service
   * @returns {Object} Service status
   */
  getStatus() {
    if (!this.isInitialized) {
      return { isInitialized: false, service: null };
    }

    return {
      isInitialized: this.isInitialized,
      service: this.scheduledService.getStatus()
    };
  }

  /**
   * Manually trigger reminder processing
   */
  async triggerNow() {
    if (!this.isInitialized) {
      throw new Error('ReminderScheduler must be initialized before triggering');
    }

    return await this.scheduledService.triggerNow();
  }

  /**
   * Add a custom scheduled task
   * @param {string} name - Task name
   * @param {string} cronPattern - Cron pattern
   * @param {Function} taskFunction - Function to execute
   * @param {Object} [options] - Additional options
   */
  addCustomTask(name, cronPattern, taskFunction, options = {}) {
    if (!this.isInitialized) {
      throw new Error('ReminderScheduler must be initialized before adding tasks');
    }

    return this.scheduledService.addCustomTask(name, cronPattern, taskFunction, options);
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const gracefulShutdown = () => {
      console.log('\n🛑 Received shutdown signal. Gracefully shutting down Reminder Scheduler...');
      
      try {
        this.stop();
        console.log('✅ Reminder Scheduler shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Handle different shutdown signals
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGUSR2', gracefulShutdown); // For nodemon

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      gracefulShutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown();
    });
  }

  /**
   * Get the underlying scheduled service instance
   * @returns {ScheduledReminderService} The scheduled service instance
   */
  getScheduledService() {
    return this.scheduledService;
  }
}

// Create and export a singleton instance
const reminderScheduler = new ReminderScheduler();

module.exports = reminderScheduler;