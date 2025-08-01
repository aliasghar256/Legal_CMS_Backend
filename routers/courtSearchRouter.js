const express = require('express');
const CourtSearchController = require('../controllers/CourtSearchController');

const courtSearchRouter = express.Router();

// Search cases in Sindh District Courts
courtSearchRouter.post('/search', CourtSearchController.searchCases);

// Get case profile details
courtSearchRouter.post('/profile', CourtSearchController.getCaseProfile);

// Get districts list
courtSearchRouter.get('/districts', CourtSearchController.getDistricts);

// Get court types list
courtSearchRouter.get('/court-types', CourtSearchController.getCourtTypes);

module.exports = courtSearchRouter;
