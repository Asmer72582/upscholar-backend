const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Amount must be positive']
  },
  realMoneyAmount: {
    type: Number,
    default: 0,
    min: [0, 'Real money amount must be positive']
  },
  currency: {
    type: String,
    default: 'INR'
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['lecture_enrollment', 'upcoin_purchase', 'refund', 'joining_bonus', 'withdrawal'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed'
  },
  reference: {
    type: String, // Can store lecture ID, payment ID, etc.
    trim: true
  },
  relatedLecture: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lecture'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'upi', 'netbanking', 'wallet', 'emi', 'paylater'],
    default: 'wallet'
  },
  paymentReference: {
    type: String, // External payment system reference
    trim: true
  },
  balanceBefore: {
    type: Number,
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed, // For storing additional data
    default: {}
  }
}, {
  timestamps: true
});

// Index for efficient queries
TransactionSchema.index({ user: 1, createdAt: -1 });
TransactionSchema.index({ user: 1, type: 1 });
TransactionSchema.index({ user: 1, category: 1 });
TransactionSchema.index({ status: 1 });

// Virtual for formatted amount
TransactionSchema.virtual('formattedAmount').get(function() {
  return `${this.type === 'credit' ? '+' : '-'}${this.amount} UC`;
});

// Method to get transaction summary
TransactionSchema.statics.getUserSummary = async function(userId) {
  const summary = await this.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId), status: 'completed' } },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  const result = {
    totalCredits: 0,
    totalDebits: 0,
    creditCount: 0,
    debitCount: 0
  };

  summary.forEach(item => {
    if (item._id === 'credit') {
      result.totalCredits = item.total;
      result.creditCount = item.count;
    } else {
      result.totalDebits = item.total;
      result.debitCount = item.count;
    }
  });

  return result;
};

const Transaction = mongoose.model('Transaction', TransactionSchema);

module.exports = Transaction;