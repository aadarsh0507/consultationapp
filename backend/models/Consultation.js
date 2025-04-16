const mongoose = require('mongoose');

const consultationSchema = new mongoose.Schema({
  patientName: {
    type: String,
    required: [true, 'Patient name is required'],
    trim: true
  },
  uhidId: {
    type: String,
    required: [true, 'UHID ID is required'],
    unique: true,
    trim: true
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Doctor ID is required']
  },
  doctorName: {
    type: String,
    required: [true, 'Doctor name is required'],
    trim: true
  },
  attenderName: {
    type: String,
    required: [true, 'Attender name is required'],
    trim: true
  },
  icuConsultantName: {
    type: String,
    required: [true, 'ICU consultant name is required'],
    trim: true
  },
  videoFileName: {
    type: String,
    required: [true, 'Video filename is required']
  },
  date: {
    type: Date,
    default: Date.now
  },
  recordingDuration: {
    type: Number,
    required: [true, 'Recording duration is required']
  },
  status: {
    type: String,
    enum: ['completed', 'pending', 'cancelled'],
    default: 'completed'
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

// Create indexes for faster queries
consultationSchema.index({ uhidId: 1 });
consultationSchema.index({ doctor: 1 });
consultationSchema.index({ date: -1 });

module.exports = mongoose.model('Consultation', consultationSchema); 