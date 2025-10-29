const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  orderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  razorpayOrderId: {
    type: String,
    required: true,
    unique: true
  },
  razorpayPaymentId: {
    type: String,
    default: null
  },
  razorpaySignature: {
    type: String,
    default: null
  },
  packageId: {
    type: String,
    required: true
  },
  upcoins: {
    type: Number,
    required: true,
    min: 0
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['created', 'pending', 'success', 'failed', 'refunded'],
    default: 'created',
    index: true
  },
  paymentMethod: {
    type: String,
    default: null
  },
  failureReason: {
    type: String,
    default: null
  },
  metadata: {
    type: Object,
    default: {}
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  completedAt: {
    type: Date,
    default: null
  }
});

// Index for faster queries
PaymentSchema.index({ user: 1, status: 1, createdAt: -1 });

// Method to mark payment as successful
PaymentSchema.methods.markAsSuccess = async function(paymentId, signature, method) {
  this.status = 'success';
  this.razorpayPaymentId = paymentId;
  this.razorpaySignature = signature;
  this.paymentMethod = method;
  this.completedAt = new Date();
  return await this.save();
};

// Method to mark payment as failed
PaymentSchema.methods.markAsFailed = async function(reason) {
  this.status = 'failed';
  this.failureReason = reason;
  this.completedAt = new Date();
  return await this.save();
};

const Payment = mongoose.model('Payment', PaymentSchema);

module.exports = Payment;
