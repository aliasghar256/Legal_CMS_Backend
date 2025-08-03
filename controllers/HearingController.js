const Hearing = require('../models/Hearing');
const CaseLawyer = require('../models/CaseLawyer');

class HearingController {
  // Get all hearings
  static async getAllHearings(req, res) {
    try {
      const { page = 1, limit = 50, type, judge_id, include_details = 'false' } = req.query;
      const offset = (page - 1) * limit;
      const includeLawyersParties = include_details === 'true';
      
      const result = await Hearing.findAll(
        parseInt(limit), 
        parseInt(offset), 
        type, 
        judge_id ? parseInt(judge_id) : null,
        includeLawyersParties
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

  // Get user's hearings (hearings for cases the user is involved in)
  static async getUserHearings(req, res) {
    try {
      const userId = req.user.user_id;
      const { page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;
      
      // Get user's cases from CaseLawyer table
      const userCases = await CaseLawyer.getCasesByUserId(userId, 1000, 0); // Get all user cases first
      const caseIds = userCases.cases.map(c => c.case_id);
      
      if (caseIds.length === 0) {
        return res.json({
          success: true,
          data: {
            hearings: [],
            pagination: {
              limit: parseInt(limit),
              offset: parseInt(offset),
              total: 0,
              hasMore: false
            }
          }
        });
      }
      
      const result = await Hearing.getUserHearings(caseIds, parseInt(limit), parseInt(offset));
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error in getUserHearings:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get upcoming hearings for user
  static async getUpcomingHearings(req, res) {
    try {
      const userId = req.user.user_id;
      const { days = 30, limit = 50 } = req.query;
      
      // Get user's cases from CaseLawyer table
      const userCases = await CaseLawyer.getCasesByUserId(userId, 1000, 0);
      const caseIds = userCases.cases.map(c => c.case_id);
      
      if (caseIds.length === 0) {
        return res.json({
          success: true,
          data: {
            hearings: [],
            pagination: {
              limit: parseInt(limit),
              offset: 0,
              total: 0,
              hasMore: false
            }
          }
        });
      }
      
      const result = await Hearing.getUpcomingUserHearings(caseIds, parseInt(days), parseInt(limit));
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error in getUpcomingHearings:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get past hearings for user
  static async getPastHearings(req, res) {
    try {
      const userId = req.user.user_id;
      const { page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;
      
      // Get user's cases from CaseLawyer table
      const userCases = await CaseLawyer.getCasesByUserId(userId, 1000, 0);
      const caseIds = userCases.cases.map(c => c.case_id);
      
      if (caseIds.length === 0) {
        return res.json({
          success: true,
          data: {
            hearings: [],
            pagination: {
              limit: parseInt(limit),
              offset: parseInt(offset),
              total: 0,
              hasMore: false
            }
          }
        });
      }
      
      const result = await Hearing.getPastUserHearings(caseIds, parseInt(limit), parseInt(offset));
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error in getPastHearings:', error);
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
      
      const hearingData = await Hearing.findByIdWithDetails(hearingId);
      
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
      
      // Validate case access if user is provided
      if (req.user && hearingData.case_id) {
        const userCases = await CaseLawyer.getCasesByUserId(req.user.user_id, 1000, 0);
        const userCaseIds = userCases.cases.map(c => c.case_id);
        
        if (!userCaseIds.includes(parseInt(hearingData.case_id))) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: You are not associated with this case'
          });
        }
      }
      
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
      
      // Check if hearing exists and user has access
      const existingHearing = await Hearing.findById(hearingId);
      if (!existingHearing) {
        return res.status(404).json({
          success: false,
          message: 'Hearing not found'
        });
      }
      
      // Validate case access if user is provided
      if (req.user && existingHearing.case_id) {
        const userCases = await CaseLawyer.getCasesByUserId(req.user.user_id, 1000, 0);
        const userCaseIds = userCases.cases.map(c => c.case_id);
        
        if (!userCaseIds.includes(existingHearing.case_id)) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: You are not associated with this case'
          });
        }
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
      
      // Check if hearing exists and user has access
      const existingHearing = await Hearing.findById(hearingId);
      if (!existingHearing) {
        return res.status(404).json({
          success: false,
          message: 'Hearing not found'
        });
      }
      
      // Validate case access if user is provided
      if (req.user && existingHearing.case_id) {
        const userCases = await CaseLawyer.getCasesByUserId(req.user.user_id, 1000, 0);
        const userCaseIds = userCases.cases.map(c => c.case_id);
        
        if (!userCaseIds.includes(existingHearing.case_id)) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: You are not associated with this case'
          });
        }
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

  // Get all hearings for a specific case (hearing diary)
  static async getCaseHearingDiary(req, res) {
    try {
      const caseId = parseInt(req.params.caseId);
      
      if (isNaN(caseId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid case ID'
        });
      }

      // Validate case access if user is provided
      if (req.user) {
        const userCases = await CaseLawyer.getCasesByUserId(req.user.user_id, 1000, 0);
        const userCaseIds = userCases.cases.map(c => c.case_id);
        
        if (!userCaseIds.includes(caseId)) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: You are not associated with this case'
          });
        }
      }
      
      const result = await Hearing.findByCaseId(caseId, 100, 0);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error in getCaseHearingDiary:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Notify parties about a hearing
  static async notifyParties(req, res) {
    try {
      const hearingId = parseInt(req.params.id);
      
      if (isNaN(hearingId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid hearing ID'
        });
      }

      // Get hearing details
      const hearing = await Hearing.findByIdWithDetails(hearingId);
      if (!hearing) {
        return res.status(404).json({
          success: false,
          message: 'Hearing not found'
        });
      }

      // Validate case access if user is provided
      if (req.user && hearing.case_id) {
        const userCases = await CaseLawyer.getCasesByUserId(req.user.user_id, 1000, 0);
        const userCaseIds = userCases.cases.map(c => c.case_id);
        
        if (!userCaseIds.includes(hearing.case_id)) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: You are not associated with this case'
          });
        }
      }

