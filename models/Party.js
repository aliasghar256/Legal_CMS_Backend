const { query } = require('../lib/db');

class Party {
  /**
   * Create a new party
   * @param {Object} partyData - Party information
   * @param {string} partyData.name - Party name (required)
   * @param {string} [partyData.cnic] - CNIC number (optional)
   * @param {string} [partyData.role] - Party role (optional)
   * @param {string} [partyData.email] - Email address (optional)
   * @param {string} [partyData.phone_number] - Phone number (optional)
   * @returns {Promise<Object>} Created party data
   */
  static async create({ name, cnic = null, role = null, email = null, phone_number = null }) {
    try {
      if (!name) {
        throw new Error('Party name is required');
      }

      const result = await query(
        `INSERT INTO parties (name, cnic, role, email, phone_number) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING party_id, name, cnic, role, email, phone_number`,
        [name, cnic, role, email, phone_number]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find party by ID
   * @param {number} party_id - Party ID
   * @returns {Promise<Object|null>} Party data or null if not found
   */
  static async findById(party_id) {
    try {
      const result = await query(
        'SELECT party_id, name, cnic, role, email, phone_number FROM parties WHERE party_id = $1',
        [party_id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find parties by name (partial match)
   * @param {string} name - Name to search for
   * @returns {Promise<Array>} Array of matching parties
   */
  static async findByName(name) {
    try {
      const result = await query(
        'SELECT party_id, name, cnic, role, email, phone_number FROM parties WHERE name ILIKE $1 ORDER BY name',
        [`%${name}%`]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find party by CNIC
   * @param {string} cnic - CNIC number
   * @returns {Promise<Object|null>} Party data or null if not found
   */
  static async findByCnic(cnic) {
    try {
      const result = await query(
        'SELECT party_id, name, cnic, role, email, phone_number FROM parties WHERE cnic = $1',
        [cnic]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all parties with pagination
   * @param {number} [limit=50] - Number of records per page
   * @param {number} [offset=0] - Number of records to skip
   * @param {string} [role] - Filter by role (optional)
   * @returns {Promise<Object>} Parties data with pagination info
   */
  static async findAll(limit = 50, offset = 0, role = null) {
    try {
      let sql = 'SELECT party_id, name, cnic, role, email, phone_number FROM parties';
      let params = [];
      let paramCount = 1;

      if (role) {
        sql += ' WHERE role = $' + paramCount;
        params.push(role);
        paramCount++;
      }

      sql += ' ORDER BY name LIMIT $' + paramCount + ' OFFSET $' + (paramCount + 1);
      params.push(limit, offset);

      const result = await query(sql, params);

      // Get total count
      let countSql = 'SELECT COUNT(*) FROM parties';
      let countParams = [];
      if (role) {
        countSql += ' WHERE role = $1';
        countParams.push(role);
      }

      const countResult = await query(countSql, countParams);
      const totalParties = parseInt(countResult.rows[0].count);

      return {
        parties: result.rows,
        pagination: {
          limit,
          offset,
          total: totalParties,
          hasMore: offset + limit < totalParties
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update party
   * @param {number} party_id - Party ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated party data or null if not found
   */
  static async update(party_id, updates) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      Object.keys(updates).forEach(key => {
        if (['name', 'cnic', 'role', 'email', 'phone_number'].includes(key) && updates[key] !== undefined) {
          fields.push(`${key} = $${paramCount}`);
          values.push(updates[key]);
          paramCount++;
        }
      });

      if (fields.length === 0) {
        throw new Error('No valid fields to update');
      }

      values.push(party_id);
      const result = await query(
        `UPDATE parties SET ${fields.join(', ')} WHERE party_id = $${paramCount} 
         RETURNING party_id, name, cnic, role, email, phone_number`,
        values
      );

      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete party
   * @param {number} party_id - Party ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  static async delete(party_id) {
    try {
      const result = await query(
        'DELETE FROM parties WHERE party_id = $1 RETURNING party_id',
        [party_id]
      );
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete party with case association checking
   * @param {number} party_id - Party ID
   * @returns {Promise<Object>} Deletion result with details
   */
  static async deleteWithValidation(party_id) {
    try {
      // First check if party exists
      const party = await this.findById(party_id);
      if (!party) {
        return {
          success: false,
          message: 'Party not found',
          code: 'PARTY_NOT_FOUND'
        };
      }

      // Check if party is associated with any cases
      const caseAssociations = await query(
        `SELECT c.case_id, c.case_number, c.case_type, c.status 
         FROM case_lawyers cl
         INNER JOIN cases c ON cl.case_id = c.case_id
         WHERE cl.party_id = $1
         ORDER BY c.case_number`,
        [party_id]
      );

      if (caseAssociations.rows.length > 0) {
        return {
          success: false,
          message: `Cannot delete party "${party.name}" because it is associated with ${caseAssociations.rows.length} case(s). Please delete or update the associated cases first.`,
          code: 'PARTY_HAS_CASE_ASSOCIATIONS',
          associatedCases: caseAssociations.rows,
          partyDetails: party
        };
      }

      // If no case associations, proceed with deletion
      // First delete from user_parties table
      await query('DELETE FROM user_parties WHERE party_id = $1', [party_id]);

      // Then delete the party
      const deleteResult = await query(
        'DELETE FROM parties WHERE party_id = $1 RETURNING party_id',
        [party_id]
      );

      return {
        success: true,
        message: `Party "${party.name}" deleted successfully`,
        deletedParty: party
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get parties associated with a specific case
   * @param {number} case_id - Case ID
   * @returns {Promise<Array>} Array of parties associated with the case
   */
  static async findByCaseId(case_id) {
    try {
      const result = await query(
        `SELECT p.party_id, p.name, p.cnic, p.role, p.email, p.phone_number
         FROM parties p
         INNER JOIN case_parties cp ON p.party_id = cp.party_id
         WHERE cp.case_id = $1
         ORDER BY p.name`,
        [case_id]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all unique roles
   * @returns {Promise<Array>} Array of unique roles
   */
  static async getAllRoles() {
    try {
      const result = await query(
        'SELECT DISTINCT role FROM parties WHERE role IS NOT NULL ORDER BY role'
      );
      return result.rows.map(row => row.role);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if CNIC already exists
   * @param {string} cnic - CNIC to check
   * @param {number} [excludePartyId] - Party ID to exclude from check
   * @returns {Promise<boolean>} True if CNIC exists, false otherwise
   */
  static async cnicExists(cnic, excludePartyId = null) {
    try {
      if (!cnic) return false;

      let sql = 'SELECT party_id FROM parties WHERE cnic = $1';
      let params = [cnic];

      if (excludePartyId) {
        sql += ' AND party_id != $2';
        params.push(excludePartyId);
      }

      const result = await query(sql, params);
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Party;
