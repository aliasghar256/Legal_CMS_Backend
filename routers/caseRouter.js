const express = require('express');
const CaseController = require('../controllers/CaseController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get all cases for authenticated user (requires authentication)
router.get('/my-cases', authMiddleware, CaseController.getUserCases);

// Get all cases
router.get('/', CaseController.getAllCases);

// Get case by ID
router.get('/:id', CaseController.getCaseById);

// Create new case
router.post('/', authMiddleware,CaseController.createCase);

// Update case
router.put('/:id', CaseController.updateCase);

// Delete case
router.delete('/:id', CaseController.deleteCase);

module.exports = router;
