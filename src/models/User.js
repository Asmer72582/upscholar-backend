const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['student', 'trainer', 'admin'],
    default: 'student',
    required: true
  },
  firstname: {
    type: String,
    required: true,
    trim: true
  },
  lastname: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
  },
  mobile: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: [/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number'],
    index: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  registrationIP: {
    type: String,
    required: false,
    index: true
  },
  password: {
    type: String,
    required: function() {
      return this.role !== 'trainer'; // Password not required for trainers initially
    },
    minlength: 6
  },
  // Trainer-specific fields
  resume: {
    type: String, // Will store file path for uploaded CV
    required: function() {
      return this.role === 'trainer';
    },
    trim: true
  },
  demoVideoUrl: {
    type: String,
    required: function() {
      return this.role === 'trainer';
    },
    trim: true,
    validate: {
      validator: function(v) {
        if (this.role !== 'trainer') return true;
        // Basic URL validation for YouTube, Vimeo, or cloud storage URLs
        const urlPattern = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com|drive\.google\.com|dropbox\.com|onedrive\.live\.com|amazonaws\.com)/i;
        return urlPattern.test(v);
      },
      message: 'Please provide a valid video URL from YouTube, Vimeo, or a cloud storage service'
    }
  },
  expertise: {
    type: [String],
    required: function() {
      return this.role === 'trainer';
    },
    validate: {
      validator: function(v) {
        if (this.role !== 'trainer') return true;
        return v && v.length > 0;
      },
      message: 'Please provide at least one area of expertise'
    }
  },
  experience: {
    type: Number,
    required: function() {
      return this.role === 'trainer';
    },
    min: [0, 'Experience cannot be negative'],
    max: [50, 'Experience cannot exceed 50 years']
  },
  bio: {
    type: String,
    required: function() {
      return this.role === 'trainer';
    },
    trim: true,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'suspended', 'active'],
    default: function() {
      return this.role === 'trainer' ? 'pending' : 'approved';
    }
  },
  isApproved: {
    type: Boolean,
    default: function() {
      return this.role !== 'trainer'; // Auto-approve students, trainers need approval
    }
  },
  tempPassword: {
    type: String, // Temporary password for trainers
    required: false
  },
  // Password reset fields
  resetPasswordToken: {
    type: String,
    required: false
  },
  resetPasswordExpires: {
    type: Date,
    required: false
  },
  // Wallet fields
  walletBalance: {
    type: Number,
    default: 150, // Starting balance for new users
    min: [0, 'Wallet balance cannot be negative']
  },
  totalEarned: {
    type: Number,
    default: 150, // Track total earned (including starting balance)
    min: [0, 'Total earned cannot be negative']
  },
  totalSpent: {
    type: Number,
    default: 0,
    min: [0, 'Total spent cannot be negative']
  },
  // Suspension fields
  suspensionReason: {
    type: String,
    required: false
  },
  suspendedAt: {
    type: Date,
    required: false
  },
  suspendedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  activatedAt: {
    type: Date,
    required: false
  },
  activatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password for login
UserSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) {
    return false; // No password set
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', UserSchema);

module.exports = User;