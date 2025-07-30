const Case = require('../models/Case');

class CaseController {
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

  // Create new case
  static async createCase(req, res) {
    try {
      const caseData = req.body;
      
      const newCase = await Case.create(caseData);
      
      res.status(201).json({
        success: true,
        message: 'Case created successfully',
        data: newCase
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
