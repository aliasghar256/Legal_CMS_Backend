const jwt = require('jsonwebtoken');
const Lawyer = require('../models/Lawyer');

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No valid token provided.'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-fallback-secret-key');

    // Check if lawyer still exists
    const lawyer = await Lawyer.findById(decoded.lawyer_id);
    if (!lawyer) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Lawyer not found.'
      });
    }

    // Add lawyer info to request
    req.lawyer = {
      lawyer_id: decoded.lawyer_id,
      email: decoded.email
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token.'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Token expired.'
      });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = authMiddleware;
