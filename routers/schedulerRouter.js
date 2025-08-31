const express = require('express');
const reminderScheduler = require('../reminderScheduler');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

/**
 * Get scheduler status
 */
router.get('/status', (req, res) => {
  try {
    const status = reminderScheduler.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting scheduler status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get scheduler status',
      error: error.message
    });
  }
});

/**
 * Manually trigger reminder processing
 */
router.post('/trigger', authenticateToken, async (req, res) => {
  try {
    console.log(`🔄 Manual trigger requested by user ${req.user.userId}`);
    
    const result = await reminderScheduler.triggerNow();
    
    res.json({
      success: true,
      message: 'Reminder processing triggered successfully',
      data: result
    });
  } catch (error) {
    console.error('Error triggering reminder processing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger reminder processing',
      error: error.message
    });
  }
});

/**
 * Start the scheduler (if stopped)
 */
router.post('/start', authenticateToken, (req, res) => {
  try {
    const { cronPattern, timezone, runOnStart } = req.body;
    
    console.log(`📅 Scheduler start requested by user ${req.user.userId}`);
    
    reminderScheduler.start({
      cronPattern: cronPattern || '*/5 * * * *',
      timezone: timezone || 'America/New_York',
      runOnStart: runOnStart !== false
    });
    
    res.json({
      success: true,
      message: 'Scheduler started successfully',
      data: reminderScheduler.getStatus()
    });
  } catch (error) {
    console.error('Error starting scheduler:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start scheduler',
      error: error.message
    });
  }
});

/**
 * Stop the scheduler
 */
router.post('/stop', authenticateToken, (req, res) => {
  try {
    console.log(`🛑 Scheduler stop requested by user ${req.user.userId}`);
    
    reminderScheduler.stop();
    
    res.json({
      success: true,
      message: 'Scheduler stopped successfully',
      data: reminderScheduler.getStatus()
    });
  } catch (error) {
    console.error('Error stopping scheduler:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop scheduler',
      error: error.message
    });
  }
});

/**
 * Add a custom scheduled task
 */
router.post('/custom-task', authenticateToken, (req, res) => {
  try {
    const { name, cronPattern, description } = req.body;
    
    if (!name || !cronPattern) {
      return res.status(400).json({
        success: false,
        message: 'Name and cronPattern are required'
      });
    }
    
    console.log(`📋 Custom task creation requested by user ${req.user.userId}: ${name}`);
    
    // Create a simple logging task as an example
    const taskFunction = async () => {
      console.log(`🔄 Executing custom task: ${name} - ${description || 'No description'}`);
    };
    
    reminderScheduler.addCustomTask(name, cronPattern, taskFunction);
    
    res.json({
      success: true,
      message: `Custom task '${name}' added successfully`,
      data: {
        name,
        cronPattern,
        description,
        status: reminderScheduler.getStatus()
      }
    });
  } catch (error) {
    console.error('Error adding custom task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add custom task',
      error: error.message
    });
  }
});

/**
 * Get scheduler logs (basic implementation)
 */
router.get('/logs', authenticateToken, (req, res) => {
  try {
    const status = reminderScheduler.getStatus();
    
    // This is a basic implementation - in production you might want to implement proper logging
    const logs = {
      message: 'Scheduler logs endpoint',
      currentStatus: status,
      timestamp: new Date().toISOString(),
      note: 'Check console output for detailed logs'
    };
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Error getting scheduler logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get scheduler logs',
      error: error.message
    });
  }
});

module.exports = router;