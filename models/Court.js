const { query } = require('../lib/db');

class Court {
  /**
   * Create a new court
   * @param {Object} courtData - Court information
   * @param {string} courtData.name - Court name (required)
   * @param {string} [courtData.type] - Court type (optional)
   * @param {string} [courtData.location] - Court location (optional)
   * @returns {Promise<Object>} Created court data
   */
  static async create({ name, type = null, location = null }) {
    try {
      if (!name) {
        throw new Error('Court name is required');
      }

      const result = await query(
        `INSERT INTO courts (name, type, location) 
         VALUES ($1, $2, $3) 
         RETURNING court_id, name, type, location`,
        [name, type, location]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find court by ID
   * @param {number} court_id - Court ID
   * @returns {Promise<Object|null>} Court data or null if not found
   */
  static async findById(court_id) {
    try {
      const result = await query(
        'SELECT court_id, name, type, location FROM courts WHERE court_id = $1',
        [court_id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find courts by name (partial match)
   * @param {string} name - Name to search for
   * @returns {Promise<Array>} Array of matching courts
   */
  static async findByName(name) {
    try {
      const result = await query(
        'SELECT court_id, name, type, location FROM courts WHERE name ILIKE $1 ORDER BY name',
        [`%${name}%`]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find courts by type
   * @param {string} type - Court type
   * @returns {Promise<Array>} Array of courts with specified type
   */
  static async findByType(type) {
    try {
      const result = await query(
        'SELECT court_id, name, type, location FROM courts WHERE type = $1 ORDER BY name',
        [type]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find courts by location
   * @param {string} location - Court location
   * @returns {Promise<Array>} Array of courts in specified location
   */
  static async findByLocation(location) {
    try {
      const result = await query(
        'SELECT court_id, name, type, location FROM courts WHERE location ILIKE $1 ORDER BY name',
        [`%${location}%`]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all courts with pagination and filtering
   * @param {number} [limit=50] - Number of records per page
   * @param {number} [offset=0] - Number of records to skip
   * @param {string} [type] - Filter by court type (optional)
   * @param {string} [location] - Filter by location (optional)
   * @returns {Promise<Object>} Courts data with pagination info
   */
  static async findAll(limit = 50, offset = 0, type = null, location = null) {
    try {
      let sql = 'SELECT court_id, name, type, location FROM courts';
      let params = [];
      let conditions = [];
      let paramCount = 1;

      if (type) {
        conditions.push(`type = $${paramCount}`);
        params.push(type);
        paramCount++;
      }

      if (location) {
        conditions.push(`location ILIKE $${paramCount}`);
        params.push(`%${location}%`);
        paramCount++;
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ' ORDER BY name LIMIT $' + paramCount + ' OFFSET $' + (paramCount + 1);
      params.push(limit, offset);

      const result = await query(sql, params);

      // Get total count
      let countSql = 'SELECT COUNT(*) FROM courts';
      let countParams = [];
      if (conditions.length > 0) {
        countSql += ' WHERE ' + conditions.join(' AND ');
        countParams = params.slice(0, -2); // Remove limit and offset
      }

      const countResult = await query(countSql, countParams);
      const totalCourts = parseInt(countResult.rows[0].count);

      return {
        courts: result.rows,
        pagination: {
          limit,
          offset,
          total: totalCourts,
          hasMore: offset + limit < totalCourts
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update court
   * @param {number} court_id - Court ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated court data or null if not found
   */
  static async update(court_id, updates) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      Object.keys(updates).forEach(key => {
        if (['name', 'type', 'location'].includes(key) && updates[key] !== undefined) {
          fields.push(`${key} = $${paramCount}`);
          values.push(updates[key]);
          paramCount++;
        }
      });

      if (fields.length === 0) {
        throw new Error('No valid fields to update');
      }

      values.push(court_id);
      const result = await query(
        `UPDATE courts SET ${fields.join(', ')} WHERE court_id = $${paramCount} 
         RETURNING court_id, name, type, location`,
        values
      );

      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete court
   * @param {number} court_id - Court ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  static async delete(court_id) {
    try {
      const result = await query(
        'DELETE FROM courts WHERE court_id = $1 RETURNING court_id',
        [court_id]
      );
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all unique court types
   * @returns {Promise<Array>} Array of unique court types
   */
  static async getAllTypes() {
    try {
      const result = await query(
        'SELECT DISTINCT type FROM courts WHERE type IS NOT NULL ORDER BY type'
      );
      return result.rows.map(row => row.type);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all unique locations
   * @returns {Promise<Array>} Array of unique locations
   */
  static async getAllLocations() {
    try {
      const result = await query(
        'SELECT DISTINCT location FROM courts WHERE location IS NOT NULL ORDER BY location'
      );
      return result.rows.map(row => row.location);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get judges associated with a court
   * @param {number} court_id - Court ID
   * @returns {Promise<Array>} Array of judges in the court
   */
  static async getJudges(court_id) {
    try {
      const result = await query(
        `SELECT judge_id, name, designation
         FROM judges
         WHERE court_id = $1
         ORDER BY name`,
        [court_id]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get cases associated with a court
   * @param {number} court_id - Court ID
   * @param {number} [limit=20] - Number of cases to return
   * @param {number} [offset=0] - Number of cases to skip
   * @returns {Promise<Object>} Cases data with pagination
   */
  static async getCases(court_id, limit = 20, offset = 0) {
    try {
      const result = await query(
        `SELECT case_id, case_number, case_type, filing_date, status, stage
         FROM cases
         WHERE court_id = $1
         ORDER BY filing_date DESC
         LIMIT $2 OFFSET $3`,
        [court_id, limit, offset]
      );

      // Get total count
      const countResult = await query(
        'SELECT COUNT(*) FROM cases WHERE court_id = $1',
        [court_id]
      );
      const totalCases = parseInt(countResult.rows[0].count);

      return {
        cases: result.rows,
        pagination: {
          limit,
          offset,
          total: totalCases,
          hasMore: offset + limit < totalCases
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if court name already exists
   * @param {string} name - Court name to check
   * @param {number} [excludeCourtId] - Court ID to exclude from check
   * @returns {Promise<boolean>} True if name exists, false otherwise
   */
  static async nameExists(name, excludeCourtId = null) {
    try {
      let sql = 'SELECT court_id FROM courts WHERE name = $1';
      let params = [name];

      if (excludeCourtId) {
        sql += ' AND court_id != $2';
        params.push(excludeCourtId);
      }

      const result = await query(sql, params);
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Court;
