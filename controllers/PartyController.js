const Party = require('../models/Party');
const UserParty = require('../models/UserParty');
const CaseLawyer = require('../models/CaseLawyer');

class PartyController {
  /**
   * Create a new party and associate with user
   */
  static async create(req, res) {
    try {
      const { name, cnic, role, contact_info } = req.body;
      const user_id = req.user.user_id;

      // Validate required fields
      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Party name is required'
        });
      }

      // Check if CNIC already exists (if provided)
      if (cnic) {
        const cnicExists = await Party.cnicExists(cnic);
        if (cnicExists) {
          return res.status(400).json({
            success: false,
            message: 'CNIC already exists'
          });
        }
      }

      const party = await Party.create({ name, cnic, role, contact_info });

      // Create user-party relationship
      await UserParty.create({ user_id, party_id: party.party_id });

      res.status(201).json({
        success: true,
        message: 'Party created successfully',
        data: { party }
      });
    } catch (error) {
      console.error('Error creating party:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create party',
        error: error.message
      });
    }
  }

  /**
   * Get all parties for the authenticated user
   */
  static async getUserParties(req, res) {
    try {
      const user_id = req.user.user_id;
      
      const parties = await UserParty.getPartiesByUser(user_id);

      res.status(200).json({
        success: true,
        message: 'User parties retrieved successfully',
        data: { parties }
      });
    } catch (error) {
      console.error('Error fetching user parties:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user parties',
        error: error.message
      });
    }
  }

  /**
   * Get all parties with pagination and filtering
   */
  static async getAll(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;
      const { role } = req.query;

      const result = await Party.findAll(limit, offset, role);

      res.status(200).json({
        success: true,
        message: 'Parties retrieved successfully',
        data: result
      });
    } catch (error) {
      console.error('Error fetching parties:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch parties',
        error: error.message
      });
    }
  }

  /**
   * Get party by ID
   */
  static async getById(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid party ID'
        });
      }

      const party = await Party.findById(parseInt(id));

      if (!party) {
        return res.status(404).json({
          success: false,
          message: 'Party not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Party retrieved successfully',
        data: { party }
      });
    } catch (error) {
      console.error('Error fetching party:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch party',
        error: error.message
      });
    }
  }

  /**
   * Update party
   */
  static async update(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid party ID'
        });
      }

      // Check if party exists
      const existingParty = await Party.findById(parseInt(id));
      if (!existingParty) {
        return res.status(404).json({
          success: false,
          message: 'Party not found'
        });
      }

      // Check if new CNIC already exists (if CNIC is being updated)
      if (updates.cnic && updates.cnic !== existingParty.cnic) {
        const cnicExists = await Party.cnicExists(updates.cnic, parseInt(id));
        if (cnicExists) {
          return res.status(400).json({
            success: false,
            message: 'CNIC already exists'
          });
        }
      }

      const updatedParty = await Party.update(parseInt(id), updates);

      res.status(200).json({
        success: true,
        message: 'Party updated successfully',
        data: { party: updatedParty }
      });
    } catch (error) {
      console.error('Error updating party:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update party',
        error: error.message
      });
    }
  }

  /**
   * Delete party
   */
  static async delete(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid party ID'
        });
      }

      const deleted = await Party.delete(parseInt(id));

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Party not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Party deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting party:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete party',
        error: error.message
      });
    }
  }

  /**
   * Get party roles
   */
  static async getRoles(req, res) {
    try {
      const roles = await Party.getAllRoles();

      res.status(200).json({
        success: true,
        message: 'Party roles retrieved successfully',
        data: { roles }
      });
    } catch (error) {
      console.error('Error fetching party roles:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch party roles',
        error: error.message
      });
    }
  }

  /**
   * Search parties by name
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

      const parties = await Party.findByName(name);

      res.status(200).json({
        success: true,
        message: 'Parties search completed',
        data: { parties }
      });
    } catch (error) {
      console.error('Error searching parties:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search parties',
        error: error.message
      });
    }
  }

  /**
   * Find party by CNIC
   */
  static async findByCnic(req, res) {
    try {
      const { cnic } = req.params;

      if (!cnic) {
        return res.status(400).json({
          success: false,
          message: 'CNIC is required'
        });
      }

      const party = await Party.findByCnic(cnic);

      if (!party) {
        return res.status(404).json({
          success: false,
          message: 'Party not found with this CNIC'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Party found by CNIC',
        data: { party }
      });
    } catch (error) {
      console.error('Error finding party by CNIC:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to find party by CNIC',
        error: error.message
      });
    }
  }

  /**
   * Get parties by case ID
   */
  static async getByCaseId(req, res) {
    try {
      const { case_id } = req.params;

      if (!case_id || isNaN(parseInt(case_id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid case ID'
        });
      }

      const parties = await Party.findByCaseId(parseInt(case_id));

      res.status(200).json({
        success: true,
        message: 'Case parties retrieved successfully',
        data: { parties }
      });
    } catch (error) {
      console.error('Error fetching case parties:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch case parties',
        error: error.message
      });
    }
  }

  /**
   * Get all cases for a specific party
   */
  static async getCases(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.user_id;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid party ID'
        });
      }

      const party_id = parseInt(id);

      // Check if user has access to this party
      const hasAccess = await UserParty.checkUserAccess(user_id, party_id);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You do not have permission to view this party\'s cases.'
        });
      }

      // Get cases for this party
      const cases = await CaseLawyer.getCasesByParty(party_id);

      res.status(200).json({
        success: true,
        message: 'Party cases retrieved successfully',
        data: { cases }
      });
    } catch (error) {
      console.error('Error fetching party cases:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch party cases',
        error: error.message
      });
    }
  }
}

module.exports = PartyController;
