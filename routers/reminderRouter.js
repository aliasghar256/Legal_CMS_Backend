const express = require('express');
const ReminderController = require('../controllers/ReminderController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All reminder routes require authentication
router.use(authMiddleware);

// Create new reminder
router.post('/', ReminderController.createReminder);

// Get all reminders for authenticated user
router.get('/', ReminderController.getUserReminders);

// Get reminder by ID
router.get('/:id', ReminderController.getReminderById);

// Get reminders by case ID
router.get('/case/:case_id', ReminderController.getRemindersByCaseId);

// Update reminder
router.put('/:id', ReminderController.updateReminder);

// Delete reminder
router.delete('/:id', ReminderController.deleteReminder);

// Send test email
router.post('/test-email', ReminderController.sendTestEmail);

// Process due reminders (admin function)
router.post('/process-due', ReminderController.processDueReminders);

// Get status summary
router.get('/status', ReminderController.getStatusSummary);

module.exports = router;