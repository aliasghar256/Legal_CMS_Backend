const express = require('express')
const lawyerRouter = require('./lawyerRouter')
const caseRouter = require('./caseRouter')
const hearingRouter = require('./hearingRouter')
const documentRouter = require('./documentRouter')
const courtRouter = require('./courtRouter')
const judgeRouter = require('./judgeRouter')
const partyRouter = require('./partyRouter')
const userRouter = require('./userRouter')
const courtSearchRouter = require('./courtSearchRouter')
const reminderRouter = require('./reminderRouter')

mainRouter = express.Router()

// Health check
mainRouter.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Legal CMS Backend API is running',
    timestamp: new Date().toISOString()
  });
});

// Routes
mainRouter.use('/lawyers', lawyerRouter);
mainRouter.use('/cases', caseRouter);
mainRouter.use('/hearings', hearingRouter);
mainRouter.use('/documents', documentRouter);
mainRouter.use('/courts', courtRouter);
mainRouter.use('/judges', judgeRouter);
mainRouter.use('/parties', partyRouter);
mainRouter.use('/users', userRouter);
mainRouter.use('/court-search', courtSearchRouter);
mainRouter.use('/reminders', reminderRouter);

module.exports = mainRouter