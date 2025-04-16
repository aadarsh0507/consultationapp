const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// @route   POST api/auth/register
// @desc    Register a doctor
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, doctorId, password, role } = req.body;

    // Validate required fields
    if (!name || !doctorId || !password) {
      return res.status(400).json({ 
        message: 'Please provide all required fields',
        missingFields: {
          name: !name,
          doctorId: !doctorId,
          password: !password
        }
      });
    }

    // Check if doctor already exists
    let user = await User.findOne({ doctorId });
    if (user) {
      return res.status(400).json({ message: 'Doctor ID already exists' });
    }

    // Create new user
    user = new User({
      name,
      doctorId,
      password,
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
    if (err.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error',
        errors: Object.values(err.errors).map(e => e.message)
      });
    }
    res.status(500).json({ 
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// @route   POST api/auth/login
// @desc    Login doctor
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { doctorId, password } = req.body;

    // Check if doctor exists
    const user = await User.findOne({ doctorId }).select('+password');
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
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
});

// Get current user
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router; 