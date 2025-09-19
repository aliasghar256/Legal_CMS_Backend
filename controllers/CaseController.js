const Case = require('../models/Case');
const CaseLawyer = require('../models/CaseLawyer');
const Hearing = require('../models/Hearing');
const UserLawyer = require('../models/UserLawyer');
const UserParty = require('../models/UserParty');
const { transaction } = require('../lib/db');

class CaseController {
  // Get all cases for the authenticated user
  static async getUserCases(req, res) {
    try {
      const { page = 1, limit = 20, status, case_type, court_id } = req.query;
      
      // Validate page and limit
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(Math.max(1, parseInt(limit)), 100); // Max 100 per page
      const offset = (pageNum - 1) * limitNum;
      
      const user_id = req.user.user_id;
      
      console.log(`Getting user cases - Page: ${pageNum}, Limit: ${limitNum}, Offset: ${offset}`);
      
      // Get cases for the user
      const casesResult = await CaseLawyer.getCasesByUserId(
        user_id,
        limitNum, 
        offset, 
        status, 
        case_type, 
        court_id ? parseInt(court_id) : null
      );
      
      res.json({
        success: true,
        data: casesResult
      });
    } catch (error) {
      console.error('Error in getUserCases:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Search user cases with comprehensive text search
  static async searchUserCases(req, res) {
    try {
      const { 
        query: searchQuery = '', 
        page = 1, 
        limit = 20, 
        status, 
        case_type, 
        court_id 
      } = req.query;
      
      // Validate page and limit
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(Math.max(1, parseInt(limit)), 100); // Max 100 per page
      const offset = (pageNum - 1) * limitNum;
      
      const user_id = req.user.user_id;
      
      console.log(`Searching user cases - Query: "${searchQuery}", Page: ${pageNum}, Limit: ${limitNum}`);
      
      if (!searchQuery || searchQuery.trim() === '') {
        // If no search query, return regular user cases
        const casesResult = await CaseLawyer.getCasesByUserId(
          user_id,
          limitNum, 
          offset, 
          status, 
          case_type, 
          court_id ? parseInt(court_id) : null
        );
        
        return res.json({
          success: true,
          data: casesResult
        });
      }

      // Perform comprehensive search using raw SQL for better performance
      const { query } = require('../lib/db');
      
      // Build the search conditions
      const searchTerm = `%${searchQuery.toLowerCase()}%`;
      let whereConditions = [
        'cl.user_id = $1'
      ];
      let queryParams = [user_id];
      let paramIndex = 2;

      // Add search conditions
      whereConditions.push(`(
        LOWER(c.case_number) LIKE $${paramIndex} OR
        LOWER(c.court_name) LIKE $${paramIndex} OR
        LOWER(c.case_type) LIKE $${paramIndex} OR
        LOWER(c.legal_section) LIKE $${paramIndex} OR
        LOWER(c.status) LIKE $${paramIndex} OR
        LOWER(c.stage) LIKE $${paramIndex} OR
        LOWER(c.description) LIKE $${paramIndex} OR
        LOWER(l.name) LIKE $${paramIndex} OR
        LOWER(l.license_no) LIKE $${paramIndex} OR
        LOWER(p.name) LIKE $${paramIndex} OR
        LOWER(p.cnic) LIKE $${paramIndex} OR
        LOWER(p.role) LIKE $${paramIndex}
      )`);
      queryParams.push(searchTerm);
      paramIndex++;

      // Add optional filters
      if (status) {
        whereConditions.push(`LOWER(c.status) = $${paramIndex}`);
        queryParams.push(status.toLowerCase());
        paramIndex++;
      }

      if (case_type) {
        whereConditions.push(`LOWER(c.case_type) = $${paramIndex}`);
        queryParams.push(case_type.toLowerCase());
        paramIndex++;
      }

      if (court_id) {
        whereConditions.push(`c.court_id = $${paramIndex}`);
        queryParams.push(parseInt(court_id));
        paramIndex++;
      }

      // Count total results for pagination
      const countQuery = `
        SELECT COUNT(DISTINCT c.case_id) as total
        FROM cases c
        INNER JOIN case_lawyers cl ON c.case_id = cl.case_id
        LEFT JOIN lawyers l ON cl.lawyer_id = l.lawyer_id
        LEFT JOIN parties p ON cl.party_id = p.party_id
        WHERE ${whereConditions.join(' AND ')}
      `;

      const countResult = await query(countQuery, queryParams);
      const totalCases = parseInt(countResult.rows[0]?.total || 0);

      // Get paginated search results
      const searchQuerySQL = `
        SELECT 
          c.case_id,
          c.case_number,
          c.court_name,
          c.court_id,
          c.case_type,
          c.legal_section,
          c.filing_date,
          c.status,
          c.stage,
          c.description,
          c.next_hearing,
          c.cfms_case_code,
          
          -- Aggregate lawyers for this case
          COALESCE(
            (SELECT JSON_AGG(
              DISTINCT JSONB_BUILD_OBJECT(
                'lawyer_id', l2.lawyer_id,
                'name', l2.name,
                'license_no', l2.license_no,
                'email', l2.email,
                'phone_number', l2.phone_number
              )
            ) 
            FROM case_lawyers cl2 
            INNER JOIN lawyers l2 ON cl2.lawyer_id = l2.lawyer_id 
            WHERE cl2.case_id = c.case_id AND cl2.user_id = $1), 
            '[]'
          ) as lawyers,
          
          -- Aggregate parties for this case
          COALESCE(
            (SELECT JSON_AGG(
              DISTINCT JSONB_BUILD_OBJECT(
                'party_id', p2.party_id,
                'name', p2.name,
                'cnic', p2.cnic,
                'role', p2.role,
                'email', p2.email,
                'phone_number', p2.phone_number
              )
            ) 
            FROM case_lawyers cl3 
            INNER JOIN parties p2 ON cl3.party_id = p2.party_id 
            WHERE cl3.case_id = c.case_id AND cl3.user_id = $1), 
            '[]'
          ) as parties
          
        FROM (
          SELECT DISTINCT c.case_id
          FROM cases c
          INNER JOIN case_lawyers cl ON c.case_id = cl.case_id
          LEFT JOIN lawyers l ON cl.lawyer_id = l.lawyer_id
          LEFT JOIN parties p ON cl.party_id = p.party_id
          WHERE ${whereConditions.join(' AND ')}
          ORDER BY c.case_id DESC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        ) AS case_ids
        INNER JOIN cases c ON case_ids.case_id = c.case_id
        ORDER BY c.case_id DESC
      `;

      queryParams.push(limitNum, offset);

      const searchResult = await query(searchQuerySQL, queryParams);
      const cases = searchResult.rows;

      // Calculate pagination
      const totalPages = Math.ceil(totalCases / limitNum);
      const hasMore = pageNum < totalPages;
      const hasPrevious = pageNum > 1;

      const pagination = {
        page: pageNum,
        limit: limitNum,
        offset: offset,
        total: totalCases,
        totalPages: totalPages,
        hasMore: hasMore,
        hasPrevious: hasPrevious
      };

      res.json({
        success: true,
        data: {
          cases: cases,
          pagination: pagination
        }
      });

    } catch (error) {
      console.error('Error in searchUserCases:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get all cases
  static async getAllCases(req, res) {
    try {
      const { page = 1, limit = 20, status, case_type, court_id } = req.query;
      const offset = (page - 1) * limit;
      
      const result = await Case.findAll(
        parseInt(limit), 
        parseInt(offset), 
        status, 
        case_type, 
        court_id ? parseInt(court_id) : null
      );
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error in getAllCases:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get case by ID with full details
  static async getCaseByIdWithDetails(req, res) {
    try {
      const caseId = parseInt(req.params.id);
      
      if (isNaN(caseId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid case ID'
        });
      }
      
      const caseData = await Case.findByIdWithDetails(caseId);
      
      if (!caseData) {
        return res.status(404).json({
          success: false,
          message: 'Case not found'
        });
      }
      
      res.json({
        success: true,
        data: caseData
      });
    } catch (error) {
      console.error('Error in getCaseByIdWithDetails:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get case by ID
  static async getCaseById(req, res) {
    try {
      const caseId = parseInt(req.params.id);
      
      if (isNaN(caseId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid case ID'
        });
      }
      
      const caseData = await Case.findById(caseId);
      
      if (!caseData) {
        return res.status(404).json({
          success: false,
          message: 'Case not found'
        });
      }
      
      res.json({
        success: true,
        data: caseData
      });
    } catch (error) {
      console.error('Error in getCaseById:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Create new case with associated lawyers and parties
  static async createCase(req, res) {
    try {
      const user_id = req.user.user_id;
      const { lawyer_ids = [], party_ids = [], hearing_data, ...caseData } = req.body;
      
      console.log('Creating case with data:', {
        user_id,
        caseData,
        lawyer_ids,
        party_ids,
        hearing_data
      });

      // Validate that we have both lawyers and parties for case_lawyers creation
      if (lawyer_ids.length === 0 || party_ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one lawyer and one party are required for case creation'
        });
      }

      const result = await transaction(async (client) => {
        // 1. Create the case
        const caseResult = await client.query(
          `INSERT INTO cases (case_number, court_id, court_name, case_type, legal_section, 
                             filing_date, status, stage, description) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
           RETURNING case_id, case_number, court_id, court_name, case_type, legal_section, 
                     filing_date, status, stage, description`,
          [caseData.case_number, caseData.court_id, caseData.court_name, caseData.case_type, 
           caseData.legal_section, caseData.filing_date, caseData.status, caseData.stage, caseData.description]
        );

        const newCase = caseResult.rows[0];
        
        // 2. Create case-lawyer relationships for each lawyer-party combination
        // Each lawyer will be associated with each party (assuming lawyers represent all parties)
        const caseLawyerPromises = [];
        for (const lawyer_id of lawyer_ids) {
          for (const party_id of party_ids) {
            caseLawyerPromises.push(
              client.query(
                'INSERT INTO case_lawyers (case_id, lawyer_id, party_id, user_id) VALUES ($1, $2, $3, $4)',
                [newCase.case_id, lawyer_id, party_id, user_id]
              )
            );
          }
        }
        
        await Promise.all(caseLawyerPromises);

        // 3. Create hearing if provided
        if (hearing_data && hearing_data.date && hearing_data.type) {
          await client.query(
            'INSERT INTO hearings (case_id, date, description, type) VALUES ($1, $2, $3, $4)',
            [newCase.case_id, hearing_data.date, hearing_data.description || '', hearing_data.type]
          );
        }

        return newCase;
      });

      res.status(201).json({
        success: true,
        message: 'Case created successfully',
        data: result
      });
    } catch (error) {
      console.error('Error in createCase:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Update case
  static async updateCase(req, res) {
    try {
      const caseId = parseInt(req.params.id);
      const updateData = req.body;
      
      if (isNaN(caseId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid case ID'
        });
      }
      
      const updatedCase = await Case.update(caseId, updateData);
      
      if (!updatedCase) {
        return res.status(404).json({
          success: false,
          message: 'Case not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Case updated successfully',
        data: updatedCase
      });
    } catch (error) {
      console.error('Error in updateCase:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Delete case (removes user's association with case, not the case itself)
  static async deleteCase(req, res) {
    try {
      const caseId = parseInt(req.params.id);
      const user_id = req.user.user_id;
      
      if (isNaN(caseId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid case ID'
        });
      }
      
      const deleted = await Case.deleteUserAssociation(caseId, user_id);
      
      if (!deleted.success) {
        return res.status(404).json({
          success: false,
          message: deleted.message
        });
      }
      
      res.json({
        success: true,
        message: deleted.message,
        data: deleted.data
      });
    } catch (error) {
      console.error('Error in deleteCase:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Advanced delete case with optional party and lawyer deletion
  static async deleteCaseAdvanced(req, res) {
    try {
      const caseId = parseInt(req.params.id);
      
      if (isNaN(caseId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid case ID'
        });
      }

      // Extract query parameters for delete options
      const deleteParties = req.query.deleteParties === 'true';
      const deleteLawyers = req.query.deleteLawyers === 'true';

      console.log(`Advanced delete case ${caseId} - Delete Parties: ${deleteParties}, Delete Lawyers: ${deleteLawyers}`);

      const deletionResult = await Case.deleteAdvanced(caseId, deleteParties, deleteLawyers);
      
      if (!deletionResult) {
        return res.status(404).json({
          success: false,
          message: 'Case not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Case and related data deleted successfully',
        data: {
          deletionSummary: deletionResult,
          options: {
            deleteParties,
            deleteLawyers
          }
        }
      });
    } catch (error) {
      console.error('Error in deleteCaseAdvanced:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Update case parties (add or remove parties from a case)
  static async updateCaseParties(req, res) {
    try {
      console.log('📞 updateCaseParties called with:', {
        caseId: req.params.id,
        body: req.body,
        userId: req.user?.user_id
      })
      
      const caseId = parseInt(req.params.id);
      const { action, party_ids, lawyer_id } = req.body;
      const user_id = req.user.user_id;

      if (isNaN(caseId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid case ID'
        });
      }

      // Validate action
      if (!['add', 'remove'].includes(action)) {
        return res.status(400).json({
          success: false,
          message: 'Action must be either "add" or "remove"'
        });
      }

      // Validate party_ids
      if (!Array.isArray(party_ids) || party_ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'party_ids must be a non-empty array'
        });
      }

      // For adding parties, lawyer_id is required
      if (action === 'add' && !lawyer_id) {
        return res.status(400).json({
          success: false,
          message: 'lawyer_id is required when adding parties'
        });
      }

      const result = await Case.updateParties(caseId, action, party_ids, lawyer_id, user_id);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message
        });
      }

      res.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } catch (error) {
      console.error('Error in updateCaseParties:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Update case lawyers (add or remove lawyers from a case)
  static async updateCaseLawyers(req, res) {
    try {
      console.log('📞 updateCaseLawyers called with:', {
        caseId: req.params.id,
        body: req.body,
        userId: req.user?.user_id
      })
      
      const caseId = parseInt(req.params.id);
      const { action, lawyer_ids, party_id } = req.body;
      const user_id = req.user.user_id;

      if (isNaN(caseId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid case ID'
        });
      }

      // Validate action
      if (!['add', 'remove'].includes(action)) {
        return res.status(400).json({
          success: false,
          message: 'Action must be either "add" or "remove"'
        });
      }

      // Validate lawyer_ids
      if (!Array.isArray(lawyer_ids) || lawyer_ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'lawyer_ids must be a non-empty array'
        });
      }

      // For adding lawyers, party_id is required
      if (action === 'add' && !party_id) {
        return res.status(400).json({
          success: false,
          message: 'party_id is required when adding lawyers'
        });
      }

      const result = await Case.updateLawyers(caseId, action, lawyer_ids, party_id, user_id);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message
        });
      }

      res.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } catch (error) {
      console.error('Error in updateCaseLawyers:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get parties and lawyers associated with a case
  static async getCaseAssociations(req, res) {
    try {
      const caseId = parseInt(req.params.id);
      const user_id = req.user.user_id;

      if (isNaN(caseId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid case ID'
        });
      }

      const associations = await Case.getAssociations(caseId, user_id);

      if (!associations.success) {
        return res.status(404).json({
          success: false,
          message: associations.message
        });
      }

      res.json({
        success: true,
        message: 'Case associations retrieved successfully',
        data: associations.data
      });
    } catch (error) {
      console.error('Error in getCaseAssociations:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get all pending case IDs for the authenticated user
  static async getUserPendingCaseIds(req, res) {
    try {
      const user_id = req.user.user_id;
      
      // Use a single efficient query to get all pending case IDs for the user
      const { query } = require('../lib/db');
      
      const result = await query(`
        SELECT DISTINCT c.case_id 
        FROM cases c
        INNER JOIN case_lawyers cl ON c.case_id = cl.case_id
        WHERE cl.user_id = $1 
        AND (c.status ILIKE '%pending%' OR c.status IS NULL)
        ORDER BY c.case_id ASC
      `, [user_id]);

      const pendingCaseIds = result.rows.map(row => row.case_id);

      res.json({
        success: true,
        message: `Found ${pendingCaseIds.length} pending cases`,
        data: {
          caseIds: pendingCaseIds,
          count: pendingCaseIds.length
        }
      });
    } catch (error) {
      console.error('Error in getUserPendingCaseIds:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Update hearings for all pending cases of the authenticated user
  static async updatePendingCasesHearings(req, res) {
    try {
      const user_id = req.user.user_id;
      
      console.log(`Starting hearing updates for pending cases for user ${user_id}`);
      
      // First, get all pending case IDs for the user
      const { query } = require('../lib/db');
      
      const result = await query(`
        SELECT DISTINCT c.case_id 
        FROM cases c
        INNER JOIN case_lawyers cl ON c.case_id = cl.case_id
        WHERE cl.user_id = $1 
        AND (c.status ILIKE '%pending%' OR c.status IS NULL)
        ORDER BY c.case_id ASC
      `, [user_id]);

      const pendingCaseIds = result.rows.map(row => row.case_id);

      if (pendingCaseIds.length === 0) {
        return res.json({
          success: true,
          message: 'No pending cases found for this user',
          data: {
            pendingCases: 0,
            results: {
              successful: [],
              failed: [],
              summary: {
                total: 0,
                updated: 0,
                failed: 0
              }
            }
          }
        });
      }

      console.log(`Found ${pendingCaseIds.length} pending cases: [${pendingCaseIds.join(', ')}]`);

      // Call the core hearing update function directly
      const CourtSearchController = require('./CourtSearchController');
      const updateResults = await CourtSearchController.updateCaseHearingsCore(pendingCaseIds, user_id);

      // Return the results
      res.json({
        success: true,
        message: `Updated hearings for ${pendingCaseIds.length} pending cases`,
        data: {
          pendingCases: pendingCaseIds.length,
          pendingCaseIds: pendingCaseIds,
          results: updateResults
        }
      });

    } catch (error) {
      console.error('Error in updatePendingCasesHearings:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

module.exports = CaseController;
