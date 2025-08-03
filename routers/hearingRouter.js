const express = require('express');
const HearingController = require('../controllers/HearingController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Protected routes - require authentication
router.use(authMiddleware);

// User-specific hearing routes
router.get('/my-hearings', HearingController.getUserHearings);
router.get('/upcoming', HearingController.getUpcomingHearings);
router.get('/past', HearingController.getPastHearings);

// Case-specific hearing routes
router.get('/case/:caseId', HearingController.getCaseHearingDiary);

// Notification routes
router.post('/:id/notify-parties', HearingController.notifyParties);
router.post('/:id/notify-lawyers', HearingController.notifyLawyers);

// Get all hearings
router.get('/', HearingController.getAllHearings);

// Get hearing by ID
router.get('/:id', HearingController.getHearingById);

// Create new hearing
router.post('/', HearingController.createHearing);

// Update hearing
router.put('/:id', HearingController.updateHearing);

// Delete hearing
router.delete('/:id', HearingController.deleteHearing);

module.exports = router;
