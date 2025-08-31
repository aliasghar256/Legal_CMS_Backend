const cron = require('node-cron');
const ReminderService = require('./ReminderService');

class ScheduledReminderService {
  constructor() {
    this.reminderService = new ReminderService();
    this.isRunning = false;
    this.scheduledTasks = new Map();
    this.stats = {
      tasksRun: 0,
      remindersProcessed: 0,
      lastRun: null,
      errors: 0
    };
  }

  /**
   * Start the scheduled reminder service
   * @param {Object} [options] - Configuration options
   * @param {string} [options.cronPattern] - Cron pattern (default: every 5 minutes)
   * @param {boolean} [options.runOnStart] - Run immediately on start
   * @param {string} [options.timezone] - Timezone for scheduling
   */
  start(options = {}) {
    const {
      cronPattern = '*/5 * * * *', // Every 5 minutes
      runOnStart = true,
      timezone = 'America/New_York'
    } = options;

    if (this.isRunning) {
      console.log('ScheduledReminderService is already running');
      return;
    }

    console.log(`🚀 Starting ScheduledReminderService with pattern: ${cronPattern}`);
    console.log(`📍 Timezone: ${timezone}`);
    console.log(`⏰ Next run will be at: ${this.getNextCronTime(cronPattern, timezone)}`);

    // Schedule the main reminder processing task
    const mainTask = cron.schedule(cronPattern, async () => {
      await this.processRemindersJob();
    }, {
      scheduled: true,
      timezone: timezone
    });

    this.scheduledTasks.set('main', mainTask);

    // Optional: Schedule a daily cleanup task
    const cleanupTask = cron.schedule('0 2 * * *', async () => {
      await this.dailyCleanupJob();
    }, {
      scheduled: true,
      timezone: timezone
    });

    this.scheduledTasks.set('cleanup', cleanupTask);

    // Optional: Schedule a weekly stats report
    const weeklyStatsTask = cron.schedule('0 9 * * MON', async () => {
      await this.weeklyStatsJob();
    }, {
      scheduled: true,
      timezone: timezone
    });

    this.scheduledTasks.set('weeklyStats', weeklyStatsTask);

    this.isRunning = true;

    // Run immediately if requested
    if (runOnStart) {
      console.log('🔄 Running initial reminder processing...');
      setTimeout(() => this.processRemindersJob(), 1000);
    }

    console.log('✅ ScheduledReminderService started successfully');
    this.logScheduleInfo();
  }

  /**
   * Stop the scheduled reminder service
   */
  stop() {
    if (!this.isRunning) {
      console.log('ScheduledReminderService is not running');
      return;
    }

    console.log('🛑 Stopping ScheduledReminderService...');

    // Destroy all scheduled tasks
    for (const [name, task] of this.scheduledTasks.entries()) {
      task.destroy();
      console.log(`📋 Stopped task: ${name}`);
    }

    this.scheduledTasks.clear();
    this.isRunning = false;

    console.log('✅ ScheduledReminderService stopped successfully');
  }

