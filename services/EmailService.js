const { Resend } = require('resend');

class EmailService {
  constructor() {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is required');
    }
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  /**
   * Send a reminder email
   * @param {Object} emailData - Email data
   * @param {string} emailData.to - Recipient email address
   * @param {string} emailData.subject - Email subject
   * @param {string} emailData.message - Email message (HTML or text)
   * @param {string} [emailData.from] - Sender email (optional, uses default from env)
   * @returns {Promise<Object>} Email send result
   */
  async sendReminderEmail(emailData) {
    try {
      const { to, subject, message, from } = emailData;

      if (!to || !subject || !message) {
        throw new Error('Missing required email fields: to, subject, message');
      }

      const emailOptions = {
        from: from || process.env.DEFAULT_FROM_EMAIL || 'reminders@legalcms.com',
        to: to,
        subject: subject,
        html: this.formatReminderEmail(message, subject)
      };

      const result = await this.resend.emails.send(emailOptions);
      
      return {
        success: true,
        messageId: result.data?.id,
        response: result
      };
    } catch (error) {
      console.error('Error sending reminder email:', error);
      return {
        success: false,
        error: error.message,
        response: error
      };
    }
  }

  /**
   * Send a case reminder email
   * @param {Object} reminderData - Reminder data
   * @param {string} reminderData.userEmail - User email address
   * @param {string} reminderData.userName - User name
   * @param {string} reminderData.caseNumber - Case number
   * @param {string} reminderData.courtName - Court name
   * @param {string} reminderData.message - Custom reminder message
   * @param {Date} reminderData.scheduledTime - Scheduled reminder time
   * @param {Object} [reminderData.hearing] - Hearing information (optional)
   * @returns {Promise<Object>} Email send result
   */
  async sendCaseReminderEmail(reminderData) {
    try {
      const {
        userEmail,
        userName,
        caseNumber,
        courtName,
        message,
        scheduledTime,
        hearing
      } = reminderData;

      const subject = hearing 
        ? `Hearing Reminder: ${caseNumber} - ${courtName}`
        : `Case Reminder: ${caseNumber} - ${courtName}`;

      const emailContent = this.generateCaseReminderContent({
        userName,
        caseNumber,
        courtName,
        message,
        scheduledTime,
        hearing
      });

      return await this.sendReminderEmail({
        to: userEmail,
        subject: subject,
        message: emailContent
      });
    } catch (error) {
      console.error('Error sending case reminder email:', error);
      return {
        success: false,
        error: error.message,
        response: error
      };
    }
  }

  /**
   * Format reminder email with HTML template
   * @param {string} message - Email message
   * @param {string} subject - Email subject
   * @returns {string} Formatted HTML email
   */
  formatReminderEmail(message, subject) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #2c3e50;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
          }
          .content {
            background-color: #f8f9fa;
            padding: 30px;
            border-radius: 0 0 5px 5px;
            border: 1px solid #dee2e6;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            font-size: 12px;
            color: #6c757d;
          }
          .reminder-content {
            background-color: white;
            padding: 20px;
            border-radius: 5px;
            margin: 15px 0;
            border-left: 4px solid #007bff;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Legal CMS Reminder</h1>
        </div>
        <div class="content">
          <div class="reminder-content">
            ${message}
          </div>
        </div>
        <div class="footer">
          <p>This is an automated reminder from Legal Case Management System</p>
          <p>Please do not reply to this email</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate case reminder email content
   * @param {Object} data - Reminder data
   * @returns {string} Generated HTML content
   */
  generateCaseReminderContent(data) {
    const {
      userName,
      caseNumber,
      courtName,
      message,
      scheduledTime,
      hearing
    } = data;

    let content = `
      <h2>Hello ${userName},</h2>
      <p>This is a reminder regarding your case:</p>
      
      <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <strong>Case Number:</strong> ${caseNumber}<br>
        <strong>Court:</strong> ${courtName}<br>
        <strong>Reminder Time:</strong> ${new Date(scheduledTime).toLocaleString()}
      </div>
    `;

    if (hearing) {
      content += `
        <div style="background-color: #fff3e0; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3>Hearing Information:</h3>
          <strong>Date:</strong> ${new Date(hearing.date).toLocaleDateString()}<br>
          <strong>Type:</strong> ${hearing.type || 'N/A'}<br>
          <strong>Description:</strong> ${hearing.description || 'N/A'}
        </div>
      `;
    }

    if (message) {
      content += `
        <div style="background-color: #f1f8e9; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3>Additional Notes:</h3>
          <p>${message}</p>
        </div>
      `;
    }

    content += `
      <p>Please ensure you are prepared for any upcoming proceedings.</p>
      <p>Best regards,<br>Legal Case Management System</p>
    `;

    return content;
  }

  /**
   * Test email service connection
   * @returns {Promise<Object>} Test result
   */
  async testConnection() {
    try {
      // Send a test email to verify the service is working
      const testEmail = {
        to: process.env.TEST_EMAIL || 'test@example.com',
        subject: 'Legal CMS Email Service Test',
        message: 'This is a test email to verify the email service is working correctly.'
      };

      const result = await this.sendReminderEmail(testEmail);
      return {
        success: true,
        message: 'Email service is working correctly',
        result
      };
    } catch (error) {
      return {
        success: false,
        message: 'Email service test failed',
        error: error.message
      };
    }
  }
}

module.exports = EmailService;