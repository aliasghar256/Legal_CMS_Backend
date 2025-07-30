const express = require('express');
const CourtController = require('../controllers/CourtController');

const router = express.Router();

// Basic CRUD routes
router.post('/', CourtController.create);
router.get('/', CourtController.getAll);
router.get('/:id', CourtController.getById);
router.put('/:id', CourtController.update);
router.delete('/:id', CourtController.delete);

// Additional routes
router.get('/meta/types', CourtController.getTypes);
router.get('/meta/locations', CourtController.getLocations);
router.get('/:id/judges', CourtController.getJudges);
router.get('/:id/cases', CourtController.getCases);

module.exports = router;
