const express = require('express');
const PartyController = require('../controllers/PartyController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Protected routes - require authentication
router.use(authMiddleware);

// User-specific party routes
router.get('/my-parties', authMiddleware,PartyController.getUserParties);

// Basic CRUD routes
router.post('/', PartyController.create);
router.get('/', PartyController.getAll);
router.get('/:id', PartyController.getById);
router.put('/:id', PartyController.update);
router.delete('/:id', PartyController.delete);

// Additional routes
router.get('/meta/roles', PartyController.getRoles);
router.get('/search/name', PartyController.searchByName);
router.get('/cnic/:cnic', PartyController.findByCnic);
router.get('/case/:case_id', PartyController.getByCaseId);

// Relationship queries
router.get('/:id/cases', PartyController.getCases);

module.exports = router;
