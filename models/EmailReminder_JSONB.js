const { query, transaction } = require('../lib/db');

class EmailReminder {
  /**
   * Create a new email reminder with JSONB array support
   * @param {Object} emailReminderData - Email reminder information
   * @param {number} emailReminderData.email_id - Email ID (required)
   * @param {number} emailReminderData.reminder_id - Reminder ID (required)
   * @param {string} [emailReminderData.subject] - Email subject (optional)
   * @param {string} emailReminderData.message - Email message (required)
   * @param {string} [emailReminderData.status='pending'] - Email status (optional)
   * @param {string|string[]} [emailReminderData.contact_email] - Contact email address(es) (optional)
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

      // Handle multiple email addresses - convert to JSONB array
      let emailsToStore = null;
      if (contact_email) {
        if (Array.isArray(contact_email)) {
          // Already an array
          emailsToStore = JSON.stringify(contact_email);
        } else if (typeof contact_email === 'string') {
          // Check if it's comma-separated
          if (contact_email.includes(',')) {
            const emailArray = contact_email.split(',').map(email => email.trim()).filter(email => email);
            emailsToStore = JSON.stringify(emailArray);
          } else {
            // Single email
            emailsToStore = JSON.stringify([contact_email]);
          }
        }
      }

      const result = await query(
        `INSERT INTO email_reminders (email_id, reminder_id, subject, message, status, contact_email) 
         VALUES ($1, $2, $3, $4, $5, $6::jsonb) 
         RETURNING email_id, reminder_id, subject, message, sent_at, status, response, contact_email`,
        [email_id, reminder_id, subject, message, status, emailsToStore]
      );

      // Parse JSONB back to array for consistency
      const row = result.rows[0];
      if (row.contact_email) {
        row.contact_email = typeof row.contact_email === 'string' 
          ? JSON.parse(row.contact_email) 
          : row.contact_email;
      }

      return row;
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
      
      const row = result.rows[0];
      if (row && row.contact_email) {
        // Parse JSONB to array if needed
        row.contact_email = typeof row.contact_email === 'string' 
          ? JSON.parse(row.contact_email) 
          : row.contact_email;
      }
      
      return row || null;
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
      
      const row = result.rows[0];
      if (row && row.contact_email) {
        // Parse JSONB to array if needed
        row.contact_email = typeof row.contact_email === 'string' 
          ? JSON.parse(row.contact_email) 
          : row.contact_email;
      }
      
      return row || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find email reminders by specific email address
   * @param {string} email - Email address to search for
   * @returns {Promise<Array>} Array of email reminders containing this email
   */
  static async findByEmailAddress(email) {
    try {
      const result = await query(
        `SELECT email_id, reminder_id, subject, message, sent_at, status, response, contact_email 
         FROM email_reminders 
         WHERE contact_email ? $1`,
        [email]
      );
      
      return result.rows.map(row => {
        if (row.contact_email) {
          row.contact_email = typeof row.contact_email === 'string' 
            ? JSON.parse(row.contact_email) 
            : row.contact_email;
        }
        return row;
      });
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

      // Parse JSONB contact_email for all results
      const rows = result.rows.map(row => {
        if (row.contact_email) {
          row.contact_email = typeof row.contact_email === 'string' 
            ? JSON.parse(row.contact_email) 
            : row.contact_email;
        }
        return row;
      });

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
        emailReminders: rows,
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
          if (key === 'contact_email' && updates[key] !== null) {
            // Handle contact_email specially for JSONB
            let emailsToStore = null;
            if (Array.isArray(updates[key])) {
              emailsToStore = JSON.stringify(updates[key]);
            } else if (typeof updates[key] === 'string') {
              if (updates[key].includes(',')) {
                const emailArray = updates[key].split(',').map(email => email.trim()).filter(email => email);
                emailsToStore = JSON.stringify(emailArray);
              } else {
                emailsToStore = JSON.stringify([updates[key]]);
              }
            }
            fields.push(`${key} = $${paramCount}::jsonb`);
            values.push(emailsToStore);
          } else {
            fields.push(`${key} = $${paramCount}`);
            values.push(updates[key]);
          }
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

      const row = result.rows[0];
      if (row && row.contact_email) {
        row.contact_email = typeof row.contact_email === 'string' 
          ? JSON.parse(row.contact_email) 
          : row.contact_email;
      }

      return row || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Add email address to existing reminder
   * @param {number} email_id - Email ID
   * @param {string} newEmail - New email to add
   * @returns {Promise<Object|null>} Updated email reminder data
   */
  static async addEmailAddress(email_id, newEmail) {
    try {
      const result = await query(
        `UPDATE email_reminders 
         SET contact_email = COALESCE(contact_email, '[]'::jsonb) || $2::jsonb
         WHERE email_id = $1 
         RETURNING email_id, reminder_id, subject, message, sent_at, status, response, contact_email`,
        [email_id, JSON.stringify([newEmail])]
      );

      const row = result.rows[0];
      if (row && row.contact_email) {
        row.contact_email = typeof row.contact_email === 'string' 
          ? JSON.parse(row.contact_email) 
          : row.contact_email;
      }

      return row || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove email address from existing reminder
   * @param {number} email_id - Email ID
   * @param {string} emailToRemove - Email to remove
   * @returns {Promise<Object|null>} Updated email reminder data
   */
  static async removeEmailAddress(email_id, emailToRemove) {
    try {
      const result = await query(
        `UPDATE email_reminders 
         SET contact_email = contact_email - $2
         WHERE email_id = $1 
         RETURNING email_id, reminder_id, subject, message, sent_at, status, response, contact_email`,
        [email_id, emailToRemove]
      );

      const row = result.rows[0];
      if (row && row.contact_email) {
        row.contact_email = typeof row.contact_email === 'string' 
          ? JSON.parse(row.contact_email) 
          : row.contact_email;
      }

      return row || null;
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
      
      return result.rows.map(row => {
        if (row.contact_email) {
          row.contact_email = typeof row.contact_email === 'string' 
            ? JSON.parse(row.contact_email) 
            : row.contact_email;
        }
        return row;
      });
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

  /**
   * Get email statistics
   * @returns {Promise<Object>} Email statistics
   */
  static async getStatistics() {
    try {
      const result = await query(`
        SELECT 
          status,
          COUNT(*) as count,
          COUNT(CASE WHEN contact_email IS NOT NULL THEN 1 END) as with_contacts,
          AVG(jsonb_array_length(contact_email)) FILTER (WHERE contact_email IS NOT NULL) as avg_recipients
        FROM email_reminders 
        GROUP BY status
      `);
      
      return result.rows;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = EmailReminder;