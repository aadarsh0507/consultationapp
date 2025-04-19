const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { body, validationResult } = require('express-validator');
const {protect} = require('../middleware/auth');

// @route   POST api/auth/register
// @desc    Register a doctor
// @access  Public
router.post(
  '/register',
  [
    // Validate required fields
    body('name').notEmpty().withMessage('Name is required'),
    body('doctorId').notEmpty().withMessage('Doctor ID is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  ],
  async (req, res) => {
    // Validate input data
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Please provide valid input data',
        errors: errors.array(),
      });
    }

    try {
      const { name, doctorId, password, role } = req.body;

      // Check if doctor already exists
      let user = await User.findOne({ doctorId });
      if (user) {
        return res.status(400).json({ message: 'Doctor ID already exists' });
      }

      // Create new user
      // Hash password before saving
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      user = new User({
        name,
        doctorId,
        password: hashedPassword,
        role: role || 'doctor',
      });

      // Save user
      await user.save();

      // Create token
      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      res.status(201).json({
        token,
        user: {
          id: user._id,
          name: user.name,
          doctorId: user.doctorId,
          role: user.role,
        },
      });
    } catch (err) {
      console.error('Registration error:', err);
      res.status(500).json({
        message: 'Server error during registration',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
      });
    }
  }
);

// @route   POST api/auth/login
// @desc    Login doctor
// @access  Public
router.post(
  '/login',
  [
    body('doctorId').notEmpty().withMessage('Doctor ID is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    // Validate input data
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Please provide valid credentials',
        errors: errors.array(),
      });
    }

    try {
      const { doctorId, password } = req.body;

      // Check if doctor exists
      const user = await User.findOne({ doctorId }).select('+password');
      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials - Doctor ID does not exist' });
      }

      // Log the incoming request for debugging purposes
      console.log(`Attempting to log in with Doctor ID: ${doctorId}`);

      // Check password using bcrypt
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials - Incorrect password' });
      }

      // Log successful login attempt
      console.log(`User ${doctorId} logged in successfully`);

      // Create token
      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      res.json({
        token,
        user: {
          id: user._id,
          name: user.name,
          doctorId: user.doctorId,
          role: user.role,
        },
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({
        message: 'Server error during login',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
      });
    }
  }
);

// @route   POST api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', protect, (req, res) => {
  // Invalidate the token or perform any necessary logout operations
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
