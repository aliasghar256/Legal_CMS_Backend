const User = require('../models/User');
const jwt = require('jsonwebtoken');

class UserController {
  // Signup - Register a new user
  static async signup(req, res) {
    try {
      const { name, email, password, license_no, phone_number } = req.body;

      // Validation
      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, and password are required'
        });
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address'
        });
      }

      // Password strength validation
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }

      // Check if email already exists
      const emailExists = await User.emailExists(email);
      if (emailExists) {
        return res.status(409).json({
          success: false,
          message: 'Email already registered'
        });
      }

      // Create user
      const user = await User.create({
        name,
        email,
        password,
        license_no: license_no || null,
        phone_number: phone_number || null
      });

      // Generate JWT token
      const token = jwt.sign(
        { 
          user_id: user.user_id, 
          email: user.email 
        },
        process.env.JWT_SECRET || 'your-fallback-secret-key',
        { expiresIn: '24h' }
      );

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            license_no: user.license_no,
            phone_number: user.phone_number
          },
          token
        }
      });

    } catch (error) {
      console.error('Signup error:', error);
      
      // Handle unique constraint violations
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'Email already registered'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error during registration'
      });
    }
  }

  // Login - Authenticate user
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Find user by email
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Verify password
      const isValidPassword = await User.verifyPassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          user_id: user.user_id, 
          email: user.email 
        },
        process.env.JWT_SECRET || 'your-fallback-secret-key',
        { expiresIn: '24h' }
      );

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            license_no: user.license_no,
            phone_number: user.phone_number
          },
          token
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during login'
      });
    }
  }
  // Get user profile (protected route for token validation)
  static async getProfile(req, res) {
    try {
      // req.user is set by the auth middleware
      const user = await User.findById(req.user.user_id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          user: {
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            license_no: user.license_no,
            phone_number: user.phone_number
          }
        }
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

module.exports = UserController;
