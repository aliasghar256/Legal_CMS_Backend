const express = require('express');
const PartyController = require('../controllers/PartyController');

const router = express.Router();

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

module.exports = router;
