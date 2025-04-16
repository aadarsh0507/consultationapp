const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Consultation = require('../models/Consultation');
const { protect, authorize } = require('../middleware/auth');

// Configure multer for video upload
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function(req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function(req, file, cb) {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Not a video file!'), false);
    }
  }
});

// Create a new consultation
router.post('/', protect, async (req, res) => {
  try {
    const {
      patientName,
      uhidId,
      doctorName,
      attenderName,
      icuConsultantName,
      videoFileName,
      recordingDuration,
      notes
    } = req.body;

    // Create new consultation
    const consultation = new Consultation({
      patientName,
      uhidId,
      doctor: req.user.id,
      doctorName,
      attenderName,
      icuConsultantName,
      videoFileName,
      recordingDuration,
      notes,
      status: 'completed'
    });

    await consultation.save();
    res.status(201).json({
      success: true,
      data: consultation
    });
  } catch (error) {
    console.error('Error creating consultation:', error);
    if (error.code === 11000) {
      res.status(400).json({ 
        success: false,
        message: 'UHID already exists' 
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: 'Server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
});

// Get all consultations with filters
router.get('/', protect, async (req, res) => {
  try {
    const { 
      dateFrom, 
      dateTo, 
      patientName, 
      doctorName,
      uhidId,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    let query = {};

    // Date range filter
    if (dateFrom && dateTo) {
      query.date = {
        $gte: new Date(dateFrom),
        $lte: new Date(dateTo)
      };
    }

    // Patient name filter
    if (patientName) {
      query.patientName = { $regex: patientName, $options: 'i' };
    }

    // Doctor name filter
    if (doctorName) {
      query.doctorName = { $regex: doctorName, $options: 'i' };
    }

    // UHID filter
    if (uhidId) {
      query.uhidId = { $regex: uhidId, $options: 'i' };
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const consultations = await Consultation.find(query)
      .sort(sortOptions)
      .populate('doctor', 'name email');

    res.json({
      success: true,
      count: consultations.length,
      data: consultations
    });
  } catch (error) {
    console.error('Error fetching consultations:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get consultations by doctor
router.get('/doctor', protect, async (req, res) => {
  try {
    const consultations = await Consultation.find({ doctor: req.user.id })
      .sort({ date: -1 });
    res.json({
      success: true,
      count: consultations.length,
      data: consultations
    });
  } catch (error) {
    console.error('Error fetching doctor consultations:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get consultation by UHID
router.get('/uhid/:uhidId', protect, async (req, res) => {
  try {
    const consultation = await Consultation.findOne({ uhidId: req.params.uhidId })
      .populate('doctor', 'name email');
    
    if (!consultation) {
      return res.status(404).json({ 
        success: false,
        message: 'Consultation not found' 
      });
    }
    
    res.json({
      success: true,
      data: consultation
    });
  } catch (error) {
    console.error('Error fetching consultation:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update consultation
router.put('/:id', protect, async (req, res) => {
  try {
    const consultation = await Consultation.findById(req.params.id);
    
    if (!consultation) {
      return res.status(404).json({ 
        success: false,
        message: 'Consultation not found' 
      });
    }

    // Check if the user is the doctor who created the consultation
    if (consultation.doctor.toString() !== req.user.id) {
      return res.status(401).json({ 
        success: false,
        message: 'Not authorized' 
      });
    }

    const updatedConsultation = await Consultation.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      data: updatedConsultation
    });
  } catch (error) {
    console.error('Error updating consultation:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete consultation
router.delete('/:id', protect, async (req, res) => {
  try {
    const consultation = await Consultation.findById(req.params.id);
    
    if (!consultation) {
      return res.status(404).json({ 
        success: false,
        message: 'Consultation not found' 
      });
    }

    // Check if the user is the doctor who created the consultation
    if (consultation.doctor.toString() !== req.user.id) {
      return res.status(401).json({ 
        success: false,
        message: 'Not authorized' 
      });
    }

    await consultation.remove();
    res.json({ 
      success: true,
      message: 'Consultation removed' 
    });
  } catch (error) {
    console.error('Error deleting consultation:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router; 