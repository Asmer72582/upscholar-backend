const mongoose = require('mongoose');

const OTPSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  mobile: {
    type: String,
    required: false,
    trim: true,
    index: true
  },
  otp: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    enum: ['registration', 'login', 'password_reset'],
    default: 'registration'
  },
  ipAddress: {
    type: String,
    required: true,
    index: true
  },
  verified: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // Auto-delete expired OTPs
  },
  attempts: {
    type: Number,
    default: 0,
    max: 5 // Maximum verification attempts
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster lookups
OTPSchema.index({ email: 1, verified: 1 });
OTPSchema.index({ ipAddress: 1, createdAt: -1 });

const OTP = mongoose.model('OTP', OTPSchema);

module.exports = OTP;


