const Reminder = require('../models/Reminder');
const EmailReminder = require('../models/EmailReminder');
const WhatsAppReminder = require('../models/WhatsAppReminder');
const UserReminder = require('../models/UserReminder');
const EmailService = require('./EmailService');
const WhatsAppService = require('./WhatsAppService');
const { query } = require('../lib/db');

class ReminderService {
  constructor() {
    this.emailService = new EmailService();
    this.whatsappService = new WhatsAppService();
    this.processingReminders = new Set(); // Track reminders being processed
  }

  /**
   * Process all due reminders
   * @param {Date} [checkTime] - Time to check against (defaults to now)
   * @returns {Promise<Object>} Processing results
   */
  async processDueReminders(checkTime = new Date()) {
    try {
      console.log(`Processing reminders due before: ${checkTime.toISOString()}`);
      
      const dueReminders = await Reminder.getScheduledReminders(checkTime);
      
      if (dueReminders.length === 0) {
        return {
          success: true,
          processed: 0,
          message: 'No due reminders found'
        };
      }

      console.log(`Found ${dueReminders.length} due reminders`);
      
      const results = {
        success: true,
        processed: 0,
        failed: 0,
        details: []
      };

      for (const reminder of dueReminders) {
        try {
          // Skip if already being processed
          if (this.processingReminders.has(reminder.reminder_id)) {
            console.log(`Skipping reminder ${reminder.reminder_id} - already processing`);
            continue;
          }

          this.processingReminders.add(reminder.reminder_id);
          
          const result = await this.processReminder(reminder);
          results.details.push(result);
          
          if (result.success) {
            results.processed++;
          } else {
            results.failed++;
          }
          
        } catch (error) {
          console.error(`Error processing reminder ${reminder.reminder_id}:`, error);
          results.failed++;
          results.details.push({
            reminder_id: reminder.reminder_id,
            success: false,
            error: error.message
          });
        } finally {
          this.processingReminders.delete(reminder.reminder_id);
        }
      }

      return results;
    } catch (error) {
      console.error('Error in processDueReminders:', error);
      throw error;
    }
  }

