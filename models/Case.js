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
   * @param {string} [caseData.cfms_case_code] - CFMS case code for court system integration (optional)
   * @param {number} [caseData.shc_case_id] - SHC case ID for Sindh High Court integration (optional)
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
        cfms_case_code = null,
        shc_case_id = null
      } = caseData;

      const result = await query(
        `INSERT INTO cases (case_number, court_id, court_name, case_type, legal_section, 
                           filing_date, status, stage, description, next_hearing, cfms_case_code, shc_case_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
         RETURNING case_id, case_number, court_id, court_name, case_type, legal_section, 
                   filing_date, status, stage, description, next_hearing, cfms_case_code, shc_case_id`,
        [case_number, court_id, court_name, case_type, legal_section, 
         filing_date, status, stage, description, next_hearing, cfms_case_code, shc_case_id]
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

      // Get parties through case_lawyers table
      const parties = await query(
        `SELECT DISTINCT p.party_id, p.name, p.cnic, p.role, p.email, p.phone_number
         FROM parties p
         INNER JOIN case_lawyers cl ON p.party_id = cl.party_id
         WHERE cl.case_id = $1
         ORDER BY p.name`,
        [case_id]
      );

      // Get lawyers through case_lawyers table with party information
      const lawyers = await query(
        `SELECT DISTINCT l.lawyer_id, l.name, l.license_no, l.email, l.phone_number,
                STRING_AGG(DISTINCT p.name, ', ') as party_names
         FROM lawyers l
         INNER JOIN case_lawyers cl ON l.lawyer_id = cl.lawyer_id
         LEFT JOIN parties p ON cl.party_id = p.party_id
         WHERE cl.case_id = $1
         GROUP BY l.lawyer_id, l.name, l.license_no, l.email, l.phone_number
         ORDER BY l.name`,
        [case_id]
      );

      // Get recent hearings
      const hearings = await query(
        `SELECT h.hearing_id, h.judge_id, h.date, h.description, h.type,
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
   * Find parties by case ID
   * @param {number} case_id - Case ID
   * @returns {Promise<Array>} Array of parties associated with the case
   */
  static async findPartiesByCaseId(case_id) {
    try {
      const result = await query(
        `SELECT DISTINCT p.party_id, p.name, p.cnic, p.role, p.email, p.phone_number
         FROM parties p
         INNER JOIN case_lawyers cl ON p.party_id = cl.party_id
         WHERE cl.case_id = $1
         ORDER BY p.name`,
        [case_id]
      );
      return result.rows;
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
   * Delete user's association with a case (removes user from case_lawyers, doesn't delete the case itself)
   * @param {number} case_id - Case ID
   * @param {number} user_id - User ID
   * @returns {Promise<Object>} Deletion result with details
   */
  static async deleteUserAssociation(case_id, user_id) {
    try {
      return await transaction(async (client) => {
        // First check if the case exists
        const caseExists = await client.query('SELECT case_id, case_number FROM cases WHERE case_id = $1', [case_id]);
        if (caseExists.rows.length === 0) {
          return {
            success: false,
            message: 'Case not found'
          };
        }

        const caseInfo = caseExists.rows[0];

        // Check if user has any associations with this case
        const userAssociations = await client.query(
          'SELECT * FROM case_lawyers WHERE case_id = $1 AND user_id = $2',
          [case_id, user_id]
        );

        if (userAssociations.rows.length === 0) {
          return {
            success: false,
            message: 'You are not associated with this case'
          };
        }

        // Delete user's associations from case_lawyers
        const deletedAssociations = await client.query(
          'DELETE FROM case_lawyers WHERE case_id = $1 AND user_id = $2 RETURNING *',
          [case_id, user_id]
        );

        // Delete user's reminders for this case
        await client.query(
          'DELETE FROM user_reminders WHERE case_id = $1 AND user_id = $2',
          [case_id, user_id]
        );

        // Check if anyone else is still associated with this case
        const remainingAssociations = await client.query(
          'SELECT COUNT(*) as count FROM case_lawyers WHERE case_id = $1',
          [case_id]
        );

        const remainingCount = parseInt(remainingAssociations.rows[0].count);
        let message = `Your association with case "${caseInfo.case_number}" has been removed successfully`;
        
        // If no one else is associated, we could optionally delete the case entirely
        // For now, we'll just log it and leave the case in the database
        if (remainingCount === 0) {
          message += '. Note: This case has no remaining user associations';
        }

        return {
          success: true,
          message: message,
          data: {
            case_id: case_id,
            case_number: caseInfo.case_number,
            removed_associations: deletedAssociations.rowCount,
            remaining_associations: remainingCount
          }
        };
      });
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
        await client.query('DELETE FROM case_lawyers WHERE case_id = $1', [case_id]);
        await client.query('DELETE FROM hearings WHERE case_id = $1', [case_id]);
        await client.query('DELETE FROM documents WHERE case_id = $1', [case_id]);
        await client.query('DELETE FROM case_references WHERE case_id = $1 OR cited_case_id = $1', [case_id]);
        await client.query('DELETE FROM case_links WHERE parent_case_id = $1 OR child_case_id = $1', [case_id]);

        // Delete the case
        const result = await client.query('DELETE FROM cases WHERE case_id = $1 RETURNING case_id', [case_id]);
        
        return result.rows.length > 0;
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete case with all related data and optional deletion of associated parties and lawyers
   * @param {number} case_id - Case ID
   * @param {boolean} deleteParties - Whether to delete associated parties
   * @param {boolean} deleteLawyers - Whether to delete associated lawyers
   * @returns {Promise<Object>} Deletion summary with counts and warnings
   */
  static async deleteAdvanced(case_id, deleteParties = false, deleteLawyers = false) {
    try {
      return await transaction(async (client) => {
        // First check if case exists
        const caseExists = await client.query('SELECT case_id FROM cases WHERE case_id = $1', [case_id]);
        if (caseExists.rows.length === 0) {
          return null; // Case not found
        }

        const deletionSummary = {
          caseId: case_id,
          deletedRecords: {
            case: 0,
            hearings: 0,
            documents: 0,
            caseReferences: 0,
            caseLinks: 0,
            caseLawyers: 0,
            parties: 0,
            lawyers: 0,
            userParties: 0,
            userLawyers: 0
          },
          warnings: {
            partiesNotDeleted: [],
            lawyersNotDeleted: []
          }
        };

        // Get associated parties and lawyers before deletion if needed
        let associatedPartyIds = [];
        let associatedLawyerIds = [];

        if (deleteParties || deleteLawyers) {
          const associations = await client.query(
            'SELECT DISTINCT party_id, lawyer_id FROM case_lawyers WHERE case_id = $1',
            [case_id]
          );
          
          if (deleteParties) {
            associatedPartyIds = [...new Set(associations.rows.map(row => row.party_id).filter(id => id))];
          }
          
          if (deleteLawyers) {
            associatedLawyerIds = [...new Set(associations.rows.map(row => row.lawyer_id).filter(id => id))];
          }
        }

        // Delete case_lawyers first (this breaks the relationships)
        const caseLawyersResult = await client.query('DELETE FROM case_lawyers WHERE case_id = $1', [case_id]);
        deletionSummary.deletedRecords.caseLawyers = caseLawyersResult.rowCount;

        // Delete hearings and count
        const hearingsResult = await client.query('DELETE FROM hearings WHERE case_id = $1', [case_id]);
        deletionSummary.deletedRecords.hearings = hearingsResult.rowCount;

        // Delete documents and count
        const documentsResult = await client.query('DELETE FROM documents WHERE case_id = $1', [case_id]);
        deletionSummary.deletedRecords.documents = documentsResult.rowCount;

        // Delete case references and count
        const referencesResult = await client.query(
          'DELETE FROM case_references WHERE case_id = $1 OR cited_case_id = $1', 
          [case_id]
        );
        deletionSummary.deletedRecords.caseReferences = referencesResult.rowCount;

        // Delete case links and count
        const linksResult = await client.query(
          'DELETE FROM case_links WHERE parent_case_id = $1 OR child_case_id = $1', 
          [case_id]
        );
        deletionSummary.deletedRecords.caseLinks = linksResult.rowCount;

        // Delete reminders associated with this case
        await client.query(`
          DELETE FROM user_reminders WHERE case_id = $1
        `, [case_id]);

        // Handle party deletion with association checks
        if (deleteParties && associatedPartyIds.length > 0) {
          const partiesToDelete = [];
          const partiesNotToDelete = [];

          for (const partyId of associatedPartyIds) {
            // Check if party is associated with other cases
            const otherCaseAssociations = await client.query(
              'SELECT COUNT(*) as count FROM case_lawyers WHERE party_id = $1 AND case_id != $2',
              [partyId, case_id]
            );

            if (parseInt(otherCaseAssociations.rows[0].count) === 0) {
              partiesToDelete.push(partyId);
            } else {
              // Get party details for warning message
              const partyDetails = await client.query(
                'SELECT name FROM parties WHERE party_id = $1',
                [partyId]
              );
              partiesNotToDelete.push({
                id: partyId,
                name: partyDetails.rows[0]?.name || 'Unknown',
                reason: 'Associated with other cases'
              });
            }
          }

          deletionSummary.warnings.partiesNotDeleted = partiesNotToDelete;

          if (partiesToDelete.length > 0) {
            // First delete user_parties relationships
            const userPartiesResult = await client.query(
              'DELETE FROM user_parties WHERE party_id = ANY($1)',
              [partiesToDelete]
            );
            deletionSummary.deletedRecords.userParties = userPartiesResult.rowCount;

            // Then delete the parties themselves
            const partiesResult = await client.query(
              'DELETE FROM parties WHERE party_id = ANY($1)',
              [partiesToDelete]
            );
            deletionSummary.deletedRecords.parties = partiesResult.rowCount;
          }
        }

        // Handle lawyer deletion with association checks
        if (deleteLawyers && associatedLawyerIds.length > 0) {
          const lawyersToDelete = [];
          const lawyersNotToDelete = [];

          for (const lawyerId of associatedLawyerIds) {
            // Check if lawyer is associated with other cases
            const otherCaseAssociations = await client.query(
              'SELECT COUNT(*) as count FROM case_lawyers WHERE lawyer_id = $1 AND case_id != $2',
              [lawyerId, case_id]
            );

            if (parseInt(otherCaseAssociations.rows[0].count) === 0) {
              lawyersToDelete.push(lawyerId);
            } else {
              // Get lawyer details for warning message
              const lawyerDetails = await client.query(
                'SELECT name FROM lawyers WHERE lawyer_id = $1',
                [lawyerId]
              );
              lawyersNotToDelete.push({
                id: lawyerId,
                name: lawyerDetails.rows[0]?.name || 'Unknown',
                reason: 'Associated with other cases'
              });
            }
          }

          deletionSummary.warnings.lawyersNotDeleted = lawyersNotToDelete;

          if (lawyersToDelete.length > 0) {
            // First delete user_lawyers relationships
            const userLawyersResult = await client.query(
              'DELETE FROM user_lawyers WHERE lawyer_id = ANY($1)',
              [lawyersToDelete]
            );
            deletionSummary.deletedRecords.userLawyers = userLawyersResult.rowCount;

            // Then delete the lawyers themselves
            const lawyersResult = await client.query(
              'DELETE FROM lawyers WHERE lawyer_id = ANY($1)',
              [lawyersToDelete]
            );
            deletionSummary.deletedRecords.lawyers = lawyersResult.rowCount;
          }
        }

        // Finally, delete the case itself
        const caseResult = await client.query('DELETE FROM cases WHERE case_id = $1', [case_id]);
        deletionSummary.deletedRecords.case = caseResult.rowCount;
        
        return deletionSummary;
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
   * Add party to case (through case_lawyers table)
   * Note: This requires a lawyer_id as well since the relationship is case-lawyer-party
   * @param {number} case_id - Case ID
   * @param {number} party_id - Party ID
   * @param {number} lawyer_id - Lawyer ID
   * @param {number} user_id - User ID
   * @returns {Promise<boolean>} True if added successfully
   */
  static async addParty(case_id, party_id, lawyer_id, user_id) {
    try {
      await query(
        'INSERT INTO case_lawyers (case_id, party_id, lawyer_id, user_id) VALUES ($1, $2, $3, $4)',
        [case_id, party_id, lawyer_id, user_id]
      );
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove party from case (from case_lawyers table)
   * @param {number} case_id - Case ID
   * @param {number} party_id - Party ID
   * @returns {Promise<boolean>} True if removed successfully
   */
  static async removeParty(case_id, party_id) {
    try {
      const result = await query(
        'DELETE FROM case_lawyers WHERE case_id = $1 AND party_id = $2',
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
        query('SELECT COUNT(DISTINCT party_id) as count FROM case_lawyers WHERE case_id = $1', [case_id]),
        query('SELECT COUNT(DISTINCT lawyer_id) as count FROM case_lawyers WHERE case_id = $1', [case_id]),
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
   * @param {string} cfms_case_code - CFMS case code from court system
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
        cfms_case_code: caseCode, // Store as string to preserve full case code
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

  /**
   * Find case by SHC case ID
   * @param {number} shc_case_id - SHC case ID
   * @returns {Promise<Object|null>} Case data or null if not found
   */
  static async findBySHCCaseId(shc_case_id) {
    try {
      const result = await query(
        `SELECT case_id, case_number, court_id, court_name, case_type, legal_section, 
                filing_date, status, stage, description, next_hearing, cfms_case_code, shc_case_id 
         FROM cases WHERE shc_case_id = $1`,
        [shc_case_id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create case from SHC search data
   * @param {Object} shcData - Data from SHC search API
   * @returns {Promise<Object>} Created case data
   */
  static async createFromSHCSearch(shcData) {
    try {
      const {
        id,
        caseNo,
        caseName,
        caseTitle,
        circuitCode,
        matter,
        status,
        nextDate
      } = shcData;

      const caseData = {
        case_number: caseNo,
        court_name: circuitCode || 'Sindh High Court',
        case_type: caseName,
        legal_section: matter,
        status: status,
        shc_case_id: parseInt(id),
        description: caseTitle,
        next_hearing: nextDate !== 'Not Available' ? nextDate : null,
        filing_date: new Date().toISOString().split('T')[0] // Current date as filing date
      };

      return await this.create(caseData);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Case;
