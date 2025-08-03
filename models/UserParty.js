const { query } = require('../lib/db');

class UserParty {
  /**
   * Create a new user-party relationship
   * @param {Object} userPartyData - User party relationship data
   * @param {number} userPartyData.user_id - User ID (required)
   * @param {number} userPartyData.party_id - Party ID (required)
   * @returns {Promise<Object>} Created user-party relationship
   */
  static async create({ user_id, party_id }) {
    try {
      if (!user_id || !party_id) {
        throw new Error('User ID and Party ID are required');
      }

      // Check if this relationship already exists
      const existing = await this.findByIds(user_id, party_id);
      if (existing) {
        throw new Error('This user-party relationship already exists');
      }

      const result = await query(
        `INSERT INTO user_parties (user_id, party_id) 
         VALUES ($1, $2) 
         RETURNING user_id, party_id`,
        [user_id, party_id]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find user-party relationship by IDs
   * @param {number} user_id - User ID
   * @param {number} party_id - Party ID
   * @returns {Promise<Object|null>} User-party relationship or null if not found
   */
  static async findByIds(user_id, party_id) {
    try {
      const result = await query(
        'SELECT user_id, party_id FROM user_parties WHERE user_id = $1 AND party_id = $2',
        [user_id, party_id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all parties for a specific user
   * @param {number} user_id - User ID
   * @returns {Promise<Array>} Array of parties
   */
  static async getPartiesByUser(user_id) {
    try {
      const result = await query(
        `SELECT up.user_id, up.party_id,
                p.name, p.cnic, p.role, p.contact_info
         FROM user_parties up
         INNER JOIN parties p ON up.party_id = p.party_id
         WHERE up.user_id = $1
         ORDER BY p.name`,
        [user_id]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all users for a specific party
   * @param {number} party_id - Party ID
   * @returns {Promise<Array>} Array of users
   */
  static async getUsersByParty(party_id) {
    try {
      const result = await query(
        `SELECT up.user_id, up.party_id,
                u.name, u.email, u.license_no, u.contact_info
         FROM user_parties up
         INNER JOIN users u ON up.user_id = u.user_id
         WHERE up.party_id = $1
         ORDER BY u.name`,
        [party_id]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all user-party relationships with full details
   * @param {number} [limit=50] - Number of records per page
   * @param {number} [offset=0] - Number of records to skip
   * @returns {Promise<Object>} User-party relationships with pagination
   */
  static async findAll(limit = 50, offset = 0) {
    try {
      const result = await query(
        `SELECT up.user_id, up.party_id,
                u.name as user_name, u.email,
                p.name as party_name, p.cnic, p.role
         FROM user_parties up
         INNER JOIN users u ON up.user_id = u.user_id
         INNER JOIN parties p ON up.party_id = p.party_id
         ORDER BY u.name, p.name
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      // Get total count
      const countResult = await query('SELECT COUNT(*) FROM user_parties');
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
   * Delete user-party relationship
   * @param {number} user_id - User ID
   * @param {number} party_id - Party ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  static async delete(user_id, party_id) {
    try {
      const result = await query(
        'DELETE FROM user_parties WHERE user_id = $1 AND party_id = $2 RETURNING user_id',
        [user_id, party_id]
      );
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete all parties for a specific user
   * @param {number} user_id - User ID
   * @returns {Promise<number>} Number of relationships deleted
   */
  static async deleteByUser(user_id) {
    try {
      const result = await query(
        'DELETE FROM user_parties WHERE user_id = $1 RETURNING user_id',
        [user_id]
      );
      return result.rows.length;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete all users for a specific party
   * @param {number} party_id - Party ID
   * @returns {Promise<number>} Number of relationships deleted
   */
  static async deleteByParty(party_id) {
    try {
      const result = await query(
        'DELETE FROM user_parties WHERE party_id = $1 RETURNING user_id',
        [party_id]
      );
      return result.rows.length;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if a user has access to a party
   * @param {number} user_id - User ID
   * @param {number} party_id - Party ID
   * @returns {Promise<boolean>} True if user has access to party
   */
  static async hasAccess(user_id, party_id) {
    try {
      const result = await query(
        'SELECT user_id FROM user_parties WHERE user_id = $1 AND party_id = $2',
        [user_id, party_id]
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
      const totalPartiesResult = await query(
        'SELECT COUNT(*) as total_parties FROM user_parties WHERE user_id = $1',
        [user_id]
      );

      return {
        total_parties: parseInt(totalPartiesResult.rows[0].total_parties)
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Bulk create user-party relationships
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
        if (!rel.user_id || !rel.party_id) {
          throw new Error(`Relationship at index ${index} is missing required fields`);
        }
        
        placeholders.push(`($${paramCount}, $${paramCount + 1})`);
        values.push(rel.user_id, rel.party_id);
        paramCount += 2;
      });

      const result = await query(
        `INSERT INTO user_parties (user_id, party_id) 
         VALUES ${placeholders.join(', ')} 
         ON CONFLICT (user_id, party_id) DO NOTHING
         RETURNING user_id, party_id`,
        values
      );

      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if a user has access to a specific party
   * @param {number} user_id - User ID
   * @param {number} party_id - Party ID
   * @returns {Promise<boolean>} True if user has access, false otherwise
   */
  static async checkUserAccess(user_id, party_id) {
    try {
      const result = await query(
        'SELECT COUNT(*) as count FROM user_parties WHERE user_id = $1 AND party_id = $2',
        [user_id, party_id]
      );
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = UserParty;
