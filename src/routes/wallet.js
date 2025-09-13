const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Lecture = require('../models/Lecture');
const { auth } = require('../middleware/auth');

/**
 * @route   GET /api/wallet/balance
 * @desc    Get user wallet balance
 * @access  Private
 */
router.get('/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get transaction summary
    const summary = await Transaction.getUserSummary(req.user.id);
    
    // Get pending transactions
    const pendingTransactions = await Transaction.find({
      user: req.user.id,
      status: 'pending'
    });
    
    const pendingAmount = pendingTransactions.reduce((sum, tx) => {
      return sum + (tx.type === 'credit' ? tx.amount : -tx.amount);
    }, 0);

    const walletData = {
      balance: user.walletBalance || 0,
      pendingBalance: pendingAmount,
      totalEarned: summary.totalCredits,
      totalSpent: summary.totalDebits
    };

    res.json(walletData);
  } catch (err) {
    console.error('Error fetching wallet balance:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/wallet/transactions
 * @desc    Get user transaction history
 * @access  Private
 */
router.get('/transactions', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, category, status } = req.query;

    // Build filter query
    let query = { user: req.user.id };
    
    if (type && type !== 'all') {
      query.type = type;
    }
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (status && status !== 'all') {
      query.status = status;
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Transaction.countDocuments(query);

    // Transform transactions for frontend
    const transformedTransactions = transactions.map(tx => ({
      id: tx._id,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      category: tx.category,
      status: tx.status,
      reference: tx.reference,
      paymentMethod: tx.paymentMethod,
      relatedLecture: tx.relatedLecture || null,
      balanceBefore: tx.balanceBefore,
      balanceAfter: tx.balanceAfter,
      createdAt: tx.createdAt
    }));

    res.json({
      transactions: transformedTransactions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (err) {
    console.error('Error fetching transactions:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/wallet/add-funds
 * @desc    Add funds to wallet
 * @access  Private
 */
router.post('/add-funds', auth, async (req, res) => {
  try {
    const { amount, paymentMethod = 'card' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    if (!['card', 'paypal', 'bank_transfer'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentBalance = user.walletBalance || 0;

    // Create transaction record
    const transaction = new Transaction({
      user: req.user.id,
      type: 'credit',
      amount: amount,
      description: `Added funds via ${paymentMethod}`,
      category: 'funds_added',
      status: 'completed',
      paymentMethod: paymentMethod,
      reference: `fund_${Date.now()}`,
      balanceBefore: currentBalance,
      balanceAfter: currentBalance + amount,
      metadata: {
        paymentProcessor: 'mock', // In production, this would be Stripe, PayPal, etc.
        processingFee: 0
      }
    });

    await transaction.save();

    // Update user's balance
    user.walletBalance = currentBalance + amount;
    await user.save();

    res.json({
      message: 'Funds added successfully',
      transaction: {
        id: transaction._id,
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description,
        status: transaction.status,
        createdAt: transaction.createdAt
      },
      newBalance: user.walletBalance
    });
  } catch (err) {
    console.error('Error adding funds:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/wallet/pay
 * @desc    Process payment for lecture enrollment
 * @access  Private
 */
router.post('/pay', auth, async (req, res) => {
  try {
    const { lectureId, amount } = req.body;

    if (!lectureId || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid payment data' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get lecture details
    const lecture = await Lecture.findById(lectureId);
    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    const currentBalance = user.walletBalance || 0;
    if (currentBalance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Verify amount matches lecture price
    if (amount !== lecture.price) {
      return res.status(400).json({ message: 'Payment amount does not match lecture price' });
    }

    // Create transaction record
    const transaction = new Transaction({
      user: req.user.id,
      type: 'debit',
      amount: amount,
      description: `Enrolled in "${lecture.title}"`,
      category: 'lecture_enrollment',
      status: 'completed',
      paymentMethod: 'wallet',
      reference: `enrollment_${lectureId}`,
      relatedLecture: lectureId,
      balanceBefore: currentBalance,
      balanceAfter: currentBalance - amount,
      metadata: {
        lectureTitle: lecture.title,
        trainerId: lecture.trainer
      }
    });

    await transaction.save();

    // Update user's balance
    user.walletBalance = currentBalance - amount;
    await user.save();

    res.json({
      message: 'Payment processed successfully',
      transaction: {
        id: transaction._id,
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description,
        status: transaction.status,
        createdAt: transaction.createdAt
      },
      newBalance: user.walletBalance
    });
  } catch (err) {
    console.error('Error processing payment:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;/**
 * @r
oute   GET /api/wallet/stats
 * @desc    Get wallet statistics
 * @access  Private
 */
router.get('/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get monthly spending
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const monthlySpending = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(req.user.id),
          type: 'debit',
          status: 'completed',
          createdAt: { $gte: currentMonth }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Get spending by category
    const spendingByCategory = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(req.user.id),
          type: 'debit',
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentActivity = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(req.user.id),
          status: 'completed',
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      monthlySpending: monthlySpending[0]?.total || 0,
      monthlyTransactions: monthlySpending[0]?.count || 0,
      spendingByCategory: spendingByCategory.reduce((acc, item) => {
        acc[item._id] = {
          total: item.total,
          count: item.count
        };
        return acc;
      }, {}),
      recentActivity: {
        credits: recentActivity.find(item => item._id === 'credit')?.total || 0,
        debits: recentActivity.find(item => item._id === 'debit')?.total || 0,
        creditCount: recentActivity.find(item => item._id === 'credit')?.count || 0,
        debitCount: recentActivity.find(item => item._id === 'debit')?.count || 0
      }
    };

    res.json(stats);
  } catch (err) {
    console.error('Error fetching wallet stats:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;