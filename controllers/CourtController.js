const Court = require('../models/Court');

class CourtController {
  /**
   * Create a new court
   */
  static async create(req, res) {
    try {
      const { name, type, location } = req.body;

      // Validate required fields
      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Court name is required'
        });
      }

      // Check if court name already exists
      const nameExists = await Court.nameExists(name);
      if (nameExists) {
        return res.status(400).json({
          success: false,
          message: 'Court name already exists'
        });
      }

      const court = await Court.create({ name, type, location });

      res.status(201).json({
        success: true,
        message: 'Court created successfully',
        data: { court }
      });
    } catch (error) {
      console.error('Error creating court:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create court',
        error: error.message
      });
    }
  }

  /**
   * Get all courts with pagination and filtering
   */
  static async getAll(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;
      const { type, location } = req.query;

      const result = await Court.findAll(limit, offset, type, location);

      res.status(200).json({
        success: true,
        message: 'Courts retrieved successfully',
        data: result
      });
    } catch (error) {
      console.error('Error fetching courts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch courts',
        error: error.message
      });
    }
  }

  /**
   * Get court by ID
   */
  static async getById(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid court ID'
        });
      }

      const court = await Court.findById(parseInt(id));

      if (!court) {
        return res.status(404).json({
          success: false,
          message: 'Court not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Court retrieved successfully',
        data: { court }
      });
    } catch (error) {
      console.error('Error fetching court:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch court',
        error: error.message
      });
    }
  }

  /**
   * Update court
   */
  static async update(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid court ID'
        });
      }

      // Check if court exists
      const existingCourt = await Court.findById(parseInt(id));
      if (!existingCourt) {
        return res.status(404).json({
          success: false,
          message: 'Court not found'
        });
      }

      // Check if new name already exists (if name is being updated)
      if (updates.name && updates.name !== existingCourt.name) {
        const nameExists = await Court.nameExists(updates.name, parseInt(id));
        if (nameExists) {
          return res.status(400).json({
            success: false,
            message: 'Court name already exists'
          });
        }
      }

      const updatedCourt = await Court.update(parseInt(id), updates);

      res.status(200).json({
        success: true,
        message: 'Court updated successfully',
        data: { court: updatedCourt }
      });
    } catch (error) {
      console.error('Error updating court:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update court',
        error: error.message
      });
    }
  }

  /**
   * Delete court
   */
  static async delete(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid court ID'
        });
      }

      const deleted = await Court.delete(parseInt(id));

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Court not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Court deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting court:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete court',
        error: error.message
      });
    }
  }

  /**
   * Get court types
   */
  static async getTypes(req, res) {
    try {
      const types = await Court.getAllTypes();

      res.status(200).json({
        success: true,
        message: 'Court types retrieved successfully',
        data: { types }
      });
    } catch (error) {
      console.error('Error fetching court types:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch court types',
        error: error.message
      });
    }
  }

  /**
   * Get court locations
   */
  static async getLocations(req, res) {
    try {
      const locations = await Court.getAllLocations();

      res.status(200).json({
        success: true,
        message: 'Court locations retrieved successfully',
        data: { locations }
      });
    } catch (error) {
      console.error('Error fetching court locations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch court locations',
        error: error.message
      });
    }
  }

  /**
   * Get judges for a court
   */
  static async getJudges(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid court ID'
        });
      }

      const judges = await Court.getJudges(parseInt(id));

      res.status(200).json({
        success: true,
        message: 'Court judges retrieved successfully',
        data: { judges }
      });
    } catch (error) {
      console.error('Error fetching court judges:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch court judges',
        error: error.message
      });
    }
  }

  /**
   * Get cases for a court
   */
  static async getCases(req, res) {
    try {
      const { id } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid court ID'
        });
      }

      const result = await Court.getCases(parseInt(id), limit, offset);

      res.status(200).json({
        success: true,
        message: 'Court cases retrieved successfully',
        data: result
      });
    } catch (error) {
      console.error('Error fetching court cases:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch court cases',
        error: error.message
      });
    }
  }
}

module.exports = CourtController;
