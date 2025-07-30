const express = require('express');
const HearingController = require('../controllers/HearingController');

const router = express.Router();

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
