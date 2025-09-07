const { query } = require('../lib/db');

class CaseLawyer {
  /**
   * Create a new case-lawyer relationship
   * @param {Object} caseLawyerData - Case lawyer relationship data
   * @param {number} caseLawyerData.case_id - Case ID (required)
   * @param {number|null} caseLawyerData.lawyer_id - Lawyer ID (optional, can be null for cases without lawyers)
   * @param {number} caseLawyerData.party_id - Party ID (required)
   * @param {number} [caseLawyerData.user_id] - User ID (optional)
   * @returns {Promise<Object>} Created case-lawyer relationship
   */
  static async create({ case_id, lawyer_id, party_id, user_id = null }) {
    try {
      if (!case_id || !party_id) {
        throw new Error('Case ID and Party ID are required');
      }

      // Check if this relationship already exists (considering null lawyer_id)
      const existing = await this.findByIds(case_id, lawyer_id, party_id);
      if (existing) {
        throw new Error('This case-lawyer-party relationship already exists');
      }

      const result = await query(
        `INSERT INTO case_lawyers (case_id, lawyer_id, party_id, user_id) 
         VALUES ($1, $2, $3, $4) 
         RETURNING case_id, lawyer_id, party_id, user_id`,
        [case_id, lawyer_id, party_id, user_id]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find case-lawyer relationship by IDs
   * @param {number} case_id - Case ID
   * @param {number|null} lawyer_id - Lawyer ID (can be null)
   * @param {number} party_id - Party ID
   * @returns {Promise<Object|null>} Case-lawyer relationship or null if not found
   */
  static async findByIds(case_id, lawyer_id, party_id) {
    try {
      let query_text;
      let params;
      
      if (lawyer_id === null) {
        query_text = 'SELECT case_id, lawyer_id, party_id, user_id FROM case_lawyers WHERE case_id = $1 AND lawyer_id IS NULL AND party_id = $2';
        params = [case_id, party_id];
      } else {
        query_text = 'SELECT case_id, lawyer_id, party_id, user_id FROM case_lawyers WHERE case_id = $1 AND lawyer_id = $2 AND party_id = $3';
        params = [case_id, lawyer_id, party_id];
      }
      
      const result = await query(query_text, params);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all lawyers for a specific case
   * @param {number} case_id - Case ID
   * @returns {Promise<Array>} Array of lawyers with party information
   */
  static async getLawyersByCase(case_id) {
    try {
      const result = await query(
        `SELECT cl.case_id, cl.lawyer_id, cl.party_id, cl.user_id,
                l.name as lawyer_name, l.license_no, l.email as lawyer_email, l.phone_number as lawyer_phone,
                p.name as party_name, p.cnic, p.role, p.email as party_email, p.phone_number as party_phone,
                u.name as user_name, u.email as user_email
         FROM case_lawyers cl
         INNER JOIN lawyers l ON cl.lawyer_id = l.lawyer_id
         INNER JOIN parties p ON cl.party_id = p.party_id
         LEFT JOIN users u ON cl.user_id = u.user_id
         WHERE cl.case_id = $1
         ORDER BY l.name`,
        [case_id]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all cases for a specific user
   * @param {number} user_id - User ID
   * @param {number} [limit=20] - Number of records per page
   * @param {number} [offset=0] - Number of records to skip
   * @param {string} [status] - Filter by status (optional)
   * @param {string} [case_type] - Filter by case type (optional)
   * @param {number} [court_id] - Filter by court ID (optional)
   * @returns {Promise<Object>} Array of cases with pagination info
   */
  static async getCasesByUserId(user_id, limit = 20, offset = 0, status = null, case_type = null, court_id = null) {
    try {
      // First, get distinct case IDs for the user with pagination
      let sql = `
        SELECT DISTINCT c.case_id, c.case_number, c.court_id, c.court_name, c.case_type, 
               c.legal_section, c.filing_date, c.status, c.stage, c.description, 
               c.next_hearing, c.cfms_case_code
        FROM case_lawyers cl
        INNER JOIN cases c ON cl.case_id = c.case_id
        WHERE cl.user_id = $1`;
      
      let params = [user_id];
      let conditions = [];
      let paramCount = 2;

      if (status) {
        conditions.push(`c.status = $${paramCount}`);
        params.push(status);
        paramCount++;
      }

      if (case_type) {
        conditions.push(`c.case_type = $${paramCount}`);
        params.push(case_type);
        paramCount++;
      }

      if (court_id) {
        conditions.push(`c.court_id = $${paramCount}`);
        params.push(court_id);
        paramCount++;
      }

      if (conditions.length > 0) {
        sql += ' AND ' + conditions.join(' AND ');
      }

      sql += ` ORDER BY c.filing_date DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);

      const result = await query(sql, params);

      // Now get lawyer and party information for each case
      const cases = [];
      for (const caseRow of result.rows) {
        const lawyersParties = await query(`
          SELECT cl.lawyer_id, cl.party_id,
                 l.name as lawyer_name, l.license_no,
                 p.name as party_name, p.role
          FROM case_lawyers cl
          LEFT JOIN lawyers l ON cl.lawyer_id = l.lawyer_id
          INNER JOIN parties p ON cl.party_id = p.party_id
          WHERE cl.case_id = $1 AND cl.user_id = $2
        `, [caseRow.case_id, user_id]);

        // Add lawyer and party info to the case
        if (lawyersParties.rows.length > 0) {
          const firstRow = lawyersParties.rows[0];
          cases.push({
            ...caseRow,
            lawyer_id: firstRow.lawyer_id,
            party_id: firstRow.party_id,
            lawyer_name: firstRow.lawyer_name,
            license_no: firstRow.license_no,
            party_name: firstRow.party_name,
            role: firstRow.role
          });
        } else {
          cases.push(caseRow);
        }
      }

      // Get total count for pagination
      let countSql = `
        SELECT COUNT(DISTINCT c.case_id) 
        FROM case_lawyers cl
        INNER JOIN cases c ON cl.case_id = c.case_id
        WHERE cl.user_id = $1`;
      
      let countParams = [user_id];
      let countParamCount = 2;

      if (status) {
        countSql += ` AND c.status = $${countParamCount}`;
        countParams.push(status);
        countParamCount++;
      }

      if (case_type) {
        countSql += ` AND c.case_type = $${countParamCount}`;
        countParams.push(case_type);
        countParamCount++;
      }

      if (court_id) {
        countSql += ` AND c.court_id = $${countParamCount}`;
        countParams.push(court_id);
        countParamCount++;
      }

      const countResult = await query(countSql, countParams);
      const totalCases = parseInt(countResult.rows[0].count);

      return {
        cases: cases,
        pagination: {
          page: Math.floor(offset / limit) + 1,
          limit,
          offset,
          total: totalCases,
          totalPages: Math.ceil(totalCases / limit),
          hasMore: offset + limit < totalCases,
          hasPrevious: offset > 0
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all cases for a specific lawyer
   * @param {number} lawyer_id - Lawyer ID
   * @returns {Promise<Array>} Array of cases with party information
   */
  static async getCasesByLawyer(lawyer_id) {
    try {
      const result = await query(
        `SELECT cl.case_id, cl.lawyer_id, cl.party_id,
                c.case_number, c.case_type, c.status, c.stage, c.filing_date,
                p.name as party_name, p.role
         FROM case_lawyers cl
         INNER JOIN cases c ON cl.case_id = c.case_id
         INNER JOIN parties p ON cl.party_id = p.party_id
         WHERE cl.lawyer_id = $1
         ORDER BY c.filing_date DESC`,
        [lawyer_id]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all cases for a specific party
   * @param {number} party_id - Party ID
   * @returns {Promise<Array>} Array of cases with lawyer information
   */
  static async getCasesByParty(party_id) {
    try {
      const result = await query(
        `SELECT cl.case_id, cl.lawyer_id, cl.party_id,
                c.case_number, c.case_type, c.status, c.stage, c.filing_date,
                l.name as lawyer_name, l.license_no
         FROM case_lawyers cl
         INNER JOIN cases c ON cl.case_id = c.case_id
         INNER JOIN lawyers l ON cl.lawyer_id = l.lawyer_id
         WHERE cl.party_id = $1
         ORDER BY c.filing_date DESC`,
        [party_id]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all case-lawyer relationships with full details
   * @param {number} [limit=50] - Number of records per page
   * @param {number} [offset=0] - Number of records to skip
   * @returns {Promise<Object>} Case-lawyer relationships with pagination
   */
  static async findAll(limit = 50, offset = 0) {
    try {
      const result = await query(
        `SELECT cl.case_id, cl.lawyer_id, cl.party_id,
                c.case_number, c.case_type, c.status,
                l.name as lawyer_name, l.license_no,
                p.name as party_name, p.role
         FROM case_lawyers cl
         INNER JOIN cases c ON cl.case_id = c.case_id
         INNER JOIN lawyers l ON cl.lawyer_id = l.lawyer_id
         INNER JOIN parties p ON cl.party_id = p.party_id
         ORDER BY c.case_number, l.name
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      // Get total count
      const countResult = await query('SELECT COUNT(*) FROM case_lawyers');
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
   * Delete case-lawyer relationship
   * @param {number} case_id - Case ID
   * @param {number} lawyer_id - Lawyer ID
   * @param {number} party_id - Party ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  static async delete(case_id, lawyer_id, party_id) {
    try {
      const result = await query(
        'DELETE FROM case_lawyers WHERE case_id = $1 AND lawyer_id = $2 AND party_id = $3 RETURNING case_id',
        [case_id, lawyer_id, party_id]
      );
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete all lawyers for a specific case
   * @param {number} case_id - Case ID
   * @returns {Promise<number>} Number of relationships deleted
   */
  static async deleteByCase(case_id) {
    try {
      const result = await query(
        'DELETE FROM case_lawyers WHERE case_id = $1 RETURNING case_id',
        [case_id]
      );
      return result.rows.length;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete all cases for a specific lawyer
   * @param {number} lawyer_id - Lawyer ID
   * @returns {Promise<number>} Number of relationships deleted
   */
  static async deleteByLawyer(lawyer_id) {
    try {
      const result = await query(
        'DELETE FROM case_lawyers WHERE lawyer_id = $1 RETURNING case_id',
        [lawyer_id]
      );
      return result.rows.length;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete all cases for a specific party
   * @param {number} party_id - Party ID
   * @returns {Promise<number>} Number of relationships deleted
   */
  static async deleteByParty(party_id) {
    try {
      const result = await query(
        'DELETE FROM case_lawyers WHERE party_id = $1 RETURNING case_id',
        [party_id]
      );
      return result.rows.length;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if a lawyer is assigned to a case
   * @param {number} case_id - Case ID
   * @param {number} lawyer_id - Lawyer ID
   * @returns {Promise<boolean>} True if lawyer is assigned to case
   */
  static async isLawyerAssignedToCase(case_id, lawyer_id) {
    try {
      const result = await query(
        'SELECT case_id FROM case_lawyers WHERE case_id = $1 AND lawyer_id = $2',
        [case_id, lawyer_id]
      );
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get lawyer statistics
   * @param {number} lawyer_id - Lawyer ID
   * @returns {Promise<Object>} Lawyer statistics
   */
  static async getLawyerStatistics(lawyer_id) {
    try {
      const totalCasesResult = await query(
        'SELECT COUNT(DISTINCT case_id) as total_cases FROM case_lawyers WHERE lawyer_id = $1',
        [lawyer_id]
      );

      const totalPartiesResult = await query(
        'SELECT COUNT(DISTINCT party_id) as total_parties FROM case_lawyers WHERE lawyer_id = $1',
        [lawyer_id]
      );

      const activeCasesResult = await query(
        `SELECT COUNT(DISTINCT cl.case_id) as active_cases 
         FROM case_lawyers cl
         INNER JOIN cases c ON cl.case_id = c.case_id
         WHERE cl.lawyer_id = $1 AND c.status = 'Active'`,
        [lawyer_id]
      );

      return {
        total_cases: parseInt(totalCasesResult.rows[0].total_cases),
        total_parties: parseInt(totalPartiesResult.rows[0].total_parties),
        active_cases: parseInt(activeCasesResult.rows[0].active_cases)
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Bulk create case-lawyer relationships
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
        if (!rel.case_id || !rel.lawyer_id || !rel.party_id) {
          throw new Error(`Relationship at index ${index} is missing required fields`);
        }
        
        placeholders.push(`($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3})`);
        values.push(rel.case_id, rel.lawyer_id, rel.party_id, rel.user_id || null);
        paramCount += 4;
      });

      const result = await query(
        `INSERT INTO case_lawyers (case_id, lawyer_id, party_id, user_id) 
         VALUES ${placeholders.join(', ')} 
         RETURNING case_id, lawyer_id, party_id, user_id`,
        values
      );

      return result.rows;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = CaseLawyer;
