const { query, transaction } = require('../lib/db');

class UserReminder {
  /**
   * Create a new user reminder association
   * @param {Object} userReminderData - User reminder information
   * @param {number} userReminderData.user_id - User ID (required)
   * @param {number} userReminderData.case_id - Case ID (required)
   * @param {number} [userReminderData.hearing_id] - Hearing ID (optional)
   * @param {number} userReminderData.reminder_id - Reminder ID (required)
   * @returns {Promise<Object>} Created user reminder data
   */
  static async create(userReminderData) {
    try {
      const {
        user_id,
        case_id,
        hearing_id = null,
        reminder_id
      } = userReminderData;

      const result = await query(
        `INSERT INTO user_reminders (user_id, case_id, hearing_id, reminder_id) 
         VALUES ($1, $2, $3, $4) 
         RETURNING user_id, case_id, hearing_id, reminder_id`,
        [user_id, case_id, hearing_id, reminder_id]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find user reminders by user ID
   * @param {number} user_id - User ID
   * @param {number} [limit=20] - Number of records per page
   * @param {number} [offset=0] - Number of records to skip
   * @returns {Promise<Object>} User reminders with pagination info
   */
  static async findByUserId(user_id, limit = 20, offset = 0) {
    try {
      const result = await query(
        `SELECT ur.user_id, ur.case_id, ur.hearing_id, ur.reminder_id,
                r.scheduled_time, r.status, r.note,
                c.case_number, c.court_name,
                h.date as hearing_date, h.description as hearing_description
         FROM user_reminders ur
         INNER JOIN reminders r ON ur.reminder_id = r.reminder_id
         INNER JOIN cases c ON ur.case_id = c.case_id
         LEFT JOIN hearings h ON ur.hearing_id = h.hearing_id
         WHERE ur.user_id = $1
         ORDER BY r.scheduled_time ASC
         LIMIT $2 OFFSET $3`,
        [user_id, limit, offset]
      );

      // Get total count
      const countResult = await query(
        'SELECT COUNT(*) FROM user_reminders WHERE user_id = $1',
        [user_id]
      );
      const total = parseInt(countResult.rows[0].count);

      return {
        reminders: result.rows,
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
   * Find user reminders by case ID
   * @param {number} case_id - Case ID
   * @returns {Promise<Array>} Array of user reminders for the case
   */
  static async findByCaseId(case_id) {
    try {
      const result = await query(
        `SELECT ur.user_id, ur.case_id, ur.hearing_id, ur.reminder_id,
                r.scheduled_time, r.status, r.note,
                u.name as user_name, u.email as user_email
         FROM user_reminders ur
         INNER JOIN reminders r ON ur.reminder_id = r.reminder_id
         INNER JOIN users u ON ur.user_id = u.user_id
         WHERE ur.case_id = $1
         ORDER BY r.scheduled_time ASC`,
        [case_id]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find user reminders by hearing ID
   * @param {number} hearing_id - Hearing ID
   * @returns {Promise<Array>} Array of user reminders for the hearing
   */
  static async findByHearingId(hearing_id) {
    try {
      const result = await query(
        `SELECT ur.user_id, ur.case_id, ur.hearing_id, ur.reminder_id,
                r.scheduled_time, r.status, r.note,
                u.name as user_name, u.email as user_email
         FROM user_reminders ur
         INNER JOIN reminders r ON ur.reminder_id = r.reminder_id
         INNER JOIN users u ON ur.user_id = u.user_id
         WHERE ur.hearing_id = $1
         ORDER BY r.scheduled_time ASC`,
        [hearing_id]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find user reminder by reminder ID
   * @param {number} reminder_id - Reminder ID
   * @returns {Promise<Object|null>} User reminder data or null if not found
   */
  static async findByReminderId(reminder_id) {
    try {
      const result = await query(
        `SELECT ur.user_id, ur.case_id, ur.hearing_id, ur.reminder_id,
                r.scheduled_time, r.status, r.note,
                c.case_number, c.court_name,
                h.date as hearing_date, h.description as hearing_description,
                u.name as user_name, u.email as user_email
         FROM user_reminders ur
         INNER JOIN reminders r ON ur.reminder_id = r.reminder_id
         INNER JOIN cases c ON ur.case_id = c.case_id
         LEFT JOIN hearings h ON ur.hearing_id = h.hearing_id
         INNER JOIN users u ON ur.user_id = u.user_id
         WHERE ur.reminder_id = $1`,
        [reminder_id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete user reminder
   * @param {number} user_id - User ID
   * @param {number} reminder_id - Reminder ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  static async delete(user_id, reminder_id) {
    try {
      const result = await query(
        'DELETE FROM user_reminders WHERE user_id = $1 AND reminder_id = $2 RETURNING user_id',
        [user_id, reminder_id]
      );
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete all user reminders for a case
   * @param {number} case_id - Case ID
   * @returns {Promise<number>} Number of deleted reminders
   */
  static async deleteByCaseId(case_id) {
    try {
      const result = await query(
        'DELETE FROM user_reminders WHERE case_id = $1',
        [case_id]
      );
      return result.rowCount;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete all user reminders for a hearing
   * @param {number} hearing_id - Hearing ID
   * @returns {Promise<number>} Number of deleted reminders
   */
  static async deleteByHearingId(hearing_id) {
    try {
      const result = await query(
        'DELETE FROM user_reminders WHERE hearing_id = $1',
        [hearing_id]
      );
      return result.rowCount;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = UserReminder;