const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Lecture = require('../models/Lecture');
const Transaction = require('../models/Transaction');
const { auth } = require('../middleware/auth');

/**
 * @route   GET /api/admin/stats/overview
 * @desc    Get admin dashboard overview statistics
 * @access  Private (Admin only)
 */
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    // Get current date for time-based queries
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // User statistics
    const [
      totalUsers,
      totalStudents,
      totalTrainers,
      newUsersThisMonth,
      newUsersLastMonth,
      pendingTrainers
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'trainer', isApproved: true }),
      User.countDocuments({ createdAt: { $gte: lastMonth } }),
      User.countDocuments({ 
        createdAt: { 
          $gte: new Date(lastMonth.getFullYear(), lastMonth.getMonth() - 1, lastMonth.getDate()),
          $lt: lastMonth 
        } 
      }),
      User.countDocuments({ role: 'trainer', isApproved: false })
    ]);

    // Lecture statistics
    const [
      totalLectures,
      activeLectures,
      completedLectures,
      scheduledLectures,
      newLecturesThisMonth,
      newLecturesLastMonth
    ] = await Promise.all([
      Lecture.countDocuments(),
      Lecture.countDocuments({ status: { $in: ['scheduled', 'live'] } }),
      Lecture.countDocuments({ status: 'completed' }),
      Lecture.countDocuments({ status: 'scheduled' }),
      Lecture.countDocuments({ createdAt: { $gte: lastMonth } }),
      Lecture.countDocuments({ 
        createdAt: { 
          $gte: new Date(lastMonth.getFullYear(), lastMonth.getMonth() - 1, lastMonth.getDate()),
          $lt: lastMonth 
        } 
      })
    ]);

    // Revenue statistics (sum of all lecture prices * enrolled students)
    const revenueData = await Lecture.aggregate([
      {
        $project: {
          revenue: { $multiply: ['$price', { $size: '$enrolledStudents' }] },
          createdAt: 1
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$revenue' },
          thisMonthRevenue: {
            $sum: {
              $cond: [
                { $gte: ['$createdAt', lastMonth] },
                '$revenue',
                0
              ]
            }
          },
          lastMonthRevenue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ['$createdAt', new Date(lastMonth.getFullYear(), lastMonth.getMonth() - 1, lastMonth.getDate())] },
                    { $lt: ['$createdAt', lastMonth] }
                  ]
                },
                '$revenue',
                0
              ]
            }
          }
        }
      }
    ]);

    const revenue = revenueData[0] || { totalRevenue: 0, thisMonthRevenue: 0, lastMonthRevenue: 0 };

    // Calculate growth rates
    const userGrowthRate = newUsersLastMonth > 0 
      ? Math.round(((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100)
      : newUsersThisMonth > 0 ? 100 : 0;

    const lectureGrowthRate = newLecturesLastMonth > 0
      ? Math.round(((newLecturesThisMonth - newLecturesLastMonth) / newLecturesLastMonth) * 100)
      : newLecturesThisMonth > 0 ? 100 : 0;

    const revenueGrowthRate = revenue.lastMonthRevenue > 0
      ? Math.round(((revenue.thisMonthRevenue - revenue.lastMonthRevenue) / revenue.lastMonthRevenue) * 100)
      : revenue.thisMonthRevenue > 0 ? 100 : 0;

    // Platform health metrics
    const platformHealth = {
      serverStatus: 'online',
      databaseStatus: 'healthy',
      apiResponseTime: Math.floor(Math.random() * 50) + 100, // Mock response time
      uptime: '99.9%'
    };

    res.json({
      users: {
        total: totalUsers,
        students: totalStudents,
        trainers: totalTrainers,
        pendingTrainers,
        growth: userGrowthRate,
        newThisMonth: newUsersThisMonth
      },
      lectures: {
        total: totalLectures,
        active: activeLectures,
        completed: completedLectures,
        scheduled: scheduledLectures,
        growth: lectureGrowthRate,
        newThisMonth: newLecturesThisMonth
      },
      revenue: {
        total: revenue.totalRevenue,
        thisMonth: revenue.thisMonthRevenue,
        growth: revenueGrowthRate
      },
      platformHealth
    });
  } catch (err) {
    console.error('Error fetching admin stats:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/admin/stats/recent-activity
 * @desc    Get recent platform activity
 * @access  Private (Admin only)
 */
router.get('/stats/recent-activity', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get recent users
    const recentUsers = await User.find({ 
      createdAt: { $gte: lastWeek } 
    }).sort({ createdAt: -1 }).limit(5);

    // Get recent lectures
    const recentLectures = await Lecture.find({ 
      createdAt: { $gte: lastWeek } 
    }).populate('trainer', 'firstname lastname').sort({ createdAt: -1 }).limit(5);

    // Get pending trainer approvals
    const pendingTrainers = await User.find({ 
      role: 'trainer', 
      isApproved: false 
    }).sort({ createdAt: -1 }).limit(5);

    const activities = [];

    // Add user activities
    recentUsers.forEach(user => {
      activities.push({
        id: `user-${user._id}`,
        type: 'user',
        message: `New ${user.role} registered: ${user.firstname} ${user.lastname}`,
        time: user.createdAt,
        status: 'info',
        data: { userId: user._id, userRole: user.role }
      });
    });

    // Add lecture activities
    recentLectures.forEach(lecture => {
      activities.push({
        id: `lecture-${lecture._id}`,
        type: 'lecture',
        message: `New lecture created: ${lecture.title}`,
        time: lecture.createdAt,
        status: 'info',
        data: { lectureId: lecture._id, trainer: lecture.trainer }
      });
    });

    // Add pending trainer activities
    pendingTrainers.forEach(trainer => {
      activities.push({
        id: `pending-${trainer._id}`,
        type: 'approval',
        message: `Trainer application pending: ${trainer.firstname} ${trainer.lastname}`,
        time: trainer.createdAt,
        status: 'warning',
        data: { trainerId: trainer._id }
      });
    });

    // Sort by time and limit
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));

    res.json(activities.slice(0, 10));
  } catch (err) {
    console.error('Error fetching recent activity:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/admin/stats/pending-approvals
 * @desc    Get items pending approval
 * @access  Private (Admin only)
 */
router.get('/stats/pending-approvals', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    // Get pending trainer approvals
    const pendingTrainers = await User.find({ 
      role: 'trainer', 
      isApproved: false 
    }).sort({ createdAt: -1 });

    // Get recently created lectures that might need review
    const recentLectures = await Lecture.find({ 
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    }).populate('trainer', 'firstname lastname').sort({ createdAt: -1 });

    const approvals = [];

    // Add trainer approvals
    pendingTrainers.forEach(trainer => {
      approvals.push({
        id: trainer._id,
        type: 'Trainer',
        name: `${trainer.firstname} ${trainer.lastname}`,
        item: 'Profile verification',
        email: trainer.email,
        createdAt: trainer.createdAt,
        data: trainer
      });
    });

    // Add lecture reviews (for recently created lectures)
    recentLectures.forEach(lecture => {
      approvals.push({
        id: lecture._id,
        type: 'Lecture',
        name: lecture.title,
        item: 'Content review',
        trainer: `${lecture.trainer.firstname} ${lecture.trainer.lastname}`,
        createdAt: lecture.createdAt,
        data: lecture
      });
    });

    res.json(approvals);
  } catch (err) {
    console.error('Error fetching pending approvals:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/admin/withdrawals
 * @desc    Get all withdrawal requests
 * @access  Private (Admin only)
 */
router.get('/withdrawals', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { status } = req.query;
    const filter = { category: 'withdrawal' };
    
    if (status && ['pending', 'completed', 'failed'].includes(status)) {
      filter.status = status;
    }

    const withdrawals = await Transaction.find(filter)
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      withdrawals
    });
  } catch (err) {
    console.error('Error fetching withdrawals:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PUT /api/admin/withdrawals/:id/approve
 * @desc    Approve a withdrawal request
 * @access  Private (Admin only)
 */
router.put('/withdrawals/:id/approve', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const withdrawal = await Transaction.findById(req.params.id);
    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal request not found' });
    }

    if (withdrawal.category !== 'withdrawal') {
      return res.status(400).json({ message: 'Invalid transaction type' });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ message: 'Withdrawal already processed' });
    }

    withdrawal.status = 'completed';
    withdrawal.metadata.approvedBy = user._id;
    withdrawal.metadata.approvedAt = new Date();
    await withdrawal.save();

    console.log(`Admin ${user.email} approved withdrawal ${withdrawal._id} for ₹${withdrawal.realMoneyAmount}`);

    res.json({
      success: true,
      message: 'Withdrawal approved successfully',
      withdrawal
    });
  } catch (err) {
    console.error('Error approving withdrawal:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PUT /api/admin/withdrawals/:id/reject
 * @desc    Reject a withdrawal request and refund
 * @access  Private (Admin only)
 */
router.put('/withdrawals/:id/reject', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    const withdrawal = await Transaction.findById(req.params.id);
    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal request not found' });
    }

    if (withdrawal.category !== 'withdrawal') {
      return res.status(400).json({ message: 'Invalid transaction type' });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ message: 'Withdrawal already processed' });
    }

    // Refund the amount to trainer's wallet
    const trainer = await User.findById(withdrawal.user);
    trainer.walletBalance += withdrawal.amount;
    await trainer.save();

    // Update withdrawal status
    withdrawal.status = 'failed';
    withdrawal.metadata.rejectedBy = user._id;
    withdrawal.metadata.rejectedAt = new Date();
    withdrawal.metadata.rejectionReason = reason;
    await withdrawal.save();

    // Create refund transaction
    const refundTransaction = new Transaction({
      user: trainer._id,
      type: 'credit',
      amount: withdrawal.amount,
      realMoneyAmount: 0,
      currency: 'INR',
      description: `Withdrawal refund - ${reason}`,
      category: 'refund',
      status: 'completed',
      paymentMethod: 'wallet',
      reference: `refund_${withdrawal._id}`,
      balanceBefore: trainer.walletBalance - withdrawal.amount,
      balanceAfter: trainer.walletBalance,
      metadata: {
        originalWithdrawal: withdrawal._id,
        reason: reason
      }
    });
    await refundTransaction.save();

    console.log(`Admin ${user.email} rejected withdrawal ${withdrawal._id} and refunded ₹${withdrawal.realMoneyAmount}`);

    res.json({
      success: true,
      message: 'Withdrawal rejected and amount refunded',
      withdrawal,
      refund: refundTransaction
    });
  } catch (err) {
    console.error('Error rejecting withdrawal:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;