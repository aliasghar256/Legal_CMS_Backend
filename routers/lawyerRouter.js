const express = require('express');
const LawyerController = require('../controllers/LawyerController');
const authMiddleware = require('../middleware/auth');

const lawyerRouter = express.Router();

// Protected routes - require authentication
lawyerRouter.use(authMiddleware);

// User-specific lawyer routes
lawyerRouter.get('/my-lawyers', authMiddleware,LawyerController.getUserLawyers);

// Basic CRUD operations
lawyerRouter.post('/', LawyerController.create);
lawyerRouter.get('/', LawyerController.getAll);
lawyerRouter.get('/:id', LawyerController.getById);
lawyerRouter.put('/:id', LawyerController.update);
lawyerRouter.delete('/:id', LawyerController.delete);

// Search and lookup operations
lawyerRouter.get('/search/name', LawyerController.searchByName);
lawyerRouter.get('/license/:license_no', LawyerController.findByLicense);

// Relationship queries
lawyerRouter.get('/:id/cases', LawyerController.getCases);
lawyerRouter.get('/:id/statistics', LawyerController.getStatistics);

module.exports = lawyerRouter;
