const { query, transaction } = require('../lib/db');

class WhatsAppReminder {
  /**
   * Create a new WhatsApp reminder
   * @param {Object} whatsappReminderData - WhatsApp reminder information
   * @param {number} whatsappReminderData.whatsapp_id - WhatsApp ID (required)
   * @param {number} whatsappReminderData.reminder_id - Reminder ID (required)
   * @param {string} whatsappReminderData.message - WhatsApp message (required)
   * @param {string} [whatsappReminderData.status='pending'] - WhatsApp status (optional)
   * @param {string} [whatsappReminderData.contact_number] - Contact number (optional)
   * @returns {Promise<Object>} Created WhatsApp reminder data
   */
  static async create(whatsappReminderData) {
    try {
      const {
        whatsapp_id,
        reminder_id,
        message,
        status = 'pending',
        contact_number = null
      } = whatsappReminderData;

      const result = await query(
        `INSERT INTO whatsapp_reminders (whatsapp_id, reminder_id, message, status, contact_number) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING whatsapp_id, reminder_id, message, sent_at, status, response, contact_number`,
        [whatsapp_id, reminder_id, message, status, contact_number]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find WhatsApp reminder by WhatsApp ID
   * @param {number} whatsapp_id - WhatsApp ID
   * @returns {Promise<Object|null>} WhatsApp reminder data or null if not found
   */
  static async findByWhatsAppId(whatsapp_id) {
    try {
      const result = await query(
        `SELECT whatsapp_id, reminder_id, message, sent_at, status, response, contact_number 
         FROM whatsapp_reminders WHERE whatsapp_id = $1`,
        [whatsapp_id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find WhatsApp reminder by reminder ID
   * @param {number} reminder_id - Reminder ID
   * @returns {Promise<Object|null>} WhatsApp reminder data or null if not found
   */
  static async findByReminderId(reminder_id) {
    try {
      const result = await query(
        `SELECT whatsapp_id, reminder_id, message, sent_at, status, response, contact_number 
         FROM whatsapp_reminders WHERE reminder_id = $1`,
        [reminder_id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all WhatsApp reminders with pagination and filtering
   * @param {number} [limit=20] - Number of records per page
   * @param {number} [offset=0] - Number of records to skip
   * @param {string} [status] - Filter by status (optional)
   * @returns {Promise<Object>} WhatsApp reminders data with pagination info
   */
  static async findAll(limit = 20, offset = 0, status = null) {
    try {
      let sql = `SELECT whatsapp_id, reminder_id, message, sent_at, status, response, contact_number
                 FROM whatsapp_reminders`;
      let params = [];
      let conditions = [];
      let paramCount = 1;

      if (status) {
        conditions.push(`status = $${paramCount}`);
        params.push(status);
        paramCount++;
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ` ORDER BY whatsapp_id DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);

      const result = await query(sql, params);

      // Get total count
      let countSql = 'SELECT COUNT(*) FROM whatsapp_reminders';
      let countParams = [];
      if (conditions.length > 0) {
        countSql += ' WHERE ' + conditions.join(' AND ');
        countParams = params.slice(0, -2); // Remove limit and offset
      }

      const countResult = await query(countSql, countParams);
      const total = parseInt(countResult.rows[0].count);

      return {
        whatsappReminders: result.rows,
        pagination: {
          limit,
          offset,
          total,
          hasMore: offset + limit < total
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update WhatsApp reminder
   * @param {number} whatsapp_id - WhatsApp ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated WhatsApp reminder data or null if not found
   */
  static async update(whatsapp_id, updates) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      const allowedFields = ['message', 'sent_at', 'status', 'response', 'contact_number'];

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key) && updates[key] !== undefined) {
          fields.push(`${key} = $${paramCount}`);
          values.push(updates[key]);
          paramCount++;
        }
      });

      if (fields.length === 0) {
        throw new Error('No valid fields to update');
      }

      values.push(whatsapp_id);
      const result = await query(
        `UPDATE whatsapp_reminders SET ${fields.join(', ')} WHERE whatsapp_id = $${paramCount} 
         RETURNING whatsapp_id, reminder_id, message, sent_at, status, response, contact_number`,
        values
      );

      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Mark WhatsApp message as sent
   * @param {number} whatsapp_id - WhatsApp ID
   * @param {Object} [response] - WhatsApp service response
   * @returns {Promise<Object|null>} Updated WhatsApp reminder data
   */
  static async markAsSent(whatsapp_id, response = null) {
    try {
      const updates = {
        status: 'sent',
        sent_at: new Date().toISOString(),
        response: response ? JSON.stringify(response) : null
      };
      return await this.update(whatsapp_id, updates);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Mark WhatsApp message as failed
   * @param {number} whatsapp_id - WhatsApp ID
   * @param {Object} [error] - Error information
   * @returns {Promise<Object|null>} Updated WhatsApp reminder data
   */
  static async markAsFailed(whatsapp_id, error = null) {
    try {
      const updates = {
        status: 'failed',
        response: error ? JSON.stringify(error) : null
      };
      return await this.update(whatsapp_id, updates);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete WhatsApp reminder
   * @param {number} whatsapp_id - WhatsApp ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  static async delete(whatsapp_id) {
    try {
      const result = await query(
        'DELETE FROM whatsapp_reminders WHERE whatsapp_id = $1 RETURNING whatsapp_id',
        [whatsapp_id]
      );
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get pending WhatsApp reminders for processing
   * @returns {Promise<Array>} Array of pending WhatsApp reminders
   */
  static async getPendingMessages() {
    try {
      const result = await query(
        `SELECT whatsapp_id, reminder_id, message, sent_at, status, response, contact_number 
         FROM whatsapp_reminders 
         WHERE status = 'pending'
         ORDER BY whatsapp_id ASC`
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate next available WhatsApp ID
   * @returns {Promise<number>} Next available WhatsApp ID
   */
  static async getNextWhatsAppId() {
    try {
      // First try to use the sequence if it exists
      const sequenceResult = await query(
        `SELECT nextval('whatsapp_reminders_whatsapp_id_seq') as next_id`
      ).catch(() => null);
      
      if (sequenceResult && sequenceResult.rows[0]) {
        return sequenceResult.rows[0].next_id;
      }
      
      // Fallback to manual ID generation if sequence doesn't exist
      const result = await query(
        'SELECT COALESCE(MAX(whatsapp_id), 0) + 1 as next_id FROM whatsapp_reminders'
      );
      return result.rows[0].next_id;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = WhatsAppReminder;