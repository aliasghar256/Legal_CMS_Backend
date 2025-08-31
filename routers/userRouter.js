const express = require('express');
const UserController = require('../controllers/UserController');
const authMiddleware = require('../middleware/auth');

const userRouter = express.Router();

// Public routes (no authentication required)
userRouter.post('/signup', UserController.signup);
userRouter.post('/login', UserController.login);

// Protected routes (require authentication)
userRouter.get('/profile', authMiddleware, UserController.getProfile);

module.exports = userRouter;