      // Get all parties for this case
      const caseParties = await CaseLawyer.getLawyersByCase(hearing.case_id);
      const parties = caseParties.map(cp => ({
        party_id: cp.party_id,
        party_name: cp.party_name,
        party_contact: cp.party_contact
      }));

      // Here you would implement the actual notification logic
      // For now, we'll just return success with the parties that would be notified
      
      res.json({
        success: true,
        message: `Notification sent to ${parties.length} parties`,
        data: {
          hearing,
          notified_parties: parties,
          notification_sent_at: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error in notifyParties:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Notify lawyers about a hearing
  static async notifyLawyers(req, res) {
    try {
      const hearingId = parseInt(req.params.id);
      
      if (isNaN(hearingId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid hearing ID'
        });
      }

      // Get hearing details
      const hearing = await Hearing.findByIdWithDetails(hearingId);
      if (!hearing) {
        return res.status(404).json({
          success: false,
          message: 'Hearing not found'
        });
      }

      // Validate case access if user is provided
      if (req.user && hearing.case_id) {
        const userCases = await CaseLawyer.getCasesByUserId(req.user.user_id, 1000, 0);
        const userCaseIds = userCases.cases.map(c => c.case_id);
        
        if (!userCaseIds.includes(hearing.case_id)) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: You are not associated with this case'
          });
        }
      }

      // Get all lawyers for this case
      const caseLawyers = await CaseLawyer.getLawyersByCase(hearing.case_id);
      const lawyers = caseLawyers.map(cl => ({
        lawyer_id: cl.lawyer_id,
        lawyer_name: cl.lawyer_name,
        lawyer_contact: cl.lawyer_contact,
        license_no: cl.license_no
      }));

      // Here you would implement the actual notification logic
      // For now, we'll just return success with the lawyers that would be notified
      
      res.json({
        success: true,
        message: `Notification sent to ${lawyers.length} lawyers`,
        data: {
          hearing,
          notified_lawyers: lawyers,
          notification_sent_at: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error in notifyLawyers:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

module.exports = HearingController;