  /**
   * Process a single reminder
   * @param {Object} reminder - Reminder data
   * @returns {Promise<Object>} Processing result
   */
  async processReminder(reminder) {
    try {
      console.log(`Processing reminder ${reminder.reminder_id}`);
      
      // Get user and case information
      const reminderDetails = await this.getReminderDetails(reminder.reminder_id);
      
      if (!reminderDetails) {
        throw new Error('Unable to get reminder details');
      }

      const results = {
        reminder_id: reminder.reminder_id,
        success: true,
        email_sent: false,
        whatsapp_sent: false,
        errors: []
      };

      // Process email reminder if exists
      if (reminder.email_id) {
        try {
          const emailResult = await this.sendEmailReminder(reminder.email_id, reminderDetails);
          results.email_sent = emailResult.success;
          if (!emailResult.success) {
            results.errors.push(`Email: ${emailResult.error}`);
          }
        } catch (error) {
          results.errors.push(`Email error: ${error.message}`);
        }
      }

      // Process WhatsApp reminder if exists
      if (reminder.whatsapp_id) {
        try {
          const whatsappResult = await this.sendWhatsAppReminder(reminder.whatsapp_id, reminderDetails);
          results.whatsapp_sent = whatsappResult.success;
          if (!whatsappResult.success) {
            results.errors.push(`WhatsApp: ${whatsappResult.error}`);
          }
        } catch (error) {
          results.errors.push(`WhatsApp error: ${error.message}`);
        }
      }

      // Update reminder status
      const newStatus = (results.email_sent || results.whatsapp_sent) ? 'sent' : 'failed';
      await Reminder.update(reminder.reminder_id, { status: newStatus });

      results.success = results.errors.length === 0;
      
      console.log(`Reminder ${reminder.reminder_id} processed: ${newStatus}`);
      return results;
      
    } catch (error) {
      console.error(`Error processing reminder ${reminder.reminder_id}:`, error);
      return {
        reminder_id: reminder.reminder_id,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get complete reminder details including user and case information
   * @param {number} reminder_id - Reminder ID
   * @returns {Promise<Object|null>} Complete reminder details
   */
  async getReminderDetails(reminder_id) {
    try {
      const result = await query(`
        SELECT 
          r.reminder_id,
          r.scheduled_time,
          r.note,
          u.name as user_name,
          u.email as user_email,
          u.phone_number as user_phone,
          c.case_number,
          c.court_name,
          c.case_type,
          c.description as case_description,
          h.hearing_id,
          h.date as hearing_date,
          h.type as hearing_type,
          h.description as hearing_description
        FROM reminders r
        JOIN user_reminders ur ON r.reminder_id = ur.reminder_id
        JOIN users u ON ur.user_id = u.user_id
        JOIN cases c ON ur.case_id = c.case_id
        LEFT JOIN hearings h ON ur.hearing_id = h.hearing_id
        WHERE r.reminder_id = $1
      `, [reminder_id]);

      return result.rows[0] || null;
    } catch (error) {
      console.error(`Error getting reminder details for ${reminder_id}:`, error);
      throw error;
    }
  }

  /**
   * Send email reminder
   * @param {number} email_id - Email reminder ID
   * @param {Object} reminderDetails - Complete reminder details
   * @returns {Promise<Object>} Send result
   */
  async sendEmailReminder(email_id, reminderDetails) {
    try {
      const emailReminder = await EmailReminder.findByEmailId(email_id);
      
      if (!emailReminder) {
        throw new Error(`Email reminder ${email_id} not found`);
      }

      // Determine recipient email
      const recipientEmail = emailReminder.contact_email || reminderDetails.user_email;
      
      if (!recipientEmail) {
        throw new Error('No recipient email address available');
      }

      // Send email using EmailService
      const emailData = {
        userEmail: recipientEmail,
        userName: reminderDetails.user_name,
        caseNumber: reminderDetails.case_number,
        courtName: reminderDetails.court_name,
        message: emailReminder.message,
        scheduledTime: reminderDetails.scheduled_time,
        hearing: reminderDetails.hearing_id ? {
          date: reminderDetails.hearing_date,
          type: reminderDetails.hearing_type,
          description: reminderDetails.hearing_description
        } : null
      };

      const result = await this.emailService.sendCaseReminderEmail(emailData);
      
      if (result.success) {
        await EmailReminder.markAsSent(email_id, result.response);
        console.log(`Email reminder ${email_id} sent successfully to ${recipientEmail}`);
      } else {
        await EmailReminder.markAsFailed(email_id, result);
        console.error(`Failed to send email reminder ${email_id}:`, result.error);
      }

      return result;
    } catch (error) {
      console.error(`Error sending email reminder ${email_id}:`, error);
      await EmailReminder.markAsFailed(email_id, { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send WhatsApp reminder using WhatsAppService
   * @param {number} whatsapp_id - WhatsApp reminder ID
   * @param {Object} reminderDetails - Complete reminder details
   * @returns {Promise<Object>} Send result
   */
  async sendWhatsAppReminder(whatsapp_id, reminderDetails) {
    try {
      const whatsappReminder = await WhatsAppReminder.findByWhatsAppId(whatsapp_id);
      
      if (!whatsappReminder) {
        throw new Error(`WhatsApp reminder ${whatsapp_id} not found`);
      }

      // Determine recipient phone number
      const recipientPhone = whatsappReminder.contact_number || reminderDetails.user_phone;
      
      if (!recipientPhone) {
        throw new Error('No recipient phone number available');
      }

      // Validate phone number format
      if (!this.whatsappService.isValidPhoneNumber(recipientPhone)) {
        throw new Error(`Invalid phone number format: ${recipientPhone}`);
      }

      // Prepare reminder data for WhatsApp service
      const whatsappData = {
        phoneNumber: recipientPhone,
        userName: reminderDetails.user_name,
        caseNumber: reminderDetails.case_number,
        courtName: reminderDetails.court_name,
        message: whatsappReminder.message,
        scheduledTime: reminderDetails.scheduled_time,
        hearing: reminderDetails.hearing_id ? {
          date: reminderDetails.hearing_date,
          type: reminderDetails.hearing_type,
          description: reminderDetails.hearing_description
        } : null
      };

      const result = await this.whatsappService.sendReminderMessage(whatsappData);
      
      if (result.success) {
        await WhatsAppReminder.markAsSent(whatsapp_id, result.response);
        console.log(`WhatsApp reminder ${whatsapp_id} sent successfully to ${recipientPhone}`);
      } else {
        await WhatsAppReminder.markAsFailed(whatsapp_id, result);
        console.error(`Failed to send WhatsApp reminder ${whatsapp_id}:`, result.error);
      }

      return result;
    } catch (error) {
      console.error(`Error sending WhatsApp reminder ${whatsapp_id}:`, error);
      await WhatsAppReminder.markAsFailed(whatsapp_id, { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get reminders status summary
   * @returns {Promise<Object>} Status summary
   */
  async getStatusSummary() {
    try {
      const statusResult = await query(`
        SELECT 
          status,
          COUNT(*) as count
        FROM reminders 
        GROUP BY status
      `);

      const emailStatusResult = await query(`
        SELECT 
          status,
          COUNT(*) as count
        FROM email_reminders 
        GROUP BY status
      `);

      const whatsappStatusResult = await query(`
        SELECT 
          status,
          COUNT(*) as count
        FROM whatsapp_reminders 
        GROUP BY status
      `);

      return {
        reminders: statusResult.rows.reduce((acc, row) => {
          acc[row.status] = parseInt(row.count);
          return acc;
        }, {}),
        email_reminders: emailStatusResult.rows.reduce((acc, row) => {
          acc[row.status] = parseInt(row.count);
          return acc;
        }, {}),
        whatsapp_reminders: whatsappStatusResult.rows.reduce((acc, row) => {
          acc[row.status] = parseInt(row.count);
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('Error getting status summary:', error);
      throw error;
    }
  }

  /**
   * Start automated reminder processing (for background job)
   * @param {number} intervalMinutes - Check interval in minutes
   */
  startAutomatedProcessing(intervalMinutes = 5) {
    console.log(`Starting automated reminder processing every ${intervalMinutes} minutes`);
    
    setInterval(async () => {
      try {
        const result = await this.processDueReminders();
        if (result.processed > 0 || result.failed > 0) {
          console.log(`Automated processing: ${result.processed} processed, ${result.failed} failed`);
        }
      } catch (error) {
        console.error('Error in automated reminder processing:', error);
      }
    }, intervalMinutes * 60 * 1000);
  }
}

module.exports = ReminderService;