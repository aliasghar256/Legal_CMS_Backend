const Lawyer = require('../models/Lawyer');
const jwt = require('jsonwebtoken');

class LawyerController {
  // Signup - Register a new lawyer
  static async signup(req, res) {
    try {
      const { name, email, password, license_no, contact_info } = req.body;

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
      const emailExists = await Lawyer.emailExists(email);
      if (emailExists) {
        return res.status(409).json({
          success: false,
          message: 'Email already registered'
        });
      }

      // Create lawyer
      const lawyer = await Lawyer.create({
        name,
        email,
        password,
        license_no: license_no || null,
        contact_info: contact_info || null
      });

      // Generate JWT token
      const token = jwt.sign(
        { 
          lawyer_id: lawyer.lawyer_id, 
          email: lawyer.email 
        },
        process.env.JWT_SECRET || 'your-fallback-secret-key',
        { expiresIn: '24h' }
      );

      res.status(201).json({
        success: true,
        message: 'Lawyer registered successfully',
        data: {
          lawyer: {
            lawyer_id: lawyer.lawyer_id,
            name: lawyer.name,
            email: lawyer.email,
            license_no: lawyer.license_no,
            contact_info: lawyer.contact_info
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

  // Login - Authenticate lawyer
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

      // Find lawyer by email
      const lawyer = await Lawyer.findByEmail(email);
      if (!lawyer) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Verify password
      const isValidPassword = await Lawyer.verifyPassword(password, lawyer.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          lawyer_id: lawyer.lawyer_id, 
          email: lawyer.email 
        },
        process.env.JWT_SECRET || 'your-fallback-secret-key',
        { expiresIn: '24h' }
      );

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          lawyer: {
            lawyer_id: lawyer.lawyer_id,
            name: lawyer.name,
            email: lawyer.email,
            license_no: lawyer.license_no,
            contact_info: lawyer.contact_info
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
}

module.exports = LawyerController;
