const express = require('express');
const JudgeController = require('../controllers/JudgeController');

const router = express.Router();

// Basic CRUD routes
router.post('/', JudgeController.create);
router.get('/', JudgeController.getAll);
router.get('/:id', JudgeController.getById);
router.put('/:id', JudgeController.update);
router.delete('/:id', JudgeController.delete);

// Additional routes
router.get('/meta/designations', JudgeController.getDesignations);
router.get('/:id/hearings', JudgeController.getHearings);
router.get('/:id/hearings/upcoming', JudgeController.getUpcomingHearings);
router.get('/:id/statistics', JudgeController.getStatistics);

module.exports = router;
