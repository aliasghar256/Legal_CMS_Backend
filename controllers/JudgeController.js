const Judge = require('../models/Judge');

class JudgeController {
  /**
   * Create a new judge
   */
  static async create(req, res) {
    try {
      const { name, designation, court_id } = req.body;

      // Validate required fields
      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Judge name is required'
        });
      }

      const judge = await Judge.create({ name, designation, court_id });

      res.status(201).json({
        success: true,
        message: 'Judge created successfully',
        data: { judge }
      });
    } catch (error) {
      console.error('Error creating judge:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create judge',
        error: error.message
      });
    }
  }

  /**
   * Get all judges with pagination and filtering
   */
  static async getAll(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;
      const { designation, court_id, with_courts } = req.query;

      let result;
      if (with_courts === 'true') {
        result = await Judge.findAllWithCourts(limit, offset);
      } else {
        result = await Judge.findAll(limit, offset, designation, court_id ? parseInt(court_id) : null);
      }

      res.status(200).json({
        success: true,
        message: 'Judges retrieved successfully',
        data: result
      });
    } catch (error) {
      console.error('Error fetching judges:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch judges',
        error: error.message
      });
    }
  }

  /**
   * Get judge by ID
   */
  static async getById(req, res) {
    try {
      const { id } = req.params;
      const { with_court } = req.query;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid judge ID'
        });
      }

      let judge;
      if (with_court === 'true') {
        judge = await Judge.findByIdWithCourt(parseInt(id));
      } else {
        judge = await Judge.findById(parseInt(id));
      }

      if (!judge) {
        return res.status(404).json({
          success: false,
          message: 'Judge not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Judge retrieved successfully',
        data: { judge }
      });
    } catch (error) {
      console.error('Error fetching judge:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch judge',
        error: error.message
      });
    }
  }

  /**
   * Update judge
   */
  static async update(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid judge ID'
        });
      }

      // Check if judge exists
      const existingJudge = await Judge.findById(parseInt(id));
      if (!existingJudge) {
        return res.status(404).json({
          success: false,
          message: 'Judge not found'
        });
      }

      const updatedJudge = await Judge.update(parseInt(id), updates);

      res.status(200).json({
        success: true,
        message: 'Judge updated successfully',
        data: { judge: updatedJudge }
      });
    } catch (error) {
      console.error('Error updating judge:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update judge',
        error: error.message
      });
    }
  }

  /**
   * Delete judge
   */
  static async delete(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid judge ID'
        });
      }

      const deleted = await Judge.delete(parseInt(id));

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Judge not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Judge deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting judge:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete judge',
        error: error.message
      });
    }
  }

  /**
   * Get judge designations
   */
  static async getDesignations(req, res) {
    try {
      const designations = await Judge.getAllDesignations();

      res.status(200).json({
        success: true,
        message: 'Judge designations retrieved successfully',
        data: { designations }
      });
    } catch (error) {
      console.error('Error fetching judge designations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch judge designations',
        error: error.message
      });
    }
  }

  /**
   * Get hearings for a judge
   */
  static async getHearings(req, res) {
    try {
      const { id } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid judge ID'
        });
      }

      const result = await Judge.getHearings(parseInt(id), limit, offset);

      res.status(200).json({
        success: true,
        message: 'Judge hearings retrieved successfully',
        data: result
      });
    } catch (error) {
      console.error('Error fetching judge hearings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch judge hearings',
        error: error.message
      });
    }
  }

  /**
   * Get upcoming hearings for a judge
   */
  static async getUpcomingHearings(req, res) {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit) || 10;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid judge ID'
        });
      }

      const hearings = await Judge.getUpcomingHearings(parseInt(id), limit);

      res.status(200).json({
        success: true,
        message: 'Upcoming hearings retrieved successfully',
        data: { hearings }
      });
    } catch (error) {
      console.error('Error fetching upcoming hearings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch upcoming hearings',
        error: error.message
      });
    }
  }

  /**
   * Get judge statistics
   */
  static async getStatistics(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid judge ID'
        });
      }

      const statistics = await Judge.getStatistics(parseInt(id));

      res.status(200).json({
        success: true,
        message: 'Judge statistics retrieved successfully',
        data: { statistics }
      });
    } catch (error) {
      console.error('Error fetching judge statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch judge statistics',
        error: error.message
      });
    }
  }
}

module.exports = JudgeController;
