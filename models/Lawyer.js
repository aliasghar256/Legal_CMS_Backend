const { query } = require('../lib/db');
const bcrypt = require('bcrypt');

class Lawyer {
  // Create a new lawyer (signup)
  static async create({ name, email, password, license_no = null, contact_info = null }) {
    try {
      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const result = await query(
        `INSERT INTO lawyers (name, email, password, license_no, contact_info) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING lawyer_id, name, email, license_no, contact_info`,
        [name, email, hashedPassword, license_no, contact_info]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Find lawyer by email (for login)
  static async findByEmail(email) {
    try {
      const result = await query(
        'SELECT * FROM lawyers WHERE email = $1',
        [email]
      );
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Find lawyer by ID
  static async findById(lawyer_id) {
    try {
      const result = await query(
        'SELECT lawyer_id, name, email, license_no, contact_info FROM lawyers WHERE lawyer_id = $1',
        [lawyer_id]
      );
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Get all lawyers
  static async findAll(limit = 50, offset = 0) {
    try {
      const result = await query(
        'SELECT lawyer_id, name, email, license_no, contact_info FROM lawyers ORDER BY name LIMIT $1 OFFSET $2',
        [limit, offset]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Update lawyer
  static async update(lawyer_id, updates) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      Object.keys(updates).forEach(key => {
        if (['name', 'email', 'license_no', 'contact_info'].includes(key)) {
          fields.push(`${key} = $${paramCount}`);
          values.push(updates[key]);
          paramCount++;
        }
      });

      if (fields.length === 0) {
        throw new Error('No valid fields to update');
      }

      values.push(lawyer_id);
      const result = await query(
        `UPDATE lawyers SET ${fields.join(', ')} WHERE lawyer_id = $${paramCount} 
         RETURNING lawyer_id, name, email, license_no, contact_info`,
        values
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Delete lawyer
  static async delete(lawyer_id) {
    try {
      const result = await query(
        'DELETE FROM lawyers WHERE lawyer_id = $1 RETURNING lawyer_id',
        [lawyer_id]
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
  static async changePassword(lawyer_id, newPassword) {
    try {
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      const result = await query(
        'UPDATE lawyers SET password = $1 WHERE lawyer_id = $2 RETURNING lawyer_id',
        [hashedPassword, lawyer_id]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Check if email exists
  static async emailExists(email, excludeLawyerId = null) {
    try {
      let sql = 'SELECT lawyer_id FROM lawyers WHERE email = $1';
      let params = [email];

      if (excludeLawyerId) {
        sql += ' AND lawyer_id != $2';
        params.push(excludeLawyerId);
      }

      const result = await query(sql, params);
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Lawyer;
