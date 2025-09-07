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

  // Delete case
  static async deleteCase(req, res) {
    try {
      const caseId = parseInt(req.params.id);
      
      if (isNaN(caseId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid case ID'
        });
      }
      
      const deleted = await Case.delete(caseId);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Case not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Case deleted successfully'
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
}

module.exports = CaseController;