  /**
   * Main job to process due reminders
   */
  async processRemindersJob() {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 [${new Date().toISOString()}] Processing due reminders...`);
      
      const result = await this.reminderService.processDueReminders();
      
      // Update stats
      this.stats.tasksRun++;
      this.stats.remindersProcessed += result.processed || 0;
      this.stats.lastRun = new Date().toISOString();

      const duration = Date.now() - startTime;

      if (result.processed > 0 || result.failed > 0) {
        console.log(`✅ [${new Date().toISOString()}] Reminder processing completed:`);
        console.log(`   📧 Processed: ${result.processed}`);
        console.log(`   ❌ Failed: ${result.failed}`);
        console.log(`   ⏱️  Duration: ${duration}ms`);
        
        // Log details for failed reminders
        if (result.failed > 0 && result.details) {
          const failedDetails = result.details.filter(d => !d.success);
          console.log(`   📝 Failed reminder details:`);
          failedDetails.forEach(detail => {
            console.log(`      - Reminder ${detail.reminder_id}: ${detail.error}`);
          });
        }
      } else {
        console.log(`ℹ️  [${new Date().toISOString()}] No due reminders found (${duration}ms)`);
      }

    } catch (error) {
      this.stats.errors++;
      console.error(`❌ [${new Date().toISOString()}] Error in processRemindersJob:`, error);
      
      // Log error details for debugging
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Daily cleanup job to clean old processed reminders
   */
  async dailyCleanupJob() {
    try {
      console.log(`🧹 [${new Date().toISOString()}] Running daily cleanup...`);
      
      // This would typically clean up old sent reminders, logs, etc.
      // For now, we'll just log stats
      await this.logDailyStats();
      
      console.log(`✅ [${new Date().toISOString()}] Daily cleanup completed`);
      
    } catch (error) {
      console.error(`❌ [${new Date().toISOString()}] Error in dailyCleanupJob:`, error);
    }
  }

  /**
   * Weekly stats reporting job
   */
  async weeklyStatsJob() {
    try {
      console.log(`📊 [${new Date().toISOString()}] Generating weekly stats...`);
      
      const summary = await this.reminderService.getStatusSummary();
      
      console.log(`📋 Weekly Reminder Statistics:`);
      console.log(`   📧 Email Reminders:`, summary.email_reminders);
      console.log(`   📱 WhatsApp Reminders:`, summary.whatsapp_reminders);
      console.log(`   📈 Total Reminders:`, summary.reminders);
      console.log(`   🔄 Service Stats:`, this.stats);
      
    } catch (error) {
      console.error(`❌ [${new Date().toISOString()}] Error in weeklyStatsJob:`, error);
    }
  }

  /**
   * Log daily statistics
   */
  async logDailyStats() {
    try {
      const summary = await this.reminderService.getStatusSummary();
      
      console.log(`📊 Daily Reminder Statistics (${new Date().toLocaleDateString()}):`);
      console.log(`   🎯 Tasks Run Today: ${this.stats.tasksRun}`);
      console.log(`   📨 Reminders Processed Today: ${this.stats.remindersProcessed}`);
      console.log(`   ❌ Errors Today: ${this.stats.errors}`);
      console.log(`   ⏰ Last Run: ${this.stats.lastRun}`);
      console.log(`   📧 Email Status:`, summary.email_reminders);
      console.log(`   📱 WhatsApp Status:`, summary.whatsapp_reminders);
      
    } catch (error) {
      console.error('Error logging daily stats:', error);
    }
  }

  /**
   * Get next cron execution time
   * @param {string} cronPattern - Cron pattern
   * @param {string} timezone - Timezone
   * @returns {string} Next execution time
   */
  getNextCronTime(cronPattern, timezone) {
    try {
      // This is a simplified version - you might want to use a proper cron parser
      const now = new Date().toLocaleString('en-US', { timeZone: timezone });
      return `Next execution based on pattern ${cronPattern} in ${timezone}`;
    } catch (error) {
      return 'Unable to calculate next execution time';
    }
  }

  /**
   * Log current schedule information
   */
  logScheduleInfo() {
    console.log(`📅 Active Scheduled Tasks:`);
    for (const [name, task] of this.scheduledTasks.entries()) {
      console.log(`   - ${name}: ${task.running ? '🟢 Running' : '🔴 Stopped'}`);
    }
  }

  /**
   * Manually trigger reminder processing (for testing)
   */
  async triggerNow() {
    if (!this.isRunning) {
      throw new Error('ScheduledReminderService is not running');
    }

    console.log('🔄 Manually triggering reminder processing...');
    await this.processRemindersJob();
  }

  /**
   * Get service status and statistics
   * @returns {Object} Service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeTasks: Array.from(this.scheduledTasks.keys()),
      stats: { ...this.stats },
      uptime: this.stats.lastRun ? Date.now() - new Date(this.stats.lastRun).getTime() : null
    };
  }

  /**
   * Add a custom scheduled task
   * @param {string} name - Task name
   * @param {string} cronPattern - Cron pattern
   * @param {Function} taskFunction - Function to execute
   * @param {Object} [options] - Cron options
   */
  addCustomTask(name, cronPattern, taskFunction, options = {}) {
    if (this.scheduledTasks.has(name)) {
      throw new Error(`Task with name '${name}' already exists`);
    }

    const task = cron.schedule(cronPattern, async () => {
      try {
        console.log(`🔄 Running custom task: ${name}`);
        await taskFunction();
        console.log(`✅ Custom task completed: ${name}`);
      } catch (error) {
        console.error(`❌ Error in custom task ${name}:`, error);
      }
    }, {
      scheduled: this.isRunning,
      timezone: options.timezone || 'America/New_York',
      ...options
    });

    this.scheduledTasks.set(name, task);
    console.log(`📋 Added custom task: ${name} (${cronPattern})`);
  }

  /**
   * Remove a custom scheduled task
   * @param {string} name - Task name
   */
  removeCustomTask(name) {
    if (!this.scheduledTasks.has(name)) {
      throw new Error(`Task with name '${name}' does not exist`);
    }

    const task = this.scheduledTasks.get(name);
    task.destroy();
    this.scheduledTasks.delete(name);
    
    console.log(`🗑️ Removed custom task: ${name}`);
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      tasksRun: 0,
      remindersProcessed: 0,
      lastRun: null,
      errors: 0
    };
    console.log('📊 Statistics reset');
  }
}

module.exports = ScheduledReminderService;