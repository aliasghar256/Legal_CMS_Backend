const { query } = require('../lib/db');

class Judge {
  /**
   * Create a new judge
   * @param {Object} judgeData - Judge information
   * @param {string} judgeData.name - Judge name (required)
   * @param {string} [judgeData.designation] - Judge designation (optional)
   * @param {number} [judgeData.court_id] - Associated court ID (optional)
   * @returns {Promise<Object>} Created judge data
   */
  static async create({ name, designation = null, court_id = null }) {
    try {
      if (!name) {
        throw new Error('Judge name is required');
      }

      const result = await query(
        `INSERT INTO judges (name, designation, court_id) 
         VALUES ($1, $2, $3) 
         RETURNING judge_id, name, designation, court_id`,
        [name, designation, court_id]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find judge by ID
   * @param {number} judge_id - Judge ID
   * @returns {Promise<Object|null>} Judge data or null if not found
   */
  static async findById(judge_id) {
    try {
      const result = await query(
        'SELECT judge_id, name, designation, court_id FROM judges WHERE judge_id = $1',
        [judge_id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find judge by ID with court information
   * @param {number} judge_id - Judge ID
   * @returns {Promise<Object|null>} Judge data with court info or null if not found
   */
  static async findByIdWithCourt(judge_id) {
    try {
      const result = await query(
        `SELECT j.judge_id, j.name, j.designation, j.court_id,
                c.name as court_name, c.type as court_type, c.location as court_location
         FROM judges j
         LEFT JOIN courts c ON j.court_id = c.court_id
         WHERE j.judge_id = $1`,
        [judge_id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find judges by name (partial match)
   * @param {string} name - Name to search for
   * @returns {Promise<Array>} Array of matching judges
   */
  static async findByName(name) {
    try {
      const result = await query(
        'SELECT judge_id, name, designation, court_id FROM judges WHERE name ILIKE $1 ORDER BY name',
        [`%${name}%`]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find judges by designation
   * @param {string} designation - Judge designation
   * @returns {Promise<Array>} Array of judges with specified designation
   */
  static async findByDesignation(designation) {
    try {
      const result = await query(
        'SELECT judge_id, name, designation, court_id FROM judges WHERE designation = $1 ORDER BY name',
        [designation]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find judges by court
   * @param {number} court_id - Court ID
   * @returns {Promise<Array>} Array of judges in specified court
   */
  static async findByCourtId(court_id) {
    try {
      const result = await query(
        'SELECT judge_id, name, designation, court_id FROM judges WHERE court_id = $1 ORDER BY name',
        [court_id]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all judges with pagination and filtering
   * @param {number} [limit=50] - Number of records per page
   * @param {number} [offset=0] - Number of records to skip
   * @param {string} [designation] - Filter by designation (optional)
   * @param {number} [court_id] - Filter by court ID (optional)
   * @returns {Promise<Object>} Judges data with pagination info
   */
  static async findAll(limit = 50, offset = 0, designation = null, court_id = null) {
    try {
      let sql = 'SELECT judge_id, name, designation, court_id FROM judges';
      let params = [];
      let conditions = [];
      let paramCount = 1;

      if (designation) {
        conditions.push(`designation = $${paramCount}`);
        params.push(designation);
        paramCount++;
      }

      if (court_id) {
        conditions.push(`court_id = $${paramCount}`);
        params.push(court_id);
        paramCount++;
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ' ORDER BY name LIMIT $' + paramCount + ' OFFSET $' + (paramCount + 1);
      params.push(limit, offset);

      const result = await query(sql, params);

      // Get total count
      let countSql = 'SELECT COUNT(*) FROM judges';
      let countParams = [];
      if (conditions.length > 0) {
        countSql += ' WHERE ' + conditions.join(' AND ');
        countParams = params.slice(0, -2); // Remove limit and offset
      }

      const countResult = await query(countSql, countParams);
      const totalJudges = parseInt(countResult.rows[0].count);

      return {
        judges: result.rows,
        pagination: {
          limit,
          offset,
          total: totalJudges,
          hasMore: offset + limit < totalJudges
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all judges with their court information
   * @param {number} [limit=50] - Number of records per page
   * @param {number} [offset=0] - Number of records to skip
   * @returns {Promise<Object>} Judges data with court info and pagination
   */
  static async findAllWithCourts(limit = 50, offset = 0) {
    try {
      const result = await query(
        `SELECT j.judge_id, j.name, j.designation, j.court_id,
                c.name as court_name, c.type as court_type, c.location as court_location
         FROM judges j
         LEFT JOIN courts c ON j.court_id = c.court_id
         ORDER BY j.name
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      // Get total count
      const countResult = await query('SELECT COUNT(*) FROM judges');
      const totalJudges = parseInt(countResult.rows[0].count);

      return {
        judges: result.rows,
        pagination: {
          limit,
          offset,
          total: totalJudges,
          hasMore: offset + limit < totalJudges
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update judge
   * @param {number} judge_id - Judge ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated judge data or null if not found
   */
  static async update(judge_id, updates) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      Object.keys(updates).forEach(key => {
        if (['name', 'designation', 'court_id'].includes(key) && updates[key] !== undefined) {
          fields.push(`${key} = $${paramCount}`);
          values.push(updates[key]);
          paramCount++;
        }
      });

      if (fields.length === 0) {
        throw new Error('No valid fields to update');
      }

      values.push(judge_id);
      const result = await query(
        `UPDATE judges SET ${fields.join(', ')} WHERE judge_id = $${paramCount} 
         RETURNING judge_id, name, designation, court_id`,
        values
      );

      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete judge
   * @param {number} judge_id - Judge ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  static async delete(judge_id) {
    try {
      const result = await query(
        'DELETE FROM judges WHERE judge_id = $1 RETURNING judge_id',
        [judge_id]
      );
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all unique designations
   * @returns {Promise<Array>} Array of unique designations
   */
  static async getAllDesignations() {
    try {
      const result = await query(
        'SELECT DISTINCT designation FROM judges WHERE designation IS NOT NULL ORDER BY designation'
      );
      return result.rows.map(row => row.designation);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get hearings associated with a judge
   * @param {number} judge_id - Judge ID
   * @param {number} [limit=20] - Number of hearings to return
   * @param {number} [offset=0] - Number of hearings to skip
   * @returns {Promise<Object>} Hearings data with pagination
   */
  static async getHearings(judge_id, limit = 20, offset = 0) {
    try {
      const result = await query(
        `SELECT h.hearing_id, h.case_id, h.date, h.type, h.next_hearing_date,
                c.case_number, c.case_type, c.status
         FROM hearings h
         LEFT JOIN cases c ON h.case_id = c.case_id
         WHERE h.judge_id = $1
         ORDER BY h.date DESC
         LIMIT $2 OFFSET $3`,
        [judge_id, limit, offset]
      );

      // Get total count
      const countResult = await query(
        'SELECT COUNT(*) FROM hearings WHERE judge_id = $1',
        [judge_id]
      );
      const totalHearings = parseInt(countResult.rows[0].count);

      return {
        hearings: result.rows,
        pagination: {
          limit,
          offset,
          total: totalHearings,
          hasMore: offset + limit < totalHearings
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get upcoming hearings for a judge
   * @param {number} judge_id - Judge ID
   * @param {number} [limit=10] - Number of hearings to return
   * @returns {Promise<Array>} Array of upcoming hearings
   */
  static async getUpcomingHearings(judge_id, limit = 10) {
    try {
      const result = await query(
        `SELECT h.hearing_id, h.case_id, h.date, h.type,
                c.case_number, c.case_type, c.status
         FROM hearings h
         LEFT JOIN cases c ON h.case_id = c.case_id
         WHERE h.judge_id = $1 AND h.date >= CURRENT_DATE
         ORDER BY h.date ASC
         LIMIT $2`,
        [judge_id, limit]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get judge statistics
   * @param {number} judge_id - Judge ID
   * @returns {Promise<Object>} Judge statistics
   */
  static async getStatistics(judge_id) {
    try {
      const totalHearingsResult = await query(
        'SELECT COUNT(*) as total_hearings FROM hearings WHERE judge_id = $1',
        [judge_id]
      );

      const upcomingHearingsResult = await query(
        'SELECT COUNT(*) as upcoming_hearings FROM hearings WHERE judge_id = $1 AND date >= CURRENT_DATE',
        [judge_id]
      );

      const pastHearingsResult = await query(
        'SELECT COUNT(*) as past_hearings FROM hearings WHERE judge_id = $1 AND date < CURRENT_DATE',
        [judge_id]
      );

      return {
        total_hearings: parseInt(totalHearingsResult.rows[0].total_hearings),
        upcoming_hearings: parseInt(upcomingHearingsResult.rows[0].upcoming_hearings),
        past_hearings: parseInt(pastHearingsResult.rows[0].past_hearings)
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Judge;
