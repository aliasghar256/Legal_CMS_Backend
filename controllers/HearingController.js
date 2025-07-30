const Hearing = require('../models/Hearing');

class HearingController {
  // Get all hearings
  static async getAllHearings(req, res) {
    try {
      const { page = 1, limit = 50, type, judge_id } = req.query;
      const offset = (page - 1) * limit;
      
      const result = await Hearing.findAll(
        parseInt(limit), 
        parseInt(offset), 
        type, 
        judge_id ? parseInt(judge_id) : null
      );
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error in getAllHearings:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get hearing by ID
  static async getHearingById(req, res) {
    try {
      const hearingId = parseInt(req.params.id);
      
      if (isNaN(hearingId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid hearing ID'
        });
      }
      
      const hearingData = await Hearing.findById(hearingId);
      
      if (!hearingData) {
        return res.status(404).json({
          success: false,
          message: 'Hearing not found'
        });
      }
      
      res.json({
        success: true,
        data: hearingData
      });
    } catch (error) {
      console.error('Error in getHearingById:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Create new hearing
  static async createHearing(req, res) {
    try {
      const hearingData = req.body;
      
      const newHearing = await Hearing.create(hearingData);
      
      res.status(201).json({
        success: true,
        message: 'Hearing created successfully',
        data: newHearing
      });
    } catch (error) {
      console.error('Error in createHearing:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Update hearing
  static async updateHearing(req, res) {
    try {
      const hearingId = parseInt(req.params.id);
      const updateData = req.body;
      
      if (isNaN(hearingId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid hearing ID'
        });
      }
      
      const updatedHearing = await Hearing.update(hearingId, updateData);
      
      if (!updatedHearing) {
        return res.status(404).json({
          success: false,
          message: 'Hearing not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Hearing updated successfully',
        data: updatedHearing
      });
    } catch (error) {
      console.error('Error in updateHearing:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Delete hearing
  static async deleteHearing(req, res) {
    try {
      const hearingId = parseInt(req.params.id);
      
      if (isNaN(hearingId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid hearing ID'
        });
      }
      
      const deleted = await Hearing.delete(hearingId);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Hearing not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Hearing deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteHearing:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

module.exports = HearingController;
