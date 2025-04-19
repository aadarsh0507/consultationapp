const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { body, validationResult } = require('express-validator'); // Add express-validator for input validation

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
        errors: errors.array()
      });
    }

    try {
      const { name, doctorId, password, role } = req.body;

      // Check if doctor already exists
      let user = await User.findOne({ doctorId });
      if (user) {
        return res.status(400).json({ message: 'Doctor ID already exists' });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create new user
      user = new User({
        name,
        doctorId,
        password: hashedPassword,
        role: role || 'doctor'
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
          role: user.role
        }
      });
    } catch (err) {
      console.error('Registration error:', err);
      res.status(500).json({ 
        message: 'Server error during registration',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
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
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    // Validate input data
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Please provide valid credentials',
        errors: errors.array()
      });
    }

    try {
      const { doctorId, password } = req.body;

      // Check if doctor exists
      const user = await User.findOne({ doctorId }).select('+password');
      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

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
          role: user.role
        }
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Get current user
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
