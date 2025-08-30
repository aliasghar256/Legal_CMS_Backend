const { query, transaction } = require('../lib/db');

class EmailReminder {
  /**
   * Create a new email reminder
   * @param {Object} emailReminderData - Email reminder information
   * @param {number} emailReminderData.email_id - Email ID (required)
   * @param {number} emailReminderData.reminder_id - Reminder ID (required)
   * @param {string} [emailReminderData.subject] - Email subject (optional)
   * @param {string} emailReminderData.message - Email message (required)
   * @param {string} [emailReminderData.status='pending'] - Email status (optional)
   * @param {string} [emailReminderData.contact_email] - Contact email address (optional)
   * @returns {Promise<Object>} Created email reminder data
   */
  static async create(emailReminderData) {
    try {
      const {
        email_id,
        reminder_id,
        subject = null,
        message,
        status = 'pending',
        contact_email = null
      } = emailReminderData;

      const result = await query(
        `INSERT INTO email_reminders (email_id, reminder_id, subject, message, status, contact_email) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING email_id, reminder_id, subject, message, sent_at, status, response, contact_email`,
        [email_id, reminder_id, subject, message, status, contact_email]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find email reminder by email ID
   * @param {number} email_id - Email ID
   * @returns {Promise<Object|null>} Email reminder data or null if not found
   */
  static async findByEmailId(email_id) {
    try {
      const result = await query(
        `SELECT email_id, reminder_id, subject, message, sent_at, status, response, contact_email 
         FROM email_reminders WHERE email_id = $1`,
        [email_id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find email reminder by reminder ID
   * @param {number} reminder_id - Reminder ID
   * @returns {Promise<Object|null>} Email reminder data or null if not found
   */
  static async findByReminderId(reminder_id) {
    try {
      const result = await query(
        `SELECT email_id, reminder_id, subject, message, sent_at, status, response, contact_email 
         FROM email_reminders WHERE reminder_id = $1`,
        [reminder_id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all email reminders with pagination and filtering
   * @param {number} [limit=20] - Number of records per page
   * @param {number} [offset=0] - Number of records to skip
   * @param {string} [status] - Filter by status (optional)
   * @returns {Promise<Object>} Email reminders data with pagination info
   */
  static async findAll(limit = 20, offset = 0, status = null) {
    try {
      let sql = `SELECT email_id, reminder_id, subject, message, sent_at, status, response, contact_email
                 FROM email_reminders`;
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

      sql += ` ORDER BY email_id DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);

      const result = await query(sql, params);

      // Get total count
      let countSql = 'SELECT COUNT(*) FROM email_reminders';
      let countParams = [];
      if (conditions.length > 0) {
        countSql += ' WHERE ' + conditions.join(' AND ');
        countParams = params.slice(0, -2); // Remove limit and offset
      }

      const countResult = await query(countSql, countParams);
      const total = parseInt(countResult.rows[0].count);

      return {
        emailReminders: result.rows,
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
   * Update email reminder
   * @param {number} email_id - Email ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated email reminder data or null if not found
   */
  static async update(email_id, updates) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      const allowedFields = ['subject', 'message', 'sent_at', 'status', 'response', 'contact_email'];

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

      values.push(email_id);
      const result = await query(
        `UPDATE email_reminders SET ${fields.join(', ')} WHERE email_id = $${paramCount} 
         RETURNING email_id, reminder_id, subject, message, sent_at, status, response, contact_email`,
        values
      );

      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Mark email as sent
   * @param {number} email_id - Email ID
   * @param {Object} [response] - Email service response
   * @returns {Promise<Object|null>} Updated email reminder data
   */
  static async markAsSent(email_id, response = null) {
    try {
      const updates = {
        status: 'sent',
        sent_at: new Date().toISOString(),
        response: response ? JSON.stringify(response) : null
      };
      return await this.update(email_id, updates);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Mark email as failed
   * @param {number} email_id - Email ID
   * @param {Object} [error] - Error information
   * @returns {Promise<Object|null>} Updated email reminder data
   */
  static async markAsFailed(email_id, error = null) {
    try {
      const updates = {
        status: 'failed',
        response: error ? JSON.stringify(error) : null
      };
      return await this.update(email_id, updates);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete email reminder
   * @param {number} email_id - Email ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  static async delete(email_id) {
    try {
      const result = await query(
        'DELETE FROM email_reminders WHERE email_id = $1 RETURNING email_id',
        [email_id]
      );
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get pending email reminders for processing
   * @returns {Promise<Array>} Array of pending email reminders
   */
  static async getPendingEmails() {
    try {
      const result = await query(
        `SELECT email_id, reminder_id, subject, message, sent_at, status, response, contact_email 
         FROM email_reminders 
         WHERE status = 'pending'
         ORDER BY email_id ASC`
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate next available email ID
   * @returns {Promise<number>} Next available email ID
   */
  static async getNextEmailId() {
    try {
      // First try to use the sequence if it exists
      const sequenceResult = await query(
        `SELECT nextval('email_reminders_email_id_seq') as next_id`
      ).catch(() => null);
      
      if (sequenceResult && sequenceResult.rows[0]) {
        return sequenceResult.rows[0].next_id;
      }
      
      // Fallback to manual ID generation if sequence doesn't exist
      const result = await query(
        'SELECT COALESCE(MAX(email_id), 0) + 1 as next_id FROM email_reminders'
      );
      return result.rows[0].next_id;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = EmailReminder;