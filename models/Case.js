const { query, transaction } = require('../lib/db');

class Case {
  /**
   * Create a new case
   * @param {Object} caseData - Case information
   * @param {string} [caseData.case_number] - Case number (optional)
   * @param {number} [caseData.court_id] - Court ID (optional)
   * @param {string} [caseData.court_name] - Court name (optional)
   * @param {string} [caseData.case_type] - Case type (optional)
   * @param {string} [caseData.legal_section] - Legal section (optional)
   * @param {string} [caseData.filing_date] - Filing date (optional)
   * @param {string} [caseData.status] - Case status (optional)
   * @param {string} [caseData.stage] - Case stage (optional)
   * @param {string} [caseData.description] - Case description (optional)
   * @param {string} [caseData.next_hearing] - Next hearing date (optional)
   * @param {number} [caseData.cfms_case_code] - CFMS case code for court system integration (optional)
   * @returns {Promise<Object>} Created case data
   */
  static async create(caseData) {
    try {
      const {
        case_number = null,
        court_id = null,
        court_name = null,
        case_type = null,
        legal_section = null,
        filing_date = null,
        status = null,
        stage = null,
        description = null,
        next_hearing = null,
        cfms_case_code = null
      } = caseData;

      const result = await query(
        `INSERT INTO cases (case_number, court_id, court_name, case_type, legal_section, 
                           filing_date, status, stage, description, next_hearing, cfms_case_code) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
         RETURNING case_id, case_number, court_id, court_name, case_type, legal_section, 
                   filing_date, status, stage, description, next_hearing, cfms_case_code`,
        [case_number, court_id, court_name, case_type, legal_section, 
         filing_date, status, stage, description, next_hearing, cfms_case_code]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find case by ID
   * @param {number} case_id - Case ID
   * @returns {Promise<Object|null>} Case data or null if not found
   */
  static async findById(case_id) {
    try {
      const result = await query(
        `SELECT case_id, case_number, court_id, court_name, case_type, legal_section, 
                filing_date, status, stage, description, next_hearing, cfms_case_code 
         FROM cases WHERE case_id = $1`,
        [case_id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find case by ID with related data (parties, lawyers, hearings)
   * @param {number} case_id - Case ID
   * @returns {Promise<Object|null>} Case data with related information
   */
  static async findByIdWithDetails(case_id) {
    try {
      const caseData = await this.findById(case_id);
      if (!caseData) return null;

      // Get parties
      const parties = await query(
        `SELECT p.party_id, p.name, p.cnic, p.role, p.contact_info
         FROM parties p
         INNER JOIN case_parties cp ON p.party_id = cp.party_id
         WHERE cp.case_id = $1
         ORDER BY p.name`,
        [case_id]
      );

      // Get lawyers
      const lawyers = await query(
        `SELECT l.lawyer_id, l.name, l.email, l.license_no, l.contact_info, p.name as party_name
         FROM lawyers l
         INNER JOIN case_lawyers cl ON l.lawyer_id = cl.lawyer_id
         LEFT JOIN parties p ON cl.party_id = p.party_id
         WHERE cl.case_id = $1
         ORDER BY l.name`,
        [case_id]
      );

      // Get recent hearings
      const hearings = await query(
        `SELECT h.hearing_id, h.judge_id, h.date, h.description, h.type, h.next_hearing_date,
                j.name as judge_name
         FROM hearings h
         LEFT JOIN judges j ON h.judge_id = j.judge_id
         WHERE h.case_id = $1
         ORDER BY h.date DESC
         LIMIT 10`,
        [case_id]
      );

      // Get documents
      const documents = await query(
        `SELECT d.document_id, d.type, d.file_path, d.date_uploaded,
                l.name as uploaded_by_name
         FROM documents d
         LEFT JOIN lawyers l ON d.uploaded_by = l.lawyer_id
         WHERE d.case_id = $1
         ORDER BY d.date_uploaded DESC
         LIMIT 10`,
        [case_id]
      );

      return {
        ...caseData,
        parties: parties.rows,
        lawyers: lawyers.rows,
        hearings: hearings.rows,
        documents: documents.rows
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find cases by case number (partial match)
   * @param {string} case_number - Case number to search for
   * @returns {Promise<Array>} Array of matching cases
   */
  static async findByCaseNumber(case_number) {
    try {
      const result = await query(
        `SELECT case_id, case_number, court_name, case_type, filing_date, status, stage, next_hearing
         FROM cases WHERE case_number ILIKE $1 ORDER BY filing_date DESC`,
        [`%${case_number}%`]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find cases by status
   * @param {string} status - Case status
   * @returns {Promise<Array>} Array of cases with specified status
   */
  static async findByStatus(status) {
    try {
      const result = await query(
        `SELECT case_id, case_number, court_name, case_type, filing_date, status, stage, next_hearing
         FROM cases WHERE status = $1 ORDER BY filing_date DESC`,
        [status]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find cases by court
   * @param {number} court_id - Court ID
   * @returns {Promise<Array>} Array of cases in specified court
   */
  static async findByCourtId(court_id) {
    try {
      const result = await query(
        `SELECT case_id, case_number, court_name, case_type, filing_date, status, stage, next_hearing
         FROM cases WHERE court_id = $1 ORDER BY filing_date DESC`,
        [court_id]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all cases with pagination and filtering
   * @param {number} [limit=20] - Number of records per page
   * @param {number} [offset=0] - Number of records to skip
   * @param {string} [status] - Filter by status (optional)
   * @param {string} [case_type] - Filter by case type (optional)
   * @param {number} [court_id] - Filter by court ID (optional)
   * @returns {Promise<Object>} Cases data with pagination info
   */
  static async findAll(limit = 20, offset = 0, status = null, case_type = null, court_id = null) {
    try {
      let sql = `SELECT case_id, case_number, court_name, case_type, filing_date, status, stage, next_hearing
                 FROM cases`;
      let params = [];
      let conditions = [];
      let paramCount = 1;

      if (status) {
        conditions.push(`status = $${paramCount}`);
        params.push(status);
        paramCount++;
      }

      if (case_type) {
        conditions.push(`case_type = $${paramCount}`);
        params.push(case_type);
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

      sql += ` ORDER BY filing_date DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);

      const result = await query(sql, params);

      // Get total count
      let countSql = 'SELECT COUNT(*) FROM cases';
      let countParams = [];
      if (conditions.length > 0) {
        countSql += ' WHERE ' + conditions.join(' AND ');
        countParams = params.slice(0, -2); // Remove limit and offset
      }

      const countResult = await query(countSql, countParams);
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
   * Update case
   * @param {number} case_id - Case ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated case data or null if not found
   */
  static async update(case_id, updates) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      const allowedFields = ['case_number', 'court_id', 'court_name', 'case_type', 
                            'legal_section', 'filing_date', 'status', 'stage', 'description', 
                            'next_hearing', 'cfms_case_code'];

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

      values.push(case_id);
      const result = await query(
        `UPDATE cases SET ${fields.join(', ')} WHERE case_id = $${paramCount} 
         RETURNING case_id, case_number, court_id, court_name, case_type, legal_section, 
                   filing_date, status, stage, description, next_hearing, cfms_case_code`,
        values
      );

      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete case with all related data
   * @param {number} case_id - Case ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  static async delete(case_id) {
    try {
      return await transaction(async (client) => {
        // Delete related records first
        await client.query('DELETE FROM case_parties WHERE case_id = $1', [case_id]);
        await client.query('DELETE FROM case_lawyers WHERE case_id = $1', [case_id]);
        await client.query('DELETE FROM hearings WHERE case_id = $1', [case_id]);
        await client.query('DELETE FROM documents WHERE case_id = $1', [case_id]);
        await client.query('DELETE FROM case_references WHERE case_id = $1 OR cited_case_id = $1', [case_id]);
        await client.query('DELETE FROM case_links WHERE case_id_1 = $1 OR case_id_2 = $1', [case_id]);

        // Delete the case
        const result = await client.query('DELETE FROM cases WHERE case_id = $1 RETURNING case_id', [case_id]);
        
        return result.rows.length > 0;
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all unique case types
   * @returns {Promise<Array>} Array of unique case types
   */
  static async getAllCaseTypes() {
    try {
      const result = await query(
        'SELECT DISTINCT case_type FROM cases WHERE case_type IS NOT NULL ORDER BY case_type'
      );
      return result.rows.map(row => row.case_type);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all unique statuses
   * @returns {Promise<Array>} Array of unique statuses
   */
  static async getAllStatuses() {
    try {
      const result = await query(
        'SELECT DISTINCT status FROM cases WHERE status IS NOT NULL ORDER BY status'
      );
      return result.rows.map(row => row.status);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all unique stages
   * @returns {Promise<Array>} Array of unique stages
   */
  static async getAllStages() {
    try {
      const result = await query(
        'SELECT DISTINCT stage FROM cases WHERE stage IS NOT NULL ORDER BY stage'
      );
      return result.rows.map(row => row.stage);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Add party to case
   * @param {number} case_id - Case ID
   * @param {number} party_id - Party ID
   * @returns {Promise<boolean>} True if added successfully
   */
  static async addParty(case_id, party_id) {
    try {
      await query(
        'INSERT INTO case_parties (case_id, party_id) VALUES ($1, $2)',
        [case_id, party_id]
      );
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove party from case
   * @param {number} case_id - Case ID
   * @param {number} party_id - Party ID
   * @returns {Promise<boolean>} True if removed successfully
   */
  static async removeParty(case_id, party_id) {
    try {
      const result = await query(
        'DELETE FROM case_parties WHERE case_id = $1 AND party_id = $2',
        [case_id, party_id]
      );
      return result.rowCount > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Add lawyer to case
   * @param {number} case_id - Case ID
   * @param {number} lawyer_id - Lawyer ID
   * @param {number} [party_id] - Party ID the lawyer represents
   * @returns {Promise<boolean>} True if added successfully
   */
  static async addLawyer(case_id, lawyer_id, party_id = null) {
    try {
      await query(
        'INSERT INTO case_lawyers (case_id, lawyer_id, party_id) VALUES ($1, $2, $3)',
        [case_id, lawyer_id, party_id]
      );
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove lawyer from case
   * @param {number} case_id - Case ID
   * @param {number} lawyer_id - Lawyer ID
   * @returns {Promise<boolean>} True if removed successfully
   */
  static async removeLawyer(case_id, lawyer_id) {
    try {
      const result = await query(
        'DELETE FROM case_lawyers WHERE case_id = $1 AND lawyer_id = $2',
        [case_id, lawyer_id]
      );
      return result.rowCount > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get case statistics
   * @param {number} case_id - Case ID
   * @returns {Promise<Object>} Case statistics
   */
  static async getStatistics(case_id) {
    try {
      const [partiesResult, lawyersResult, hearingsResult, documentsResult] = await Promise.all([
        query('SELECT COUNT(*) as count FROM case_parties WHERE case_id = $1', [case_id]),
        query('SELECT COUNT(*) as count FROM case_lawyers WHERE case_id = $1', [case_id]),
        query('SELECT COUNT(*) as count FROM hearings WHERE case_id = $1', [case_id]),
        query('SELECT COUNT(*) as count FROM documents WHERE case_id = $1', [case_id])
      ]);

      return {
        total_parties: parseInt(partiesResult.rows[0].count),
        total_lawyers: parseInt(lawyersResult.rows[0].count),
        total_hearings: parseInt(hearingsResult.rows[0].count),
        total_documents: parseInt(documentsResult.rows[0].count)
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find case by CFMS case code
   * @param {number} cfms_case_code - CFMS case code from court system
   * @returns {Promise<Object|null>} Case data or null if not found
   */
  static async findByCfmsCaseCode(cfms_case_code) {
    try {
      const result = await query(
        `SELECT case_id, case_number, court_id, court_name, case_type, legal_section, 
                filing_date, status, stage, description, next_hearing, cfms_case_code 
         FROM cases WHERE cfms_case_code = $1`,
        [cfms_case_code]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create case from court search data
   * @param {Object} courtData - Data from court search API
   * @returns {Promise<Object>} Created case data
   */
  static async createFromCourtSearch(courtData) {
    try {
      const {
        caseCode,
        caseNumber,
        caseType,
        courtName,
        parties,
        statusText,
        hearingDate
      } = courtData;

      const caseData = {
        case_number: caseNumber,
        court_name: courtName,
        case_type: caseType,
        status: statusText,
        cfms_case_code: parseInt(caseCode),
        description: parties,
        next_hearing: hearingDate !== 'NOT FOUND' ? hearingDate : null,
        filing_date: new Date().toISOString().split('T')[0] // Current date as filing date
      };

      return await this.create(caseData);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update case with court search data
   * @param {number} case_id - Case ID
   * @param {Object} courtData - Data from court search API
   * @returns {Promise<Object|null>} Updated case data
   */
  static async updateFromCourtSearch(case_id, courtData) {
    try {
      const {
        caseNumber,
        caseType,
        courtName,
        parties,
        statusText,
        hearingDate
      } = courtData;

      const updates = {
        case_number: caseNumber,
        court_name: courtName,
        case_type: caseType,
        status: statusText,
        description: parties,
        next_hearing: hearingDate !== 'NOT FOUND' ? hearingDate : null
      };

      return await this.update(case_id, updates);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get cases with upcoming hearings
   * @param {number} [days=7] - Number of days to look ahead
   * @returns {Promise<Array>} Array of cases with upcoming hearings
   */
  static async getCasesWithUpcomingHearings(days = 7) {
    try {
      const result = await query(
        `SELECT case_id, case_number, court_name, case_type, status, next_hearing
         FROM cases 
         WHERE next_hearing BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '${days} days')
         ORDER BY next_hearing ASC`,
        []
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get cases with overdue hearings
   * @returns {Promise<Array>} Array of cases with overdue hearings
   */
  static async getCasesWithOverdueHearings() {
    try {
      const result = await query(
        `SELECT case_id, case_number, court_name, case_type, status, next_hearing
         FROM cases 
         WHERE next_hearing < CURRENT_DATE AND next_hearing IS NOT NULL
         ORDER BY next_hearing ASC`
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Case;
