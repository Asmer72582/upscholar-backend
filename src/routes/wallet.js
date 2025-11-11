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
 * @desc    REMOVED - Insecure endpoint. Use /api/payment/create-order instead
 * @access  Private
 */
// SECURITY: This endpoint has been removed to prevent unauthorized UpCoin manipulation
// Users can only add UpCoins through Razorpay payment verification
// See /api/payment/create-order and /api/payment/verify for secure payment flow

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

/**
 * @route   GET /api/wallet/stats
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

/**
 * @route   POST /api/wallet/withdraw
 * @desc    Request withdrawal (Trainers only, 1 UpCoin = ₹1)
 * @access  Private (Trainer only)
 */
router.post('/withdraw', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (user.role !== 'trainer') {
      return res.status(403).json({ message: 'Only trainers can withdraw funds' });
    }

    const { amount, bankDetails, upiId } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid withdrawal amount' });
    }

    // Minimum withdrawal: 100 UpCoins
    if (amount < 100) {
      return res.status(400).json({ 
        message: 'Minimum withdrawal amount is 100 UpCoins (₹100)',
        minimum: 100
      });
    }

    // Check if user has sufficient balance
    if (user.walletBalance < amount) {
      return res.status(400).json({ 
        message: `Insufficient balance. Available: ${user.walletBalance} UC, Requested: ${amount} UC`,
        available: user.walletBalance,
        requested: amount
      });
    }

    // Validate bank details (at least one payment method required)
    const hasBankDetails = bankDetails && bankDetails.accountNumber && bankDetails.ifscCode && bankDetails.accountHolderName;
    const hasUpiId = upiId && upiId.trim().length > 0;

    if (!hasBankDetails && !hasUpiId) {
      return res.status(400).json({ 
        message: 'Please provide either bank details or UPI ID' 
      });
    }

    // Deduct amount from wallet
    const balanceBefore = user.walletBalance;
    user.walletBalance -= amount;
    await user.save();

    // Prepare metadata
    const metadata = {
      withdrawalAmount: amount,
      conversionRate: 1, // 1 UC = ₹1
      requestedAt: new Date(),
      trainerName: user.firstName ? `${user.firstName} ${user.lastName}` : user.email,
      trainerEmail: user.email
    };

    // Add bank details if provided
    if (hasBankDetails) {
      metadata.bankDetails = {
        accountNumber: bankDetails.accountNumber, // Store full number for admin
        accountNumberLast4: bankDetails.accountNumber.slice(-4),
        ifscCode: bankDetails.ifscCode,
        accountHolderName: bankDetails.accountHolderName,
        bankName: bankDetails.bankName || 'Not provided'
      };
    }

    // Add UPI ID if provided
    if (hasUpiId) {
      metadata.upiId = upiId.trim();
    }

    // Create withdrawal transaction
    const withdrawalTransaction = new Transaction({
      user: user._id,
      type: 'debit',
      amount: amount,
      realMoneyAmount: amount, // 1 UpCoin = ₹1
      currency: 'INR',
      description: `Withdrawal request for ₹${amount}`,
      category: 'withdrawal',
      status: 'pending', // Pending until admin approves
      paymentMethod: hasUpiId ? 'upi' : 'bank_transfer',
      reference: `withdrawal_${Date.now()}`,
      balanceBefore: balanceBefore,
      balanceAfter: user.walletBalance,
      metadata: metadata
    });

    await withdrawalTransaction.save();

    console.log(`Withdrawal request created: ${user.email} requested ₹${amount} (${amount} UC)`);

    res.json({
      success: true,
      message: 'Withdrawal request submitted successfully. It will be processed within 2-3 business days.',
      transaction: {
        id: withdrawalTransaction._id,
        amount: amount,
        realMoneyAmount: amount,
        status: 'pending',
        reference: withdrawalTransaction.reference
      },
      newBalance: user.walletBalance
    });

  } catch (err) {
    console.error('Error processing withdrawal:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/wallet/earnings
 * @desc    Get trainer earnings breakdown
 * @access  Private (Trainer only)
 */
router.get('/earnings', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (user.role !== 'trainer') {
      return res.status(403).json({ message: 'Only trainers can access earnings' });
    }

    // Get all earnings transactions with student details
    const earningsTransactions = await Transaction.find({
      user: req.user.id,
      type: 'credit',
      category: 'lecture_enrollment',
      status: 'completed'
    })
    .populate('relatedLecture', 'title price')
    .populate({
      path: 'metadata.studentId',
      select: 'firstName lastName email'
    })
    .sort({ createdAt: -1 });

    // Calculate total earnings
    const totalEarnings = earningsTransactions.reduce((sum, tx) => sum + tx.amount, 0);

    // Get earnings by month
    const earningsByMonth = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(req.user.id),
          type: 'credit',
          category: 'lecture_enrollment',
          status: 'completed'
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': -1, '_id.month': -1 }
      },
      {
        $limit: 12
      }
    ]);

    // Get total withdrawals
    const totalWithdrawals = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(req.user.id),
          category: 'withdrawal',
          status: { $in: ['completed', 'pending'] }
        }
      },
      {
        $group: {
          _id: '$status',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const withdrawalSummary = {
      completed: totalWithdrawals.find(w => w._id === 'completed')?.total || 0,
      pending: totalWithdrawals.find(w => w._id === 'pending')?.total || 0,
      completedCount: totalWithdrawals.find(w => w._id === 'completed')?.count || 0,
      pendingCount: totalWithdrawals.find(w => w._id === 'pending')?.count || 0
    };

    // Available for withdrawal (current balance)
    const availableForWithdrawal = user.walletBalance;

    res.json({
      totalEarnings,
      availableForWithdrawal,
      totalWithdrawn: withdrawalSummary.completed,
      pendingWithdrawals: withdrawalSummary.pending,
      earningsByMonth,
      recentEarnings: earningsTransactions.slice(0, 10),
      withdrawalSummary,
      conversionRate: 1 // 1 UC = ₹1
    });

  } catch (err) {
    console.error('Error fetching earnings:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;