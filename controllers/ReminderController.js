const Reminder = require('../models/Reminder');
const UserReminder = require('../models/UserReminder');
const EmailReminder = require('../models/EmailReminder');
const WhatsAppReminder = require('../models/WhatsAppReminder');
const EmailService = require('../services/EmailService');
const ReminderService = require('../services/ReminderService');
const { transaction } = require('../lib/db');

class ReminderController {
  /**
   * Create a new reminder with email and/or WhatsApp
   */
  static async createReminder(req, res) {
    try {
      const {
        case_id,
        hearing_id,
        scheduled_time,
        note,
        email_reminder,
        whatsapp_reminder
      } = req.body;

      const user_id = req.user.user_id;

      // Validate required fields
      if (!case_id || !scheduled_time) {
        return res.status(400).json({
          success: false,
          message: 'case_id and scheduled_time are required'
        });
      }

      // Validate that at least one reminder type is provided
      if (!email_reminder && !whatsapp_reminder) {
        return res.status(400).json({
          success: false,
          message: 'At least one reminder type (email or whatsapp) must be provided'
        });
      }

      const result = await transaction(async (client) => {
        // Generate reminder ID
        const reminder_id = await Reminder.getNextReminderId();

        let email_id = null;
        let whatsapp_id = null;

        const createdReminders = {
          reminder: null,
          email: null,
          whatsapp: null
        };

        // Create main reminder FIRST with NULL email_id and whatsapp_id
        const reminder = await Reminder.create({
          reminder_id,
          scheduled_time,
          note,
          whatsapp_id: null, // Set to null initially
          email_id: null     // Set to null initially
        });
        createdReminders.reminder = reminder;

        // Create user reminder association
        await UserReminder.create({
          user_id,
          case_id: parseInt(case_id),
          hearing_id: hearing_id ? parseInt(hearing_id) : null,
          reminder_id
        });

        // Now create email reminder if provided (after main reminder exists)
        if (email_reminder) {
          const { subject, message, contact_email } = email_reminder;
          if (!message) {
            throw new Error('Email message is required for email reminders');
          }

          email_id = await EmailReminder.getNextEmailId();
          const emailReminder = await EmailReminder.create({
            email_id,
            reminder_id,
            subject,
            message,
            contact_email
          });
          createdReminders.email = emailReminder;
        }

        // Create WhatsApp reminder if provided (after main reminder exists)
        if (whatsapp_reminder) {
          const { message, contact_number } = whatsapp_reminder;
          if (!message) {
            throw new Error('WhatsApp message is required for WhatsApp reminders');
          }

          whatsapp_id = await WhatsAppReminder.getNextWhatsAppId();
          const whatsappReminder = await WhatsAppReminder.create({
            whatsapp_id,
            reminder_id,
            message,
            contact_number
          });
          createdReminders.whatsapp = whatsappReminder;
        }

        // Update the reminder with the actual email_id and whatsapp_id if they exist
        if (email_id || whatsapp_id) {
          const updatedReminder = await Reminder.update(reminder_id, {
            email_id,
            whatsapp_id
          });
          createdReminders.reminder = updatedReminder;
        }

        return createdReminders;
      });

      res.status(201).json({
        success: true,
        message: 'Reminder created successfully',
        data: result
      });
    } catch (error) {
      console.error('Error in createReminder:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get all reminders for the authenticated user
   */
  static async getUserReminders(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;
      const user_id = req.user.user_id;

      const result = await UserReminder.findByUserId(
        user_id,
        parseInt(limit),
        parseInt(offset)
      );

      // Get email and WhatsApp reminders for each reminder
      for (let reminder of result.reminders) {
        const emailReminder = await EmailReminder.findByReminderId(reminder.reminder_id);
        const whatsappReminder = await WhatsAppReminder.findByReminderId(reminder.reminder_id);
        
        reminder.email_reminder = emailReminder;
        reminder.whatsapp_reminder = whatsappReminder;
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error in getUserReminders:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get reminder by ID
   */
  static async getReminderById(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.user_id;

      // Validate reminder ID
      const reminderId = parseInt(id);
      if (isNaN(reminderId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reminder ID'
        });
      }

      const userReminder = await UserReminder.findByReminderId(reminderId);
      
      if (!userReminder) {
        return res.status(404).json({
          success: false,
          message: 'Reminder not found'
        });
      }

      // Check if the reminder belongs to the authenticated user
      if (userReminder.user_id !== user_id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Get email and WhatsApp reminders
      const emailReminder = await EmailReminder.findByReminderId(reminderId);
      const whatsappReminder = await WhatsAppReminder.findByReminderId(reminderId);

      const result = {
        ...userReminder,
        email_reminder: emailReminder,
        whatsapp_reminder: whatsappReminder
      };

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error in getReminderById:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get reminders by case ID
   */
  static async getRemindersByCaseId(req, res) {
    try {
      const { case_id } = req.params;
      const user_id = req.user.user_id;

      const reminders = await UserReminder.findByCaseId(parseInt(case_id));
      
      // Filter reminders to only include those belonging to the authenticated user
      const userReminders = reminders.filter(reminder => reminder.user_id === user_id);

      // Get email and WhatsApp reminders for each reminder
      for (let reminder of userReminders) {
        const emailReminder = await EmailReminder.findByReminderId(reminder.reminder_id);
        const whatsappReminder = await WhatsAppReminder.findByReminderId(reminder.reminder_id);
        
        reminder.email_reminder = emailReminder;
        reminder.whatsapp_reminder = whatsappReminder;
      }

      res.json({
        success: true,
        data: userReminders
      });
    } catch (error) {
      console.error('Error in getRemindersByCaseId:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Update reminder
   */
  static async updateReminder(req, res) {
    try {
      const { id } = req.params;
      const { scheduled_time, note, email_reminder, whatsapp_reminder } = req.body;
      const user_id = req.user.user_id;

      // Validate reminder ID
      const reminderId = parseInt(id);
      if (isNaN(reminderId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reminder ID'
        });
      }

      // Check if reminder belongs to user
      const userReminder = await UserReminder.findByReminderId(reminderId);
      if (!userReminder || userReminder.user_id !== user_id) {
        return res.status(404).json({
          success: false,
          message: 'Reminder not found or access denied'
        });
      }

      const result = await transaction(async (client) => {
        // Update main reminder
        const updates = {};
        if (scheduled_time) updates.scheduled_time = scheduled_time;
        if (note !== undefined) updates.note = note;

        let updatedReminder = null;
        if (Object.keys(updates).length > 0) {
          updatedReminder = await Reminder.update(reminderId, updates);
        }

        const updateResults = {
          reminder: updatedReminder,
          email: null,
          whatsapp: null
        };

        // Update email reminder if provided
        if (email_reminder) {
          const existingEmailReminder = await EmailReminder.findByReminderId(reminderId);
          if (existingEmailReminder) {
            const emailUpdates = {};
            if (email_reminder.subject !== undefined) emailUpdates.subject = email_reminder.subject;
            if (email_reminder.message !== undefined) emailUpdates.message = email_reminder.message;
            if (email_reminder.contact_email !== undefined) emailUpdates.contact_email = email_reminder.contact_email;
            
            if (Object.keys(emailUpdates).length > 0) {
              updateResults.email = await EmailReminder.update(existingEmailReminder.email_id, emailUpdates);
            }
          }
        }

        // Update WhatsApp reminder if provided
        if (whatsapp_reminder) {
          const existingWhatsAppReminder = await WhatsAppReminder.findByReminderId(reminderId);
          if (existingWhatsAppReminder) {
            const whatsappUpdates = {};
            if (whatsapp_reminder.message !== undefined) whatsappUpdates.message = whatsapp_reminder.message;
            if (whatsapp_reminder.contact_number !== undefined) whatsappUpdates.contact_number = whatsapp_reminder.contact_number;
            
            if (Object.keys(whatsappUpdates).length > 0) {
              updateResults.whatsapp = await WhatsAppReminder.update(existingWhatsAppReminder.whatsapp_id, whatsappUpdates);
            }
          }
        }

        return updateResults;
      });

      res.json({
        success: true,
        message: 'Reminder updated successfully',
        data: result
      });
    } catch (error) {
      console.error('Error in updateReminder:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Delete reminder
   */
  static async deleteReminder(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.user_id;

      // Validate reminder ID
      const reminderId = parseInt(id);
      if (isNaN(reminderId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reminder ID'
        });
      }

      // Check if reminder belongs to user
      const userReminder = await UserReminder.findByReminderId(reminderId);
      if (!userReminder || userReminder.user_id !== user_id) {
        return res.status(404).json({
          success: false,
          message: 'Reminder not found or access denied'
        });
      }

      const result = await transaction(async (client) => {
        // Delete email reminder if exists
        const emailReminder = await EmailReminder.findByReminderId(reminderId);
        if (emailReminder) {
          await EmailReminder.delete(emailReminder.email_id);
        }

        // Delete WhatsApp reminder if exists
        const whatsappReminder = await WhatsAppReminder.findByReminderId(reminderId);
        if (whatsappReminder) {
          await WhatsAppReminder.delete(whatsappReminder.whatsapp_id);
        }

        // Delete user reminder association
        await UserReminder.delete(user_id, reminderId);

        // Delete main reminder
        await Reminder.delete(reminderId);

        return true;
      });

      res.json({
        success: true,
        message: 'Reminder deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteReminder:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Send test email using the email service
   */
  static async sendTestEmail(req, res) {
    try {
      const { to, subject, message } = req.body;

      if (!to || !subject || !message) {
        return res.status(400).json({
          success: false,
          message: 'to, subject, and message are required'
        });
      }

      const emailService = new EmailService();
      const result = await emailService.sendReminderEmail({
        to,
        subject,
        message
      });

      if (result.success) {
        res.json({
          success: true,
          message: 'Test email sent successfully',
          data: result
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to send test email',
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error in sendTestEmail:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Process due reminders manually
   */
  static async processDueReminders(req, res) {
    try {
      const reminderService = new ReminderService();
      const result = await reminderService.processDueReminders();

      res.json({
        success: true,
        message: 'Due reminders processed',
        data: result
      });
    } catch (error) {
      console.error('Error in processDueReminders:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get reminders status summary
   */
  static async getStatusSummary(req, res) {
    try {
      const reminderService = new ReminderService();
      const summary = await reminderService.getStatusSummary();

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('Error in getStatusSummary:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

module.exports = ReminderController;