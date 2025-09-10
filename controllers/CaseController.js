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
}

module.exports = CaseController;
