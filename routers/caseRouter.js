const express = require('express');
const CaseController = require('../controllers/CaseController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get all cases for authenticated user (requires authentication)
router.get('/my-cases', authMiddleware, CaseController.getUserCases);

// Get pending case IDs for authenticated user
router.get('/pending-ids', authMiddleware, CaseController.getUserPendingCaseIds);

// Update hearings for all pending cases of authenticated user
router.put('/pending/update-hearings', authMiddleware, CaseController.updatePendingCasesHearings);

// Get all cases
router.get('/', CaseController.getAllCases);

// Get case by ID with full details
router.get('/:id/details', CaseController.getCaseByIdWithDetails);

// Get case by ID
router.get('/:id', CaseController.getCaseById);

// Create new case
router.post('/', authMiddleware,CaseController.createCase);

// Update case
router.put('/:id', CaseController.updateCase);

// Update case parties (add/remove parties from a case)
router.put('/:id/parties', authMiddleware, CaseController.updateCaseParties);

// Update case lawyers (add/remove lawyers from a case)  
router.put('/:id/lawyers', authMiddleware, CaseController.updateCaseLawyers);

// Get case associations (parties and lawyers)
router.get('/:id/associations', authMiddleware, CaseController.getCaseAssociations);

// Delete case (basic deletion)
router.delete('/:id', authMiddleware, CaseController.deleteCase);

// Advanced delete case with optional party and lawyer deletion
router.delete('/:id/advanced', CaseController.deleteCaseAdvanced);

module.exports = router;
