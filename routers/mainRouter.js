const express = require('express')
const lawyerRouter = require('./lawyerRouter')

mainRouter = express.Router()

// Health check
mainRouter.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Legal CMS Backend API is running',
    timestamp: new Date().toISOString()
  });
});

// Lawyer routes
mainRouter.use('/lawyers', lawyerRouter);

module.exports = mainRouter