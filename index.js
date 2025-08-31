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

// Configure CORS for production
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://localhost:3000',
    /^https:\/\/.*\.vercel\.app$/,
    /^https:\/\/.*\.netlify\.app$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}

app.use(cors(corsOptions))

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Health check route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Legal CMS Backend API is running on Vercel',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
});

// API routes
app.use('/api', mainRouter)

// Initialize database connection for serverless
let isDbConnected = false;

const ensureDbConnection = async () => {
  if (!isDbConnected) {
    try {
      await testConnection();
      isDbConnected = true;
      console.log('✅ Database connected successfully');
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      throw error;
    }
  }
};

// Middleware to ensure DB connection on every request
app.use(async (req, res, next) => {
  try {
    await ensureDbConnection();
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database connection error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

// Export for Vercel
module.exports = app;

