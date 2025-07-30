const { query } = require('../lib/db');

class CaseReference {
  /**
   * Create a new case reference
   * @param {Object} referenceData - Case reference data
   * @param {number} referenceData.case_id - Case ID (required)
   * @param {number} referenceData.cited_case_id - Referenced case ID (required)
   * @param {string} [referenceData.reference_note] - Reference note (optional)
   * @returns {Promise<Object>} Created case reference
   */
  static async create({ case_id, cited_case_id, reference_note = null }) {
    try {
      if (!case_id || !cited_case_id) {
        throw new Error('Case ID and Cited Case ID are required');
      }

      if (case_id === cited_case_id) {
        throw new Error('A case cannot reference itself');
      }

      // Check if this reference already exists
      const existing = await this.findByIds(case_id, cited_case_id);
      if (existing) {
        throw new Error('This case reference already exists');
      }

      const result = await query(
        `INSERT INTO case_references (case_id, cited_case_id, reference_note) 
         VALUES ($1, $2, $3) 
         RETURNING case_id, cited_case_id, reference_note`,
        [case_id, cited_case_id, reference_note]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find case reference by IDs
   * @param {number} case_id - Case ID
   * @param {number} cited_case_id - Referenced case ID
   * @returns {Promise<Object|null>} Case reference or null if not found
   */
  static async findByIds(case_id, cited_case_id) {
    try {
      const result = await query(
        'SELECT case_id, cited_case_id, reference_note FROM case_references WHERE case_id = $1 AND cited_case_id = $2',
        [case_id, cited_case_id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all references for a specific case (cases this case references)
   * @param {number} case_id - Case ID
   * @returns {Promise<Array>} Array of referenced cases
   */
  static async getReferencesByCase(case_id) {
    try {
      const result = await query(
        `SELECT cr.case_id, cr.cited_case_id, cr.reference_note,
                c.case_number as cited_case_number, c.case_type as cited_case_type, 
                c.status as cited_case_status, c.filing_date as cited_filing_date,
                c.court_name as cited_court_name
         FROM case_references cr
         INNER JOIN cases c ON cr.cited_case_id = c.case_id
         WHERE cr.case_id = $1
         ORDER BY c.filing_date DESC`,
        [case_id]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all cases that reference a specific case (citing cases)
   * @param {number} cited_case_id - Referenced case ID
   * @returns {Promise<Array>} Array of citing cases
   */
  static async getCitingCases(cited_case_id) {
    try {
      const result = await query(
        `SELECT cr.case_id, cr.cited_case_id, cr.reference_note,
                c.case_number, c.case_type, c.status, c.filing_date, c.court_name
         FROM case_references cr
         INNER JOIN cases c ON cr.case_id = c.case_id
         WHERE cr.cited_case_id = $1
         ORDER BY c.filing_date DESC`,
        [cited_case_id]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all case references with full details
   * @param {number} [limit=50] - Number of records per page
   * @param {number} [offset=0] - Number of records to skip
   * @returns {Promise<Object>} Case references with pagination
   */
  static async findAll(limit = 50, offset = 0) {
    try {
      const result = await query(
        `SELECT cr.case_id, cr.cited_case_id, cr.reference_note,
                c1.case_number as main_case_number, c1.case_type as main_case_type,
                c2.case_number as cited_case_number, c2.case_type as cited_case_type
         FROM case_references cr
         INNER JOIN cases c1 ON cr.case_id = c1.case_id
         INNER JOIN cases c2 ON cr.cited_case_id = c2.case_id
         ORDER BY c1.case_number, c2.case_number
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      // Get total count
      const countResult = await query('SELECT COUNT(*) FROM case_references');
      const totalReferences = parseInt(countResult.rows[0].count);

      return {
        references: result.rows,
        pagination: {
          limit,
          offset,
          total: totalReferences,
          hasMore: offset + limit < totalReferences
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update case reference note
   * @param {number} case_id - Case ID
   * @param {number} cited_case_id - Referenced case ID
   * @param {string} reference_note - New reference note
   * @returns {Promise<Object|null>} Updated case reference or null if not found
   */
  static async updateNote(case_id, cited_case_id, reference_note) {
    try {
      const result = await query(
        `UPDATE case_references SET reference_note = $3 
         WHERE case_id = $1 AND cited_case_id = $2 
         RETURNING case_id, cited_case_id, reference_note`,
        [case_id, cited_case_id, reference_note]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete case reference
   * @param {number} case_id - Case ID
   * @param {number} cited_case_id - Referenced case ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  static async delete(case_id, cited_case_id) {
    try {
      const result = await query(
        'DELETE FROM case_references WHERE case_id = $1 AND cited_case_id = $2 RETURNING case_id',
        [case_id, cited_case_id]
      );
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete all references for a specific case
   * @param {number} case_id - Case ID
   * @returns {Promise<number>} Number of references deleted
   */
  static async deleteByCase(case_id) {
    try {
      const result = await query(
        'DELETE FROM case_references WHERE case_id = $1 OR cited_case_id = $1 RETURNING case_id',
        [case_id]
      );
      return result.rows.length;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get case reference statistics
   * @param {number} case_id - Case ID
   * @returns {Promise<Object>} Reference statistics
   */
  static async getCaseStatistics(case_id) {
    try {
      const referencesResult = await query(
        'SELECT COUNT(*) as references_made FROM case_references WHERE case_id = $1',
        [case_id]
      );

      const citedByResult = await query(
        'SELECT COUNT(*) as cited_by FROM case_references WHERE cited_case_id = $1',
        [case_id]
      );

      return {
        references_made: parseInt(referencesResult.rows[0].references_made),
        cited_by: parseInt(citedByResult.rows[0].cited_by)
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get most cited cases
   * @param {number} [limit=10] - Number of top cases to return
   * @returns {Promise<Array>} Array of most cited cases
   */
  static async getMostCitedCases(limit = 10) {
    try {
      const result = await query(
        `SELECT cr.cited_case_id, c.case_number, c.case_type, c.court_name,
                COUNT(*) as citation_count
         FROM case_references cr
         INNER JOIN cases c ON cr.cited_case_id = c.case_id
         GROUP BY cr.cited_case_id, c.case_number, c.case_type, c.court_name
         ORDER BY citation_count DESC
         LIMIT $1`,
        [limit]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get cases with most references
   * @param {number} [limit=10] - Number of top cases to return
   * @returns {Promise<Array>} Array of cases that reference most other cases
   */
  static async getCasesWithMostReferences(limit = 10) {
    try {
      const result = await query(
        `SELECT cr.case_id, c.case_number, c.case_type, c.court_name,
                COUNT(*) as reference_count
         FROM case_references cr
         INNER JOIN cases c ON cr.case_id = c.case_id
         GROUP BY cr.case_id, c.case_number, c.case_type, c.court_name
         ORDER BY reference_count DESC
         LIMIT $1`,
        [limit]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find circular references (cases that reference each other)
   * @returns {Promise<Array>} Array of circular reference pairs
   */
  static async findCircularReferences() {
    try {
      const result = await query(
        `SELECT cr1.case_id as case1, cr1.cited_case_id as case2,
                c1.case_number as case1_number, c2.case_number as case2_number
         FROM case_references cr1
         INNER JOIN case_references cr2 ON cr1.case_id = cr2.cited_case_id 
                                        AND cr1.cited_case_id = cr2.case_id
         INNER JOIN cases c1 ON cr1.case_id = c1.case_id
         INNER JOIN cases c2 ON cr1.cited_case_id = c2.case_id
         WHERE cr1.case_id < cr1.cited_case_id
         ORDER BY cr1.case_id`
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Bulk create case references
   * @param {Array} references - Array of reference objects
   * @returns {Promise<Array>} Array of created references
   */
  static async bulkCreate(references) {
    try {
      if (!Array.isArray(references) || references.length === 0) {
        throw new Error('References array is required and cannot be empty');
      }

      const values = [];
      const placeholders = [];
      let paramCount = 1;

      references.forEach((ref, index) => {
        if (!ref.case_id || !ref.cited_case_id) {
          throw new Error(`Reference at index ${index} is missing required fields`);
        }
        
        if (ref.case_id === ref.cited_case_id) {
          throw new Error(`Reference at index ${index}: A case cannot reference itself`);
        }
        
        placeholders.push(`($${paramCount}, $${paramCount + 1}, $${paramCount + 2})`);
        values.push(ref.case_id, ref.cited_case_id, ref.reference_note || null);
        paramCount += 3;
      });

      const result = await query(
        `INSERT INTO case_references (case_id, cited_case_id, reference_note) 
         VALUES ${placeholders.join(', ')} 
         RETURNING case_id, cited_case_id, reference_note`,
        values
      );

      return result.rows;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = CaseReference;
