const express = require('express')
const mainRouter = require('./routers/mainRouter')
const cors = require('cors')
const { testConnection } = require('./config/database')

const app = express()

// Middleware for logging requests
app.use((req, res, next) => {
    const now = new Date();
    const formattedDate = now.toISOString().replace('T', ' ').replace(/\..+/, '');
    console.log('HTTP Method:', req.method, "URL:", req.url, "Time:", formattedDate)
    next()
})

app.use(cors())

// Body parsing middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/', mainRouter)

// Initialize database connection and start server
const PORT = process.env.PORT || 3001;

const startServer = async () => {
  try {
    // Test database connection
    await testConnection();
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

