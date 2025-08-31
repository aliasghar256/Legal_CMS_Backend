const axios = require('axios');

class WhatsAppService {
  constructor() {
    // Check for required environment variables
    this.apiUrl = process.env.WHATSAPP_API_URL;
    this.apiToken = process.env.WHATSAPP_API_TOKEN;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    
    // Default to Meta's WhatsApp Business API format
    this.baseUrl = this.apiUrl || `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;
    
    if (!this.apiToken) {
      console.warn('WHATSAPP_API_TOKEN not found. WhatsApp service will use simulation mode.');
      this.simulationMode = true;
    } else {
      this.simulationMode = false;
    }
  }

  /**
   * Send a WhatsApp message
   * @param {Object} messageData - Message data
   * @param {string} messageData.to - Recipient phone number (with country code)
   * @param {string} messageData.message - Message text
   * @param {string} [messageData.type='text'] - Message type
   * @returns {Promise<Object>} Send result
   */
  async sendMessage(messageData) {
    try {
      const { to, message, type = 'text' } = messageData;

      if (!to || !message) {
        throw new Error('Missing required fields: to, message');
      }

      // Clean phone number (remove non-digits except +)
      const cleanPhone = this.cleanPhoneNumber(to);

      if (this.simulationMode) {
        return this.simulateMessage(cleanPhone, message);
      }

      // Meta WhatsApp Business API format
      const payload = {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: type,
        text: {
          body: message
        }
      };

      const headers = {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      };

      const response = await axios.post(this.baseUrl, payload, { headers });

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
        response: response.data,
        recipient: cleanPhone
      };

    } catch (error) {
      console.error('Error sending WhatsApp message:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        response: error.response?.data || error
      };
    }
  }

  /**
   * Send a reminder WhatsApp message with rich formatting
   * @param {Object} reminderData - Reminder data
   * @param {string} reminderData.phoneNumber - Recipient phone number
   * @param {string} reminderData.userName - User name
   * @param {string} reminderData.caseNumber - Case number
   * @param {string} reminderData.courtName - Court name
   * @param {string} reminderData.message - Custom reminder message
   * @param {Date} reminderData.scheduledTime - Scheduled reminder time
   * @param {Object} [reminderData.hearing] - Hearing information (optional)
   * @returns {Promise<Object>} Send result
   */
  async sendReminderMessage(reminderData) {
    try {
      const {
        phoneNumber,
        userName,
        caseNumber,
        courtName,
        message,
        scheduledTime,
        hearing
      } = reminderData;

      const formattedMessage = this.formatReminderMessage({
        userName,
        caseNumber,
        courtName,
        message,
        scheduledTime,
        hearing
      });

      return await this.sendMessage({
        to: phoneNumber,
        message: formattedMessage
      });

    } catch (error) {
      console.error('Error sending reminder WhatsApp message:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Format reminder message for WhatsApp
   * @param {Object} data - Reminder data
   * @returns {string} Formatted message
   */
  formatReminderMessage(data) {
    const {
      userName,
      caseNumber,
      courtName,
      message,
      scheduledTime,
      hearing
    } = data;

    let formattedMessage = `🏛️ *Legal CMS Reminder*\n\n`;
    formattedMessage += `Hello *${userName}*,\n\n`;
    
    if (message) {
      formattedMessage += `📋 ${message}\n\n`;
    }
    
    formattedMessage += `📄 *Case Details:*\n`;
    formattedMessage += `• Case Number: ${caseNumber}\n`;
    formattedMessage += `• Court: ${courtName}\n`;
    formattedMessage += `• Reminder Time: ${new Date(scheduledTime).toLocaleString()}\n`;
    
    if (hearing) {
      formattedMessage += `\n⚖️ *Hearing Information:*\n`;
      formattedMessage += `• Date: ${new Date(hearing.date).toLocaleDateString()}\n`;
      
      if (hearing.type) {
        formattedMessage += `• Type: ${hearing.type}\n`;
      }
      
      if (hearing.description) {
        formattedMessage += `• Description: ${hearing.description}\n`;
      }
    }
    
    formattedMessage += `\n⏰ Please ensure you are prepared for any upcoming proceedings.\n\n`;
    formattedMessage += `---\n`;
    formattedMessage += `_This is an automated reminder from Legal Case Management System_`;
    
    return formattedMessage;
  }

  /**
   * Clean phone number to international format
   * @param {string} phoneNumber - Raw phone number
   * @returns {string} Cleaned phone number
   */
  cleanPhoneNumber(phoneNumber) {
    // Remove all non-digit characters except +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // If it doesn't start with +, assume it needs country code
    if (!cleaned.startsWith('+')) {
      // Add default country code (you can modify this based on your region)
      cleaned = '+1' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Simulate sending a message (for testing/development)
   * @param {string} phoneNumber - Phone number
   * @param {string} message - Message text
   * @returns {Promise<Object>} Simulated result
   */
  async simulateMessage(phoneNumber, message) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log(`[WhatsApp Simulation] Sending to ${phoneNumber}:`);
    console.log(`[WhatsApp Simulation] Message: ${message}`);
    console.log(`[WhatsApp Simulation] Status: Delivered (Simulated)`);
    
    return {
      success: true,
      messageId: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      response: {
        simulation: true,
        message: 'Message sent successfully (simulation mode)',
        timestamp: new Date().toISOString()
      },
      recipient: phoneNumber
    };
  }

  /**
   * Send a test message
   * @param {string} phoneNumber - Test phone number
   * @returns {Promise<Object>} Test result
   */
  async sendTestMessage(phoneNumber) {
    const testMessage = `🧪 *WhatsApp Service Test*\n\nThis is a test message from Legal Case Management System.\n\nTime: ${new Date().toLocaleString()}\n\n✅ WhatsApp service is working correctly!`;
    
    return await this.sendMessage({
      to: phoneNumber,
      message: testMessage
    });
  }

  /**
   * Test WhatsApp service connection
   * @returns {Promise<Object>} Test result
   */
  async testConnection() {
    try {
      if (this.simulationMode) {
        return {
          success: true,
          message: 'WhatsApp service is in simulation mode (no API token configured)',
          simulationMode: true
        };
      }

      // Test with a sample phone number (you should set this in env)
      const testPhone = process.env.WHATSAPP_TEST_PHONE || '+1234567890';
      const result = await this.sendTestMessage(testPhone);
      
      return {
        success: result.success,
        message: result.success ? 'WhatsApp service is working correctly' : 'WhatsApp service test failed',
        result
      };
    } catch (error) {
      return {
        success: false,
        message: 'WhatsApp service test failed',
        error: error.message
      };
    }
  }

  /**
   * Validate phone number format
   * @param {string} phoneNumber - Phone number to validate
   * @returns {boolean} True if valid
   */
  isValidPhoneNumber(phoneNumber) {
    // Basic validation for international phone numbers
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    const cleaned = this.cleanPhoneNumber(phoneNumber);
    return phoneRegex.test(cleaned);
  }

  /**
   * Get service status
   * @returns {Object} Service status information
   */
  getStatus() {
    return {
      configured: !this.simulationMode,
      simulationMode: this.simulationMode,
      apiUrl: this.baseUrl,
      phoneNumberId: this.phoneNumberId,
      hasToken: !!this.apiToken
    };
  }
}

module.exports = WhatsAppService;