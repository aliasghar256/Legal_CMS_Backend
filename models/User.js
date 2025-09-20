const { query } = require('../lib/db');
const bcrypt = require('bcrypt');

class User {
  // Helper method to format timestamp to Pakistani timezone
  static formatToPakistaniTime(timestamp) {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }

  // Create a new user (signup)
  static async create({ name, email, password, license_no = null, phone_number = null }) {
    try {
      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Let PostgreSQL set created_at automatically with DEFAULT CURRENT_TIMESTAMP
      const result = await query(
        `INSERT INTO users (email, password, name, license_no, phone_number) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING user_id, name, email, license_no, phone_number, created_at`,
        [email, hashedPassword, name, license_no, phone_number]
      );

      // Format the created_at to Pakistani time for display
      const user = result.rows[0];
      return {
        ...user,
        created_at_formatted: this.formatToPakistaniTime(user.created_at)
      };
    } catch (error) {
      throw error;
    }
  }

  // Find user by email (for login)
  static async findByEmail(email) {
    try {
      const result = await query(
        `SELECT user_id, email, password, name, license_no, phone_number, created_at
         FROM users WHERE email = $1`,
        [email]
      );
      
      const user = result.rows[0];
      if (user) {
        user.created_at_formatted = this.formatToPakistaniTime(user.created_at);
      }
      return user;
    } catch (error) {
      throw error;
    }
  }

  // Find user by ID
  static async findById(user_id) {
    try {
      const result = await query(
        `SELECT user_id, name, email, license_no, phone_number, created_at
         FROM users WHERE user_id = $1`,
        [user_id]
      );
      
      const user = result.rows[0];
      if (user) {
        user.created_at_formatted = this.formatToPakistaniTime(user.created_at);
      }
      return user;
    } catch (error) {
      throw error;
    }
  }

  // Get all users
  static async findAll(limit = 50, offset = 0) {
    try {
      const result = await query(
        `SELECT user_id, name, email, license_no, phone_number, created_at
         FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      
      // Format created_at for all users
      const users = result.rows.map(user => ({
        ...user,
        created_at_formatted: this.formatToPakistaniTime(user.created_at)
      }));
      
      return users;
    } catch (error) {
      throw error;
    }
  }

  // Update user
  static async update(user_id, updates) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      Object.keys(updates).forEach(key => {
        if (['name', 'email', 'license_no', 'phone_number'].includes(key)) {
          fields.push(`${key} = $${paramCount}`);
          values.push(updates[key]);
          paramCount++;
        }
      });

      if (fields.length === 0) {
        throw new Error('No valid fields to update');
      }

      values.push(user_id);
      const result = await query(
        `UPDATE users SET ${fields.join(', ')} WHERE user_id = $${paramCount} 
         RETURNING user_id, name, email, license_no, phone_number, created_at`,
        values
      );

      const user = result.rows[0];
      if (user) {
        user.created_at_formatted = this.formatToPakistaniTime(user.created_at);
      }
      return user;
    } catch (error) {
      throw error;
    }
  }

  // Delete user
  static async delete(user_id) {
    try {
      const result = await query(
        'DELETE FROM users WHERE user_id = $1 RETURNING user_id',
        [user_id]
      );
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Verify password (for login)
  static async verifyPassword(plainPassword, hashedPassword) {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      throw error;
    }
  }

  // Change password
  static async changePassword(user_id, newPassword) {
    try {
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      const result = await query(
        'UPDATE users SET password = $1 WHERE user_id = $2 RETURNING user_id',
        [hashedPassword, user_id]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Check if email exists
  static async emailExists(email, excludeUserId = null) {
    try {
      let sql = 'SELECT user_id FROM users WHERE email = $1';
      let params = [email];

      if (excludeUserId) {
        sql += ' AND user_id != $2';
        params.push(excludeUserId);
      }

      const result = await query(sql, params);
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = User;
