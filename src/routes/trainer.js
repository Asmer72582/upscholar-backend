const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Lecture = require('../models/Lecture');
const Transaction = require('../models/Transaction');
const { auth } = require('../middleware/auth');

/**
 * @route   GET /api/trainer/stats/dashboard
 * @desc    Get trainer dashboard statistics
 * @access  Private (Trainer only)
 */
router.get('/stats/dashboard', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'trainer') {
      return res.status(403).json({ message: 'Access denied. Trainer only.' });
    }

    // Get current date for time-based queries
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Earnings statistics
    const totalEarnings = user.totalEarned || 0;
    
    // Get earnings this month and last month
    const thisMonthEarnings = await Transaction.aggregate([
      {
        $match: {
          recipient: user._id,
          type: 'lecture_payment',
          createdAt: { $gte: thisMonthStart }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    const lastMonthEarnings = await Transaction.aggregate([
      {
        $match: {
          recipient: user._id,
          type: 'lecture_payment',
          createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    const thisMonthTotal = thisMonthEarnings[0]?.total || 0;
    const lastMonthTotal = lastMonthEarnings[0]?.total || 0;
    const earningsGrowth = lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 100;

    // Recent earnings
    const recentEarnings = await Transaction.find({
      recipient: user._id,
      type: 'lecture_payment'
    })
    .populate('metadata.lecture', 'title')
    .sort({ createdAt: -1 })
    .limit(5);

    // Lecture statistics
    const [
      totalLectures,
      activeLectures,
      completedLectures,
      scheduledLectures
    ] = await Promise.all([
      Lecture.countDocuments({ trainer: user._id }),
      Lecture.countDocuments({ trainer: user._id, status: 'live' }),
      Lecture.countDocuments({ trainer: user._id, status: 'completed' }),
      Lecture.countDocuments({ trainer: user._id, status: 'scheduled' })
    ]);

    // Upcoming lectures
    const upcomingLectures = await Lecture.find({
      trainer: user._id,
      status: 'scheduled',
      scheduledAt: { $gte: now }
    })
    .sort({ scheduledAt: 1 })
    .limit(5)
    .select('title scheduledAt duration price maxStudents enrolledStudents status');

    // Student statistics
    const studentStats = await Lecture.aggregate([
      { $match: { trainer: user._id } },
      { $unwind: '$enrolledStudents' },
      {
        $group: {
          _id: null,
          totalStudents: { $addToSet: '$enrolledStudents.student' },
          newThisWeek: {
            $sum: {
              $cond: [
                { $gte: ['$enrolledStudents.enrolledAt', lastWeek] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          totalStudents: { $size: '$totalStudents' },
          newThisWeek: 1
        }
      }
    ]);

    const studentData = studentStats[0] || { totalStudents: 0, newThisWeek: 0 };

    // Performance metrics
    const performanceStats = await Lecture.aggregate([
      { $match: { trainer: user._id, status: 'completed' } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$averageRating' },
          totalReviews: { $sum: { $size: '$feedback' } },
          totalLectures: { $sum: 1 }
        }
      }
    ]);

    const performance = performanceStats[0] || { 
      averageRating: 0, 
      totalReviews: 0, 
      totalLectures: 0 
    };

    const dashboardStats = {
      earnings: {
        total: totalEarnings,
        thisMonth: thisMonthTotal,
        lastMonth: lastMonthTotal,
        growth: Math.round(earningsGrowth),
        recentEarnings: recentEarnings.map(earning => ({
          date: earning.createdAt.toISOString().split('T')[0],
          amount: earning.amount,
          lecture: earning.metadata?.lecture?.title || 'Unknown Lecture',
          lectureId: earning.metadata?.lecture?._id || null
        }))
      },
      lectures: {
        total: totalLectures,
        active: activeLectures,
        completed: completedLectures,
        scheduled: scheduledLectures,
        upcoming: upcomingLectures.map(lecture => ({
          id: lecture._id,
          title: lecture.title,
          scheduledAt: lecture.scheduledAt,
          duration: lecture.duration,
          enrolledStudents: lecture.enrolledStudents?.length || 0,
          maxStudents: lecture.maxStudents,
          price: lecture.price,
          status: lecture.status
        }))
      },
      students: {
        total: studentData.totalStudents,
        active: studentData.totalStudents, // Assuming all enrolled students are active
        newThisWeek: studentData.newThisWeek,
        growth: studentData.newThisWeek > 0 ? 100 : 0 // Simplified growth calculation
      },
      performance: {
        averageRating: Math.round((performance.averageRating || 0) * 10) / 10,
        totalReviews: performance.totalReviews,
        completionRate: totalLectures > 0 ? Math.round((completedLectures / totalLectures) * 100) : 0,
        attendanceRate: 85 // This would need more complex calculation based on actual attendance data
      }
    };

    res.json(dashboardStats);
  } catch (err) {
    console.error('Error fetching trainer dashboard stats:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/trainer/lectures/upcoming
 * @desc    Get trainer's upcoming lectures
 * @access  Private (Trainer only)
 */
router.get('/lectures/upcoming', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'trainer') {
      return res.status(403).json({ message: 'Access denied. Trainer only.' });
    }

    const upcomingLectures = await Lecture.find({
      trainer: user._id,
      status: 'scheduled',
      scheduledAt: { $gte: new Date() }
    })
    .sort({ scheduledAt: 1 })
    .select('title scheduledAt duration price maxStudents enrolledStudents status');

    const formattedLectures = upcomingLectures.map(lecture => ({
      id: lecture._id,
      title: lecture.title,
      scheduledAt: lecture.scheduledAt,
      duration: lecture.duration,
      enrolledStudents: lecture.enrolledStudents?.length || 0,
      maxStudents: lecture.maxStudents,
      price: lecture.price,
      status: lecture.status
    }));

    res.json(formattedLectures);
  } catch (err) {
    console.error('Error fetching upcoming lectures:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/trainer/earnings/recent
 * @desc    Get trainer's recent earnings
 * @access  Private (Trainer only)
 */
router.get('/earnings/recent', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'trainer') {
      return res.status(403).json({ message: 'Access denied. Trainer only.' });
    }

    const recentEarnings = await Transaction.find({
      recipient: user._id,
      type: 'lecture_payment'
    })
    .populate('metadata.lecture', 'title')
    .sort({ createdAt: -1 })
    .limit(10);

    const formattedEarnings = recentEarnings.map(earning => ({
      date: earning.createdAt.toISOString().split('T')[0],
      amount: earning.amount,
      lecture: earning.metadata?.lecture?.title || 'Unknown Lecture',
      lectureId: earning.metadata?.lecture?._id || null
    }));

    res.json(formattedEarnings);
  } catch (err) {
    console.error('Error fetching recent earnings:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/trainer/analytics/students
 * @desc    Get trainer's student analytics
 * @access  Private (Trainer only)
 */
router.get('/analytics/students', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'trainer') {
      return res.status(403).json({ message: 'Access denied. Trainer only.' });
    }

    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Student analytics
    const studentAnalytics = await Lecture.aggregate([
      { $match: { trainer: user._id } },
      { $unwind: '$enrolledStudents' },
      {
        $group: {
          _id: null,
          totalStudents: { $addToSet: '$enrolledStudents.student' },
          newStudentsThisWeek: {
            $sum: {
              $cond: [
                { $gte: ['$enrolledStudents.enrolledAt', lastWeek] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          totalStudents: { $size: '$totalStudents' },
          newStudentsThisWeek: 1
        }
      }
    ]);

    // Top performing lectures
    const topLectures = await Lecture.find({ trainer: user._id })
      .sort({ 'enrolledStudents.length': -1, averageRating: -1 })
      .limit(5)
      .select('title enrolledStudents averageRating price');

    const analytics = studentAnalytics[0] || { totalStudents: 0, newStudentsThisWeek: 0 };

    const result = {
      totalStudents: analytics.totalStudents,
      activeStudents: analytics.totalStudents, // Simplified - assuming all are active
      newStudentsThisWeek: analytics.newStudentsThisWeek,
      studentGrowth: analytics.newStudentsThisWeek > 0 ? 100 : 0,
      topPerformingLectures: topLectures.map(lecture => ({
        id: lecture._id,
        title: lecture.title,
        enrollments: lecture.enrolledStudents?.length || 0,
        rating: lecture.averageRating || 0,
        revenue: (lecture.enrolledStudents?.length || 0) * lecture.price
      }))
    };

    res.json(result);
  } catch (err) {
    console.error('Error fetching student analytics:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/trainer/analytics/performance
 * @desc    Get trainer's performance metrics
 * @access  Private (Trainer only)
 */
router.get('/analytics/performance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'trainer') {
      return res.status(403).json({ message: 'Access denied. Trainer only.' });
    }

    // Performance metrics
    const performanceStats = await Lecture.aggregate([
      { $match: { trainer: user._id, status: 'completed' } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$averageRating' },
          totalReviews: { $sum: { $size: '$feedback' } },
          totalLectures: { $sum: 1 }
        }
      }
    ]);

    // Monthly progress for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyProgress = await Lecture.aggregate([
      {
        $match: {
          trainer: user._id,
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          lectures: { $sum: 1 },
          earnings: { $sum: { $multiply: ['$price', { $size: '$enrolledStudents' }] } },
          students: { $sum: { $size: '$enrolledStudents' } }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    const performance = performanceStats[0] || { 
      averageRating: 0, 
      totalReviews: 0, 
      totalLectures: 0 
    };

    const totalLectures = await Lecture.countDocuments({ trainer: user._id });
    const completedLectures = await Lecture.countDocuments({ trainer: user._id, status: 'completed' });

    const result = {
      averageRating: Math.round((performance.averageRating || 0) * 10) / 10,
      totalReviews: performance.totalReviews,
      completionRate: totalLectures > 0 ? Math.round((completedLectures / totalLectures) * 100) : 0,
      attendanceRate: 85, // This would need more complex calculation
      monthlyProgress: monthlyProgress.map(month => ({
        month: `${month._id.year}-${month._id.month.toString().padStart(2, '0')}`,
        lectures: month.lectures,
        earnings: month.earnings,
        students: month.students
      }))
    };

    res.json(result);
  } catch (err) {
    console.error('Error fetching performance metrics:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;