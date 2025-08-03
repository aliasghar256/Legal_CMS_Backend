const Lawyer = require('../models/Lawyer');
const UserLawyer = require('../models/UserLawyer');
const CaseLawyer = require('../models/CaseLawyer');

class LawyerController {
  /**
   * Create a new lawyer and associate with user
   */
  static async create(req, res) {
    try {
      const { name, license_no, contact_info } = req.body;
      const user_id = req.user.user_id;

      // Validate required fields
      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Lawyer name is required'
        });
      }

      // Check if license number already exists (if provided)
      if (license_no) {
        const licenseExists = await Lawyer.licenseExists(license_no);
        if (licenseExists) {
          return res.status(400).json({
            success: false,
            message: 'License number already exists'
          });
        }
      }

      const lawyer = await Lawyer.create({ name, license_no, contact_info });

      // Create user-lawyer relationship
      await UserLawyer.create({ user_id, lawyer_id: lawyer.lawyer_id });

      res.status(201).json({
        success: true,
        message: 'Lawyer created successfully',
        data: { lawyer }
      });
    } catch (error) {
      console.error('Error creating lawyer:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create lawyer',
        error: error.message
      });
    }
  }

  /**
   * Get all lawyers for the authenticated user
   */
  static async getUserLawyers(req, res) {
    try {
      const user_id = req.user.user_id;
      
      const lawyers = await UserLawyer.getLawyersByUser(user_id);

      res.status(200).json({
        success: true,
        message: 'User lawyers retrieved successfully',
        data: { lawyers }
      });
    } catch (error) {
      console.error('Error fetching user lawyers:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user lawyers',
        error: error.message
      });
    }
  }

  /**
   * Get all lawyers with pagination
   */
  static async getAll(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      const result = await Lawyer.findAll(limit, offset);

      res.status(200).json({
        success: true,
        message: 'Lawyers retrieved successfully',
        data: result
      });
    } catch (error) {
      console.error('Error fetching lawyers:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch lawyers',
        error: error.message
      });
    }
  }

  /**
   * Get lawyer by ID
   */
  static async getById(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid lawyer ID'
        });
      }

      const lawyer = await Lawyer.findById(parseInt(id));

      if (!lawyer) {
        return res.status(404).json({
          success: false,
          message: 'Lawyer not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Lawyer retrieved successfully',
        data: { lawyer }
      });
    } catch (error) {
      console.error('Error fetching lawyer:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch lawyer',
        error: error.message
      });
    }
  }

  /**
   * Update lawyer
   */
  static async update(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid lawyer ID'
        });
      }

      // Check if lawyer exists
      const existingLawyer = await Lawyer.findById(parseInt(id));
      if (!existingLawyer) {
        return res.status(404).json({
          success: false,
          message: 'Lawyer not found'
        });
      }

      // Check if new license number already exists (if license is being updated)
      if (updates.license_no && updates.license_no !== existingLawyer.license_no) {
        const licenseExists = await Lawyer.licenseExists(updates.license_no, parseInt(id));
        if (licenseExists) {
          return res.status(400).json({
            success: false,
            message: 'License number already exists'
          });
        }
      }

      const updatedLawyer = await Lawyer.update(parseInt(id), updates);

      res.status(200).json({
        success: true,
        message: 'Lawyer updated successfully',
        data: { lawyer: updatedLawyer }
      });
    } catch (error) {
      console.error('Error updating lawyer:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update lawyer',
        error: error.message
      });
    }
  }

  /**
   * Delete lawyer
   */
  static async delete(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid lawyer ID'
        });
      }

      const deleted = await Lawyer.delete(parseInt(id));

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Lawyer not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Lawyer deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting lawyer:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete lawyer',
        error: error.message
      });
    }
  }

  /**
   * Search lawyers by name
   */
  static async searchByName(req, res) {
    try {
      const { name } = req.query;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Search name is required'
        });
      }

      const lawyers = await Lawyer.findByName(name);

      res.status(200).json({
        success: true,
        message: 'Lawyers search completed',
        data: { lawyers }
      });
    } catch (error) {
      console.error('Error searching lawyers:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search lawyers',
        error: error.message
      });
    }
  }

  /**
   * Find lawyer by license number
   */
  static async findByLicense(req, res) {
    try {
      const { license_no } = req.params;

      if (!license_no) {
        return res.status(400).json({
          success: false,
          message: 'License number is required'
        });
      }

      const lawyer = await Lawyer.findByLicenseNo(license_no);

      if (!lawyer) {
        return res.status(404).json({
          success: false,
          message: 'Lawyer not found with this license number'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Lawyer found by license number',
        data: { lawyer }
      });
    } catch (error) {
      console.error('Error finding lawyer by license:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to find lawyer by license',
        error: error.message
      });
    }
  }

  /**
   * Get cases for a lawyer
   */
  static async getCases(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.user_id;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid lawyer ID'
        });
      }

      const lawyer_id = parseInt(id);

      // Check if user has access to this lawyer
      const hasAccess = await UserLawyer.checkUserAccess(user_id, lawyer_id);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You do not have permission to view this lawyer\'s cases.'
        });
      }

      // Get cases for this lawyer
      const cases = await CaseLawyer.getCasesByLawyer(lawyer_id);

      res.status(200).json({
        success: true,
        message: 'Lawyer cases retrieved successfully',
        data: { cases }
      });
    } catch (error) {
      console.error('Error fetching lawyer cases:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch lawyer cases',
        error: error.message
      });
    }
  }

  /**
   * Get lawyer statistics
   */
  static async getStatistics(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid lawyer ID'
        });
      }

      const statistics = await Lawyer.getStatistics(parseInt(id));

      res.status(200).json({
        success: true,
        message: 'Lawyer statistics retrieved successfully',
        data: { statistics }
      });
    } catch (error) {
      console.error('Error fetching lawyer statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch lawyer statistics',
        error: error.message
      });
    }
  }
}

module.exports = LawyerController;
