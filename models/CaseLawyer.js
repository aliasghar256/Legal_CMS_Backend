const { query } = require('../lib/db');

class CaseLawyer {
  /**
   * Create a new case-lawyer relationship
   * @param {Object} caseLawyerData - Case lawyer relationship data
   * @param {number} caseLawyerData.case_id - Case ID (required)
   * @param {number} caseLawyerData.lawyer_id - Lawyer ID (required)
   * @param {number} caseLawyerData.party_id - Party ID (required)
   * @param {number} [caseLawyerData.user_id] - User ID (optional)
   * @returns {Promise<Object>} Created case-lawyer relationship
   */
  static async create({ case_id, lawyer_id, party_id, user_id = null }) {
    try {
      if (!case_id || !lawyer_id || !party_id) {
        throw new Error('Case ID, Lawyer ID, and Party ID are required');
      }

      // Check if this relationship already exists
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
   * @param {number} lawyer_id - Lawyer ID
   * @param {number} party_id - Party ID
   * @returns {Promise<Object|null>} Case-lawyer relationship or null if not found
   */
  static async findByIds(case_id, lawyer_id, party_id) {
    try {
      const result = await query(
        'SELECT case_id, lawyer_id, party_id, user_id FROM case_lawyers WHERE case_id = $1 AND lawyer_id = $2 AND party_id = $3',
        [case_id, lawyer_id, party_id]
      );
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
                l.name as lawyer_name, l.license_no, l.contact_info as lawyer_contact,
                p.name as party_name, p.cnic, p.role, p.contact_info as party_contact,
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
