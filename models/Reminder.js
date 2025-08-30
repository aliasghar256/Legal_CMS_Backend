const { query, transaction } = require('../lib/db');

class Reminder {
  /**
   * Create a new reminder
   * @param {Object} reminderData - Reminder information
   * @param {number} reminderData.reminder_id - Reminder ID (required)
   * @param {string} reminderData.scheduled_time - Scheduled time (required)
   * @param {string} [reminderData.status='scheduled'] - Reminder status (optional)
   * @param {string} [reminderData.note] - Reminder note (optional)
   * @param {number} [reminderData.whatsapp_id] - WhatsApp reminder ID (optional)
   * @param {number} [reminderData.email_id] - Email reminder ID (optional)
   * @returns {Promise<Object>} Created reminder data
   */
  static async create(reminderData) {
    try {
      const {
        reminder_id,
        scheduled_time,
        status = 'scheduled',
        note = null,
        whatsapp_id = null,
        email_id = null
      } = reminderData;

      const result = await query(
        `INSERT INTO reminders (reminder_id, scheduled_time, status, note, whatsapp_id, email_id) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING reminder_id, scheduled_time, status, note, whatsapp_id, email_id`,
        [reminder_id, scheduled_time, status, note, whatsapp_id, email_id]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find reminder by ID
   * @param {number} reminder_id - Reminder ID
   * @returns {Promise<Object|null>} Reminder data or null if not found
   */
  static async findById(reminder_id) {
    try {
      const result = await query(
        `SELECT reminder_id, scheduled_time, status, note, whatsapp_id, email_id 
         FROM reminders WHERE reminder_id = $1`,
        [reminder_id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all reminders with pagination and filtering
   * @param {number} [limit=20] - Number of records per page
   * @param {number} [offset=0] - Number of records to skip
   * @param {string} [status] - Filter by status (optional)
   * @returns {Promise<Object>} Reminders data with pagination info
   */
  static async findAll(limit = 20, offset = 0, status = null) {
    try {
      let sql = `SELECT reminder_id, scheduled_time, status, note, whatsapp_id, email_id
                 FROM reminders`;
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

      sql += ` ORDER BY scheduled_time ASC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);

      const result = await query(sql, params);

      // Get total count
      let countSql = 'SELECT COUNT(*) FROM reminders';
      let countParams = [];
      if (conditions.length > 0) {
        countSql += ' WHERE ' + conditions.join(' AND ');
        countParams = params.slice(0, -2); // Remove limit and offset
      }

      const countResult = await query(countSql, countParams);
      const totalReminders = parseInt(countResult.rows[0].count);

      return {
        reminders: result.rows,
        pagination: {
          limit,
          offset,
          total: totalReminders,
          hasMore: offset + limit < totalReminders
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update reminder
   * @param {number} reminder_id - Reminder ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated reminder data or null if not found
   */
  static async update(reminder_id, updates) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      const allowedFields = ['scheduled_time', 'status', 'note', 'whatsapp_id', 'email_id'];

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

      values.push(reminder_id);
      const result = await query(
        `UPDATE reminders SET ${fields.join(', ')} WHERE reminder_id = $${paramCount} 
         RETURNING reminder_id, scheduled_time, status, note, whatsapp_id, email_id`,
        values
      );

      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete reminder
   * @param {number} reminder_id - Reminder ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  static async delete(reminder_id) {
    try {
      const result = await query(
        'DELETE FROM reminders WHERE reminder_id = $1 RETURNING reminder_id',
        [reminder_id]
      );
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get scheduled reminders due for processing
   * @param {Date} [beforeTime] - Get reminders scheduled before this time (defaults to now)
   * @returns {Promise<Array>} Array of scheduled reminders
   */
  static async getScheduledReminders(beforeTime = new Date()) {
    try {
      const result = await query(
        `SELECT reminder_id, scheduled_time, status, note, whatsapp_id, email_id
         FROM reminders 
         WHERE status = 'scheduled' AND scheduled_time <= $1
         ORDER BY scheduled_time ASC`,
        [beforeTime.toISOString()]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate next available reminder ID
   * @returns {Promise<number>} Next available reminder ID
   */
  static async getNextReminderId() {
    try {
      // First try to use the sequence if it exists
      const sequenceResult = await query(
        `SELECT nextval('reminders_reminder_id_seq') as next_id`
      ).catch(() => null);
      
      if (sequenceResult && sequenceResult.rows[0]) {
        return sequenceResult.rows[0].next_id;
      }
      
      // Fallback to manual ID generation if sequence doesn't exist
      const result = await query(
        'SELECT COALESCE(MAX(reminder_id), 0) + 1 as next_id FROM reminders'
      );
      return result.rows[0].next_id;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Reminder;