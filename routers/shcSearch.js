const express = require('express');
const router = express.Router();
const SHCSearchController = require('../controllers/SHCSearchController');
const auth = require('../middleware/auth');

// Search cases in Sindh High Court
router.post('/search', auth, SHCSearchController.searchCases);

// Get case details by ID
router.post('/case-details', auth, SHCSearchController.getCaseDetails);

// Create cases from SHC case details
router.post('/create-cases', auth, SHCSearchController.createCasesFromSHC);

// Get case categories
router.get('/categories', auth, SHCSearchController.getCaseCategories);

// Get benches
router.get('/benches', auth, SHCSearchController.getBenches);

// Get circuit codes (courts)
router.get('/circuit-codes', auth, SHCSearchController.getCircuitCodes);

// Get nature of case options
router.get('/nature-options', auth, SHCSearchController.getNatureOfCaseOptions);

// Get police stations
router.get('/police-stations', auth, SHCSearchController.getPoliceStations);

// Debug route (no auth for testing)
router.get('/debug', SHCSearchController.debugSHCResponse);

module.exports = router;