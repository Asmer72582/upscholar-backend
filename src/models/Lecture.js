const mongoose = require('mongoose');

const LectureSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  trainer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Programming',
      'Web Development',
      'Mobile Development',
      'Data Science',
      'Machine Learning',
      'DevOps',
      'Design',
      'Business',
      'Marketing',
      'Other'
    ]
  },
  tags: [{
    type: String,
    trim: true
  }],
  price: {
    type: Number,
    required: true,
    min: 0,
    max: 10000
  },
  duration: {
    type: Number, // in minutes
    required: true,
    min: 15,
    max: 480 // 8 hours max
  },
  scheduledAt: {
    type: Date,
    required: true,
    validate: {
      validator: function(v) {
        // Only validate future dates for new lectures
        if (this.isNew) {
          return v > new Date();
        }
        return true; // Allow any date for existing lectures
      },
      message: 'Scheduled time must be in the future'
    }
  },
  maxStudents: {
    type: Number,
    required: true,
    min: 1,
    max: 1000,
    default: 50
  },
  enrolledStudents: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    enrolledAt: {
      type: Date,
      default: Date.now
    },
    attended: {
      type: Boolean,
      default: false
    }
  }],
  status: {
    type: String,
    enum: ['scheduled', 'live', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  meetingLink: {
    type: String,
    trim: true
  },
  recordingUrl: {
    type: String,
    trim: true
  },
  materials: [{
    name: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['pdf', 'video', 'link', 'document', 'other'],
      default: 'other'
    }
  }],
  feedback: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      maxlength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalEarnings: {
    type: Number,
    default: 0,
    min: 0
  },
  isPublished: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
LectureSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Calculate average rating when feedback is updated
LectureSchema.methods.calculateAverageRating = function() {
  if (this.feedback.length === 0) {
    this.averageRating = 0;
    return;
  }
  
  const sum = this.feedback.reduce((acc, fb) => acc + fb.rating, 0);
  this.averageRating = Math.round((sum / this.feedback.length) * 10) / 10;
};

// Get enrolled students count
LectureSchema.virtual('enrolledCount').get(function() {
  return this.enrolledStudents.length;
});

// Check if lecture is full
LectureSchema.virtual('isFull').get(function() {
  return this.enrolledStudents.length >= this.maxStudents;
});

// Check if lecture can be cancelled (at least 24 hours before)
LectureSchema.virtual('canBeCancelled').get(function() {
  const now = new Date();
  const scheduledTime = new Date(this.scheduledAt);
  const timeDiff = scheduledTime.getTime() - now.getTime();
  const hoursDiff = timeDiff / (1000 * 3600);
  return hoursDiff >= 24 && this.status === 'scheduled';
});

// Ensure virtual fields are serialized
LectureSchema.set('toJSON', { virtuals: true });
LectureSchema.set('toObject', { virtuals: true });

const Lecture = mongoose.model('Lecture', LectureSchema);

module.exports = Lecture;