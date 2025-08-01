const { query } = require('../lib/db');

class Lawyer {
  /**
   * Create a new lawyer
   * @param {Object} lawyerData - Lawyer information
   * @param {string} lawyerData.name - Lawyer name (required)
   * @param {string} [lawyerData.license_no] - License number (optional)
   * @param {string} [lawyerData.contact_info] - Contact information (optional)
   * @returns {Promise<Object>} Created lawyer data
   */
  static async create({ name, license_no = null, contact_info = null }) {
    try {
      if (!name) {
        throw new Error('Lawyer name is required');
      }

      const result = await query(
        `INSERT INTO lawyers (name, license_no, contact_info) 
         VALUES ($1, $2, $3) 
         RETURNING lawyer_id, name, license_no, contact_info`,
        [name, license_no, contact_info]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find lawyer by ID
   * @param {number} lawyer_id - Lawyer ID
   * @returns {Promise<Object|null>} Lawyer data or null if not found
   */
  static async findById(lawyer_id) {
    try {
      const result = await query(
        'SELECT lawyer_id, name, license_no, contact_info FROM lawyers WHERE lawyer_id = $1',
        [lawyer_id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find lawyers by name (partial match)
   * @param {string} name - Name to search for
   * @returns {Promise<Array>} Array of matching lawyers
   */
  static async findByName(name) {
    try {
      const result = await query(
        'SELECT lawyer_id, name, license_no, contact_info FROM lawyers WHERE name ILIKE $1 ORDER BY name',
        [`%${name}%`]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find lawyer by license number
   * @param {string} license_no - License number
   * @returns {Promise<Object|null>} Lawyer data or null if not found
   */
  static async findByLicenseNo(license_no) {
    try {
      const result = await query(
        'SELECT lawyer_id, name, license_no, contact_info FROM lawyers WHERE license_no = $1',
        [license_no]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all lawyers with pagination
   * @param {number} [limit=50] - Number of records per page
   * @param {number} [offset=0] - Number of records to skip
   * @returns {Promise<Object>} Lawyers data with pagination info
   */
  static async findAll(limit = 50, offset = 0) {
    try {
      const result = await query(
        'SELECT lawyer_id, name, license_no, contact_info FROM lawyers ORDER BY name LIMIT $1 OFFSET $2',
        [limit, offset]
      );

      // Get total count
      const countResult = await query('SELECT COUNT(*) FROM lawyers');
      const totalLawyers = parseInt(countResult.rows[0].count);

      return {
        lawyers: result.rows,
        pagination: {
          limit,
          offset,
          total: totalLawyers,
          hasMore: offset + limit < totalLawyers
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update lawyer
   * @param {number} lawyer_id - Lawyer ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated lawyer data or null if not found
   */
  static async update(lawyer_id, updates) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      Object.keys(updates).forEach(key => {
        if (['name', 'license_no', 'contact_info'].includes(key) && updates[key] !== undefined) {
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
         RETURNING lawyer_id, name, license_no, contact_info`,
        values
      );

      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete lawyer
   * @param {number} lawyer_id - Lawyer ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  static async delete(lawyer_id) {
    try {
      const result = await query(
        'DELETE FROM lawyers WHERE lawyer_id = $1 RETURNING lawyer_id',
        [lawyer_id]
      );
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if license number already exists
   * @param {string} license_no - License number to check
   * @param {number} [excludeLawyerId] - Lawyer ID to exclude from check
   * @returns {Promise<boolean>} True if license exists, false otherwise
   */
  static async licenseExists(license_no, excludeLawyerId = null) {
    try {
      if (!license_no) return false;

      let sql = 'SELECT lawyer_id FROM lawyers WHERE license_no = $1';
      let params = [license_no];

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

  /**
   * Get cases associated with a lawyer
   * @param {number} lawyer_id - Lawyer ID
   * @param {number} [limit=20] - Number of cases to return
   * @param {number} [offset=0] - Number of cases to skip
   * @returns {Promise<Object>} Cases data with pagination
   */
  static async getCases(lawyer_id, limit = 20, offset = 0) {
    try {
      const result = await query(
        `SELECT cl.case_id, c.case_number, c.case_type, c.status, c.filing_date,
                p.name as party_name, p.role as party_role
         FROM case_lawyers cl
         INNER JOIN cases c ON cl.case_id = c.case_id
         INNER JOIN parties p ON cl.party_id = p.party_id
         WHERE cl.lawyer_id = $1
         ORDER BY c.filing_date DESC
         LIMIT $2 OFFSET $3`,
        [lawyer_id, limit, offset]
      );

      // Get total count
      const countResult = await query(
        'SELECT COUNT(*) FROM case_lawyers WHERE lawyer_id = $1',
        [lawyer_id]
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
   * Get lawyer statistics
   * @param {number} lawyer_id - Lawyer ID
   * @returns {Promise<Object>} Lawyer statistics
   */
  static async getStatistics(lawyer_id) {
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
}

module.exports = Lawyer;

module.exports = Lawyer;
