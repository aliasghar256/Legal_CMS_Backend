const { query } = require('../lib/db');

class UserLawyer {
  /**
   * Create a new user-lawyer relationship
   * @param {Object} userLawyerData - User lawyer relationship data
   * @param {number} userLawyerData.user_id - User ID (required)
   * @param {number} userLawyerData.lawyer_id - Lawyer ID (required)
   * @returns {Promise<Object>} Created user-lawyer relationship
   */
  static async create({ user_id, lawyer_id }) {
    try {
      if (!user_id || !lawyer_id) {
        throw new Error('User ID and Lawyer ID are required');
      }

      // Check if this relationship already exists
      const existing = await this.findByIds(user_id, lawyer_id);
      if (existing) {
        throw new Error('This user-lawyer relationship already exists');
      }

      const result = await query(
        `INSERT INTO user_lawyers (user_id, lawyer_id) 
         VALUES ($1, $2) 
         RETURNING user_id, lawyer_id`,
        [user_id, lawyer_id]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find user-lawyer relationship by IDs
   * @param {number} user_id - User ID
   * @param {number} lawyer_id - Lawyer ID
   * @returns {Promise<Object|null>} User-lawyer relationship or null if not found
   */
  static async findByIds(user_id, lawyer_id) {
    try {
      const result = await query(
        'SELECT user_id, lawyer_id FROM user_lawyers WHERE user_id = $1 AND lawyer_id = $2',
        [user_id, lawyer_id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all lawyers for a specific user
   * @param {number} user_id - User ID
   * @returns {Promise<Array>} Array of lawyers
   */
  static async getLawyersByUser(user_id) {
    try {
      const result = await query(
        `SELECT ul.user_id, ul.lawyer_id,
                l.name, l.license_no, l.contact_info
         FROM user_lawyers ul
         INNER JOIN lawyers l ON ul.lawyer_id = l.lawyer_id
         WHERE ul.user_id = $1
         ORDER BY l.name`,
        [user_id]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all users for a specific lawyer
   * @param {number} lawyer_id - Lawyer ID
   * @returns {Promise<Array>} Array of users
   */
  static async getUsersByLawyer(lawyer_id) {
    try {
      const result = await query(
        `SELECT ul.user_id, ul.lawyer_id,
                u.name, u.email, u.license_no, u.contact_info
         FROM user_lawyers ul
         INNER JOIN users u ON ul.user_id = u.user_id
         WHERE ul.lawyer_id = $1
         ORDER BY u.name`,
        [lawyer_id]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all user-lawyer relationships with full details
   * @param {number} [limit=50] - Number of records per page
   * @param {number} [offset=0] - Number of records to skip
   * @returns {Promise<Object>} User-lawyer relationships with pagination
   */
  static async findAll(limit = 50, offset = 0) {
    try {
      const result = await query(
        `SELECT ul.user_id, ul.lawyer_id,
                u.name as user_name, u.email,
                l.name as lawyer_name, l.license_no
         FROM user_lawyers ul
         INNER JOIN users u ON ul.user_id = u.user_id
         INNER JOIN lawyers l ON ul.lawyer_id = l.lawyer_id
         ORDER BY u.name, l.name
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      // Get total count
      const countResult = await query('SELECT COUNT(*) FROM user_lawyers');
      const totalRelationships = parseInt(countResult.rows[0].count);

      return {
        relationships: result.rows,
        pagination: {
          limit,
          offset,
          total: totalRelationships,
          hasMore: offset + limit < totalRelationships
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete user-lawyer relationship
   * @param {number} user_id - User ID
   * @param {number} lawyer_id - Lawyer ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  static async delete(user_id, lawyer_id) {
    try {
      const result = await query(
        'DELETE FROM user_lawyers WHERE user_id = $1 AND lawyer_id = $2 RETURNING user_id',
        [user_id, lawyer_id]
      );
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete all lawyers for a specific user
   * @param {number} user_id - User ID
   * @returns {Promise<number>} Number of relationships deleted
   */
  static async deleteByUser(user_id) {
    try {
      const result = await query(
        'DELETE FROM user_lawyers WHERE user_id = $1 RETURNING user_id',
        [user_id]
      );
      return result.rows.length;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete all users for a specific lawyer
   * @param {number} lawyer_id - Lawyer ID
   * @returns {Promise<number>} Number of relationships deleted
   */
  static async deleteByLawyer(lawyer_id) {
    try {
      const result = await query(
        'DELETE FROM user_lawyers WHERE lawyer_id = $1 RETURNING user_id',
        [lawyer_id]
      );
      return result.rows.length;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if a user has access to a lawyer
   * @param {number} user_id - User ID
   * @param {number} lawyer_id - Lawyer ID
   * @returns {Promise<boolean>} True if user has access to lawyer
   */
  static async hasAccess(user_id, lawyer_id) {
    try {
      const result = await query(
        'SELECT user_id FROM user_lawyers WHERE user_id = $1 AND lawyer_id = $2',
        [user_id, lawyer_id]
      );
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user statistics
   * @param {number} user_id - User ID
   * @returns {Promise<Object>} User statistics
   */
  static async getUserStatistics(user_id) {
    try {
      const totalLawyersResult = await query(
        'SELECT COUNT(*) as total_lawyers FROM user_lawyers WHERE user_id = $1',
        [user_id]
      );

      return {
        total_lawyers: parseInt(totalLawyersResult.rows[0].total_lawyers)
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Bulk create user-lawyer relationships
   * @param {Array} relationships - Array of relationship objects
   * @returns {Promise<Array>} Array of created relationships
   */
  static async bulkCreate(relationships) {
    try {
      if (!Array.isArray(relationships) || relationships.length === 0) {
        throw new Error('Relationships array is required and cannot be empty');
      }

      const values = [];
      const placeholders = [];
      let paramCount = 1;

      relationships.forEach((rel, index) => {
        if (!rel.user_id || !rel.lawyer_id) {
          throw new Error(`Relationship at index ${index} is missing required fields`);
        }
        
        placeholders.push(`($${paramCount}, $${paramCount + 1})`);
        values.push(rel.user_id, rel.lawyer_id);
        paramCount += 2;
      });

      const result = await query(
        `INSERT INTO user_lawyers (user_id, lawyer_id) 
         VALUES ${placeholders.join(', ')} 
         ON CONFLICT (user_id, lawyer_id) DO NOTHING
         RETURNING user_id, lawyer_id`,
        values
      );

      return result.rows;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = UserLawyer;
