const { query } = require('../lib/db');

class Hearing {
  /**
   * Create a new hearing
   * @param {Object} hearingData - Hearing information
   * @param {number} [hearingData.case_id] - Case ID (optional)
   * @param {number} [hearingData.judge_id] - Judge ID (optional)
   * @param {string} [hearingData.date] - Hearing date (optional)
   * @param {string} [hearingData.description] - Hearing description (optional)
   * @param {string} [hearingData.type] - Hearing type (optional)
   * @returns {Promise<Object>} Created hearing data
   */
  static async create(hearingData) {
    try {
      const {
        case_id = null,
        judge_id = null,
        date = null,
        description = null,
        type = null
      } = hearingData;

      const result = await query(
        `INSERT INTO hearings (case_id, judge_id, date, description, type) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING hearing_id, case_id, judge_id, date, description, type`,
        [case_id, judge_id, date, description, type]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find hearing by ID
   * @param {number} hearing_id - Hearing ID
   * @returns {Promise<Object|null>} Hearing data or null if not found
   */
  static async findById(hearing_id) {
    try {
      const result = await query(
        `SELECT hearing_id, case_id, judge_id, date, description, type 
         FROM hearings WHERE hearing_id = $1`,
        [hearing_id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find hearing by ID with related data (case, judge, lawyers, parties)
   * @param {number} hearing_id - Hearing ID
   * @returns {Promise<Object|null>} Hearing data with related information
   */
  static async findByIdWithDetails(hearing_id) {
    try {
      const result = await query(
        `SELECT h.hearing_id, h.case_id, h.judge_id, h.date, h.description, h.type,
                c.case_number, c.case_type, c.status as case_status,
                j.name as judge_name, j.designation as judge_designation,
                court.name as court_name, court.location as court_location
         FROM hearings h
         LEFT JOIN cases c ON h.case_id = c.case_id
         LEFT JOIN judges j ON h.judge_id = j.judge_id
         LEFT JOIN courts court ON j.court_id = court.court_id
         WHERE h.hearing_id = $1`,
        [hearing_id]
      );
      
      if (result.rows.length === 0) {
        return null;
      }

      const hearing = result.rows[0];

      // Get lawyers and parties for this case
      if (hearing.case_id) {
        const lawyersPartiesResult = await query(
          `SELECT l.lawyer_id, l.name as lawyer_name, l.license_no,
                  p.party_id, p.name as party_name, p.role, p.cnic
           FROM case_lawyers cl
           LEFT JOIN lawyers l ON cl.lawyer_id = l.lawyer_id
           LEFT JOIN parties p ON cl.party_id = p.party_id
           WHERE cl.case_id = $1`,
          [hearing.case_id]
        );

        // Group lawyers and parties
        const lawyers = [];
        const parties = [];
        const lawyerMap = new Map();
        const partyMap = new Map();

        for (let row of lawyersPartiesResult.rows) {
          if (row.lawyer_id && !lawyerMap.has(row.lawyer_id)) {
            lawyers.push({
              lawyer_id: row.lawyer_id,
              name: row.lawyer_name,
              license_no: row.license_no
            });
            lawyerMap.set(row.lawyer_id, true);
          }
          
          if (row.party_id && !partyMap.has(row.party_id)) {
            parties.push({
              party_id: row.party_id,
              name: row.party_name,
              role: row.role,
              cnic: row.cnic
            });
            partyMap.set(row.party_id, true);
          }
        }

        hearing.lawyers = lawyers;
        hearing.parties = parties;
      }

      return hearing;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find hearings by case ID
   * @param {number} case_id - Case ID
   * @param {number} [limit=50] - Number of records to return
   * @param {number} [offset=0] - Number of records to skip
   * @returns {Promise<Object>} Hearings data with pagination
   */
  static async findByCaseId(case_id, limit = 50, offset = 0) {
    try {
      const result = await query(
        `SELECT h.hearing_id, h.judge_id, h.date, h.description, h.type,
                j.name as judge_name, j.designation as judge_designation
         FROM hearings h
         LEFT JOIN judges j ON h.judge_id = j.judge_id
         WHERE h.case_id = $1
         ORDER BY h.date DESC
         LIMIT $2 OFFSET $3`,
        [case_id, limit, offset]
      );

      // Get total count
      const countResult = await query(
        'SELECT COUNT(*) FROM hearings WHERE case_id = $1',
        [case_id]
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
   * Find hearings by judge ID
   * @param {number} judge_id - Judge ID
   * @param {number} [limit=50] - Number of records to return
   * @param {number} [offset=0] - Number of records to skip
   * @returns {Promise<Object>} Hearings data with pagination
   */
  static async findByJudgeId(judge_id, limit = 50, offset = 0) {
    try {
      const result = await query(
        `SELECT h.hearing_id, h.case_id, h.date, h.description, h.type,
                c.case_number, c.case_type, c.status as case_status
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
   * Find hearings by date range
   * @param {string} start_date - Start date (YYYY-MM-DD)
   * @param {string} end_date - End date (YYYY-MM-DD)
   * @param {number} [limit=100] - Number of records to return
   * @param {number} [offset=0] - Number of records to skip
   * @returns {Promise<Object>} Hearings data with pagination
   */
  static async findByDateRange(start_date, end_date, limit = 100, offset = 0) {
    try {
      const result = await query(
        `SELECT h.hearing_id, h.case_id, h.judge_id, h.date, h.description, h.type,
                c.case_number, c.case_type,
                j.name as judge_name
         FROM hearings h
         LEFT JOIN cases c ON h.case_id = c.case_id
         LEFT JOIN judges j ON h.judge_id = j.judge_id
         WHERE h.date BETWEEN $1 AND $2
         ORDER BY h.date ASC
         LIMIT $3 OFFSET $4`,
        [start_date, end_date, limit, offset]
      );

      // Get total count
      const countResult = await query(
        'SELECT COUNT(*) FROM hearings WHERE date BETWEEN $1 AND $2',
        [start_date, end_date]
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
   * Get upcoming hearings
   * @param {number} [days=30] - Number of days to look ahead
   * @param {number} [limit=50] - Number of records to return
   * @param {number} [offset=0] - Number of records to skip
   * @returns {Promise<Object>} Upcoming hearings data
   */
  static async getUpcomingHearings(days = 30, limit = 50, offset = 0) {
    try {
      const result = await query(
        `SELECT h.hearing_id, h.case_id, h.judge_id, h.date, h.description, h.type,
                c.case_number, c.case_type, c.status as case_status,
                j.name as judge_name, j.designation as judge_designation,
                court.name as court_name
         FROM hearings h
         LEFT JOIN cases c ON h.case_id = c.case_id
         LEFT JOIN judges j ON h.judge_id = j.judge_id
         LEFT JOIN courts court ON j.court_id = court.court_id
         WHERE h.date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '${days} days')
         ORDER BY h.date ASC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) FROM hearings 
         WHERE date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '${days} days')`
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
   * Get hearings for today
   * @returns {Promise<Array>} Array of today's hearings
   */
  static async getTodaysHearings() {
    try {
      const result = await query(
        `SELECT h.hearing_id, h.case_id, h.judge_id, h.date, h.description, h.type,
                c.case_number, c.case_type,
                j.name as judge_name,
                court.name as court_name
         FROM hearings h
         LEFT JOIN cases c ON h.case_id = c.case_id
         LEFT JOIN judges j ON h.judge_id = j.judge_id
         LEFT JOIN courts court ON j.court_id = court.court_id
         WHERE h.date = CURRENT_DATE
         ORDER BY h.date ASC`
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all hearings with pagination and filtering, optionally with lawyers and parties
   * @param {number} [limit=50] - Number of records per page
   * @param {number} [offset=0] - Number of records to skip
   * @param {string} [type] - Filter by hearing type (optional)
   * @param {number} [judge_id] - Filter by judge ID (optional)
   * @param {boolean} [includeLawyersParties=false] - Include lawyers and parties info
   * @returns {Promise<Object>} Hearings data with pagination info
   */
  static async findAll(limit = 50, offset = 0, type = null, judge_id = null, includeLawyersParties = false) {
    try {
      let sql = `SELECT h.hearing_id, h.case_id, h.judge_id, h.date, h.description, h.type,
                        c.case_number, c.case_type,
                        j.name as judge_name
                 FROM hearings h
                 LEFT JOIN cases c ON h.case_id = c.case_id
                 LEFT JOIN judges j ON h.judge_id = j.judge_id`;
      let params = [];
      let conditions = [];
      let paramCount = 1;

      if (type) {
        conditions.push(`h.type = $${paramCount}`);
        params.push(type);
        paramCount++;
      }

      if (judge_id) {
        conditions.push(`h.judge_id = $${paramCount}`);
        params.push(judge_id);
        paramCount++;
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ` ORDER BY h.date DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);

      const result = await query(sql, params);

      // Include lawyers and parties if requested
      if (includeLawyersParties) {
        for (let hearing of result.rows) {
          if (hearing.case_id) {
            const lawyersPartiesResult = await query(
              `SELECT l.lawyer_id, l.name as lawyer_name, l.license_no,
                      p.party_id, p.name as party_name, p.role, p.cnic
               FROM case_lawyers cl
               LEFT JOIN lawyers l ON cl.lawyer_id = l.lawyer_id
               LEFT JOIN parties p ON cl.party_id = p.party_id
               WHERE cl.case_id = $1`,
              [hearing.case_id]
            );

            // Group lawyers and parties
            const lawyers = [];
            const parties = [];
            const lawyerMap = new Map();
            const partyMap = new Map();

            for (let row of lawyersPartiesResult.rows) {
              if (row.lawyer_id && !lawyerMap.has(row.lawyer_id)) {
                lawyers.push({
                  lawyer_id: row.lawyer_id,
                  name: row.lawyer_name,
                  license_no: row.license_no
                });
                lawyerMap.set(row.lawyer_id, true);
              }
              
              if (row.party_id && !partyMap.has(row.party_id)) {
                parties.push({
                  party_id: row.party_id,
                  name: row.party_name,
                  role: row.role,
                  cnic: row.cnic
                });
                partyMap.set(row.party_id, true);
              }
            }

            hearing.lawyers = lawyers;
            hearing.parties = parties;
          }
        }
      }

      // Get total count
      let countSql = 'SELECT COUNT(*) FROM hearings h';
      let countParams = [];
      if (conditions.length > 0) {
        countSql += ' WHERE ' + conditions.join(' AND ');
        countParams = params.slice(0, -2); // Remove limit and offset
      }

      const countResult = await query(countSql, countParams);
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
   * Update hearing
   * @param {number} hearing_id - Hearing ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated hearing data or null if not found
   */
  static async update(hearing_id, updates) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      const allowedFields = ['case_id', 'judge_id', 'date', 'description', 'type'];

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

      values.push(hearing_id);
      const result = await query(
        `UPDATE hearings SET ${fields.join(', ')} WHERE hearing_id = $${paramCount} 
         RETURNING hearing_id, case_id, judge_id, date, description, type`,
        values
      );

      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete hearing
   * @param {number} hearing_id - Hearing ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  static async delete(hearing_id) {
    try {
      const result = await query(
        'DELETE FROM hearings WHERE hearing_id = $1 RETURNING hearing_id',
        [hearing_id]
      );
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all unique hearing types
   * @returns {Promise<Array>} Array of unique hearing types
   */
  static async getAllTypes() {
    try {
      const result = await query(
        'SELECT DISTINCT type FROM hearings WHERE type IS NOT NULL ORDER BY type'
      );
      return result.rows.map(row => row.type);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get hearing calendar for a specific month
   * @param {number} year - Year (e.g., 2025)
   * @param {number} month - Month (1-12)
   * @returns {Promise<Array>} Array of hearings for the month
   */
  static async getMonthlyCalendar(year, month) {
    try {
      const result = await query(
        `SELECT h.hearing_id, h.case_id, h.judge_id, h.date, h.type,
                c.case_number, c.case_type,
                j.name as judge_name,
                court.name as court_name
         FROM hearings h
         LEFT JOIN cases c ON h.case_id = c.case_id
         LEFT JOIN judges j ON h.judge_id = j.judge_id
         LEFT JOIN courts court ON j.court_id = court.court_id
         WHERE EXTRACT(YEAR FROM h.date) = $1 AND EXTRACT(MONTH FROM h.date) = $2
         ORDER BY h.date ASC`,
        [year, month]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get hearing statistics
   * @returns {Promise<Object>} Hearing statistics
   */
  static async getStatistics() {
    try {
      const [totalResult, todayResult, upcomingResult] = await Promise.all([
        query('SELECT COUNT(*) as count FROM hearings'),
        query('SELECT COUNT(*) as count FROM hearings WHERE date = CURRENT_DATE'),
        query('SELECT COUNT(*) as count FROM hearings WHERE date > CURRENT_DATE')
      ]);

      return {
        total_hearings: parseInt(totalResult.rows[0].count),
        todays_hearings: parseInt(todayResult.rows[0].count),
        upcoming_hearings: parseInt(upcomingResult.rows[0].count)
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get hearings for user's cases with lawyers and parties
   * @param {Array} caseIds - Array of case IDs the user has access to
   * @param {number} [limit=50] - Number of records per page
   * @param {number} [offset=0] - Number of records to skip
   * @returns {Promise<Object>} User hearings data with pagination
   */
  static async getUserHearings(caseIds, limit = 50, offset = 0) {
    try {
      if (!caseIds || caseIds.length === 0) {
        return {
          hearings: [],
          pagination: {
            limit,
            offset,
            total: 0,
            hasMore: false
          }
        };
      }

      const placeholders = caseIds.map((_, index) => `$${index + 1}`).join(',');
      const params = [...caseIds, limit, offset];

      const result = await query(
        `SELECT h.hearing_id, h.case_id, h.judge_id, h.date, h.description, h.type,
                c.case_number, c.case_type, c.status as case_status,
                j.name as judge_name, j.designation as judge_designation,
                court.name as court_name, court.location as court_location
         FROM hearings h
         LEFT JOIN cases c ON h.case_id = c.case_id
         LEFT JOIN judges j ON h.judge_id = j.judge_id
         LEFT JOIN courts court ON j.court_id = court.court_id
         WHERE h.case_id IN (${placeholders})
         ORDER BY h.date DESC
         LIMIT $${caseIds.length + 1} OFFSET $${caseIds.length + 2}`,
        params
      );

      // Get lawyers and parties for each hearing
      for (let hearing of result.rows) {
        // Get lawyers and parties for this case
        const lawyersPartiesResult = await query(
          `SELECT l.lawyer_id, l.name as lawyer_name, l.license_no,
                  p.party_id, p.name as party_name, p.role, p.cnic
           FROM case_lawyers cl
           LEFT JOIN lawyers l ON cl.lawyer_id = l.lawyer_id
           LEFT JOIN parties p ON cl.party_id = p.party_id
           WHERE cl.case_id = $1`,
          [hearing.case_id]
        );

        // Group lawyers and parties
        const lawyers = [];
        const parties = [];
        const lawyerMap = new Map();
        const partyMap = new Map();

        for (let row of lawyersPartiesResult.rows) {
          if (row.lawyer_id && !lawyerMap.has(row.lawyer_id)) {
            lawyers.push({
              lawyer_id: row.lawyer_id,
              name: row.lawyer_name,
              license_no: row.license_no
            });
            lawyerMap.set(row.lawyer_id, true);
          }
          
          if (row.party_id && !partyMap.has(row.party_id)) {
            parties.push({
              party_id: row.party_id,
              name: row.party_name,
              role: row.role,
              cnic: row.cnic
            });
            partyMap.set(row.party_id, true);
          }
        }

        hearing.lawyers = lawyers;
        hearing.parties = parties;
      }

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) FROM hearings WHERE case_id IN (${placeholders})`,
        caseIds
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
   * Get upcoming hearings for user's cases with lawyers and parties
   * @param {Array} caseIds - Array of case IDs the user has access to
   * @param {number} [days=30] - Number of days to look ahead
   * @param {number} [limit=50] - Number of records to return
   * @returns {Promise<Object>} Upcoming user hearings data
   */
  static async getUpcomingUserHearings(caseIds, days = 30, limit = 50) {
    try {
      if (!caseIds || caseIds.length === 0) {
        return {
          hearings: [],
          pagination: {
            limit,
            offset: 0,
            total: 0,
            hasMore: false
          }
        };
      }

      const placeholders = caseIds.map((_, index) => `$${index + 1}`).join(',');
      const params = [...caseIds, limit];

      const result = await query(
        `SELECT h.hearing_id, h.case_id, h.judge_id, h.date, h.description, h.type,
                c.case_number, c.case_type, c.status as case_status,
                j.name as judge_name, j.designation as judge_designation,
                court.name as court_name, court.location as court_location
         FROM hearings h
         LEFT JOIN cases c ON h.case_id = c.case_id
         LEFT JOIN judges j ON h.judge_id = j.judge_id
         LEFT JOIN courts court ON j.court_id = court.court_id
         WHERE h.case_id IN (${placeholders})
         AND h.date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '${days} days')
         ORDER BY h.date ASC
         LIMIT $${caseIds.length + 1}`,
        params
      );

      // Get lawyers and parties for each hearing
      for (let hearing of result.rows) {
        // Get lawyers and parties for this case
        const lawyersPartiesResult = await query(
          `SELECT l.lawyer_id, l.name as lawyer_name, l.license_no,
                  p.party_id, p.name as party_name, p.role, p.cnic
           FROM case_lawyers cl
           LEFT JOIN lawyers l ON cl.lawyer_id = l.lawyer_id
           LEFT JOIN parties p ON cl.party_id = p.party_id
           WHERE cl.case_id = $1`,
          [hearing.case_id]
        );

        // Group lawyers and parties
        const lawyers = [];
        const parties = [];
        const lawyerMap = new Map();
        const partyMap = new Map();

        for (let row of lawyersPartiesResult.rows) {
          if (row.lawyer_id && !lawyerMap.has(row.lawyer_id)) {
            lawyers.push({
              lawyer_id: row.lawyer_id,
              name: row.lawyer_name,
              license_no: row.license_no
            });
            lawyerMap.set(row.lawyer_id, true);
          }
          
          if (row.party_id && !partyMap.has(row.party_id)) {
            parties.push({
              party_id: row.party_id,
              name: row.party_name,
              role: row.role,
              cnic: row.cnic
            });
            partyMap.set(row.party_id, true);
          }
        }

        hearing.lawyers = lawyers;
        hearing.parties = parties;
      }

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) FROM hearings 
         WHERE case_id IN (${placeholders})
         AND date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '${days} days')`,
        caseIds
      );
      const totalHearings = parseInt(countResult.rows[0].count);

      return {
        hearings: result.rows,
        pagination: {
          limit,
          offset: 0,
          total: totalHearings,
          hasMore: limit < totalHearings
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get past hearings for user's cases with lawyers and parties
   * @param {Array} caseIds - Array of case IDs the user has access to
   * @param {number} [limit=50] - Number of records to return
   * @param {number} [offset=0] - Number of records to skip
   * @returns {Promise<Object>} Past user hearings data
   */
  static async getPastUserHearings(caseIds, limit = 50, offset = 0) {
    try {
      if (!caseIds || caseIds.length === 0) {
        return {
          hearings: [],
          pagination: {
            limit,
            offset,
            total: 0,
            hasMore: false
          }
        };
      }

      const placeholders = caseIds.map((_, index) => `$${index + 1}`).join(',');
      const params = [...caseIds, limit, offset];

      const result = await query(
        `SELECT h.hearing_id, h.case_id, h.judge_id, h.date, h.description, h.type,
                c.case_number, c.case_type, c.status as case_status,
                j.name as judge_name, j.designation as judge_designation,
                court.name as court_name, court.location as court_location
         FROM hearings h
         LEFT JOIN cases c ON h.case_id = c.case_id
         LEFT JOIN judges j ON h.judge_id = j.judge_id
         LEFT JOIN courts court ON j.court_id = court.court_id
         WHERE h.case_id IN (${placeholders})
         AND h.date < CURRENT_DATE
         ORDER BY h.date DESC
         LIMIT $${caseIds.length + 1} OFFSET $${caseIds.length + 2}`,
        params
      );

      // Get lawyers and parties for each hearing
      for (let hearing of result.rows) {
        // Get lawyers and parties for this case
        const lawyersPartiesResult = await query(
          `SELECT l.lawyer_id, l.name as lawyer_name, l.license_no,
                  p.party_id, p.name as party_name, p.role, p.cnic
           FROM case_lawyers cl
           LEFT JOIN lawyers l ON cl.lawyer_id = l.lawyer_id
           LEFT JOIN parties p ON cl.party_id = p.party_id
           WHERE cl.case_id = $1`,
          [hearing.case_id]
        );

        // Group lawyers and parties
        const lawyers = [];
        const parties = [];
        const lawyerMap = new Map();
        const partyMap = new Map();

        for (let row of lawyersPartiesResult.rows) {
          if (row.lawyer_id && !lawyerMap.has(row.lawyer_id)) {
            lawyers.push({
              lawyer_id: row.lawyer_id,
              name: row.lawyer_name,
              license_no: row.license_no
            });
            lawyerMap.set(row.lawyer_id, true);
          }
          
          if (row.party_id && !partyMap.has(row.party_id)) {
            parties.push({
              party_id: row.party_id,
              name: row.party_name,
              role: row.role,
              cnic: row.cnic
            });
            partyMap.set(row.party_id, true);
          }
        }

        hearing.lawyers = lawyers;
        hearing.parties = parties;
      }

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) FROM hearings 
         WHERE case_id IN (${placeholders})
         AND date < CURRENT_DATE`,
        caseIds
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
   * Create hearing from court search data
   * @param {Object} hearingData - Data from court search API
   * @returns {Promise<Object>} Created hearing data
   */
  static async createFromCourtSearch(hearingData) {
    try {
      const {
        case_id,
        date,
        diary,
        judge_id = null,
        type = 'Regular'
      } = hearingData;

      const newHearing = {
        case_id,
        judge_id,
        date,
        description: diary,
        type
      };

      return await this.create(newHearing);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get hearing summary by case
   * @param {number} case_id - Case ID
   * @returns {Promise<Object>} Hearing summary
   */
  static async getHearingSummaryByCase(case_id) {
    try {
      const [totalResult, latestResult, nextResult] = await Promise.all([
        query('SELECT COUNT(*) as count FROM hearings WHERE case_id = $1', [case_id]),
        query(`SELECT date, description FROM hearings WHERE case_id = $1 
               ORDER BY date DESC LIMIT 1`, [case_id]),
        query(`SELECT date, description FROM hearings WHERE case_id = $1 
               AND date > CURRENT_DATE ORDER BY date ASC LIMIT 1`, [case_id])
      ]);

      return {
        total_hearings: parseInt(totalResult.rows[0].count),
        latest_hearing: latestResult.rows[0] || null,
        next_hearing: nextResult.rows[0] || null
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Hearing;
