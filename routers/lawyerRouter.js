const express = require('express');
const LawyerController = require('../controllers/LawyerController');
const authMiddleware = require('../middleware/auth');

const lawyerRouter = express.Router();

// Public routes (no authentication required)
lawyerRouter.post('/signup', LawyerController.signup);
lawyerRouter.post('/login', LawyerController.login);

module.exports = lawyerRouter;
