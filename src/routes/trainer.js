const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Lecture = require('../models/Lecture');
const Transaction = require('../models/Transaction');
const { auth } = require('../middleware/auth');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');

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

/**
 * @route   GET /api/trainer/students
 * @desc    Get all students enrolled in trainer's lectures with progress
 * @access  Private (Trainer only)
 */
router.get('/students', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'trainer') {
      return res.status(403).json({ message: 'Access denied. Trainer only.' });
    }

    // Get all lectures by this trainer
    const lectures = await Lecture.find({ trainer: user._id })
      .populate('enrolledStudents.student', 'name email firstname lastname')
      .select('title enrolledStudents status scheduledAt');

    // Create a map to track unique students and their data
    const studentMap = new Map();

    lectures.forEach(lecture => {
      lecture.enrolledStudents.forEach(enrollment => {
        const studentId = enrollment.student._id.toString();
        const student = enrollment.student;

        if (!studentMap.has(studentId)) {
          studentMap.set(studentId, {
            id: studentId,
            name: student.name || `${student.firstname} ${student.lastname}`,
            email: student.email,
            enrolledCourses: [],
            totalLectures: 0,
            completedLectures: 0,
            attendedLectures: 0,
            enrolledDate: enrollment.enrolledAt,
            lastActive: enrollment.enrolledAt
          });
        }

        const studentData = studentMap.get(studentId);
        
        // Add course to enrolled courses if not already added
        if (!studentData.enrolledCourses.find(c => c.lectureId === lecture._id.toString())) {
          studentData.enrolledCourses.push({
            lectureId: lecture._id.toString(),
            lectureTitle: lecture.title,
            status: lecture.status,
            scheduledAt: lecture.scheduledAt,
            attended: enrollment.attended
          });
        }

        // Count lectures
        studentData.totalLectures++;
        if (lecture.status === 'completed') {
          studentData.completedLectures++;
          if (enrollment.attended) {
            studentData.attendedLectures++;
          }
        }

        // Update last active date
        if (new Date(enrollment.enrolledAt) > new Date(studentData.lastActive)) {
          studentData.lastActive = enrollment.enrolledAt;
        }

        // Update earliest enrollment date
        if (new Date(enrollment.enrolledAt) < new Date(studentData.enrolledDate)) {
          studentData.enrolledDate = enrollment.enrolledAt;
        }
      });
    });

    // Convert map to array and calculate progress
    const students = Array.from(studentMap.values()).map(student => {
      const progress = student.totalLectures > 0 
        ? Math.round((student.completedLectures / student.totalLectures) * 100)
        : 0;
      
      // Determine status based on last active date
      const daysSinceActive = Math.floor((Date.now() - new Date(student.lastActive).getTime()) / (1000 * 60 * 60 * 24));
      let status = 'active';
      if (progress === 100) {
        status = 'completed';
      } else if (daysSinceActive > 7) {
        status = 'inactive';
      }

      return {
        ...student,
        progress,
        status,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random`
      };
    });

    // Sort by enrollment date (most recent first)
    students.sort((a, b) => new Date(b.enrolledDate) - new Date(a.enrolledDate));

    res.json(students);
  } catch (err) {
    console.error('Error fetching trainer students:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/trainer/students/course-stats
 * @desc    Get course-wise student statistics for trainer
 * @access  Private (Trainer only)
 */
router.get('/students/course-stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'trainer') {
      return res.status(403).json({ message: 'Access denied. Trainer only.' });
    }

    // Get course statistics grouped by lecture title
    const courseStats = await Lecture.aggregate([
      { $match: { trainer: user._id } },
      {
        $group: {
          _id: '$title',
          totalStudents: { $sum: { $size: '$enrolledStudents' } },
          completedLectures: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          },
          totalLectures: { $sum: 1 },
          averageRating: { $avg: '$averageRating' },
          activeStudents: {
            $sum: {
              $cond: [
                { $in: ['$status', ['scheduled', 'live']] },
                { $size: '$enrolledStudents' },
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          course: '$_id',
          totalStudents: 1,
          activeStudents: 1,
          averageProgress: {
            $cond: [
              { $gt: ['$totalLectures', 0] },
              { $multiply: [{ $divide: ['$completedLectures', '$totalLectures'] }, 100] },
              0
            ]
          },
          completionRate: {
            $cond: [
              { $gt: ['$totalLectures', 0] },
              { $multiply: [{ $divide: ['$completedLectures', '$totalLectures'] }, 100] },
              0
            ]
          }
        }
      },
      { $sort: { totalStudents: -1 } }
    ]);

    const formattedStats = courseStats.map(stat => ({
      course: stat.course,
      totalStudents: stat.totalStudents,
      activeStudents: stat.activeStudents,
      averageProgress: Math.round(stat.averageProgress),
      completionRate: Math.round(stat.completionRate)
    }));

    res.json(formattedStats);
  } catch (err) {
    console.error('Error fetching course stats:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/trainer/students/send-email
 * @desc    Send email to a student
 * @access  Private (Trainer only)
 */
router.post('/students/send-email', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'trainer') {
      return res.status(403).json({ message: 'Access denied. Trainer only.' });
    }

    const { studentId, subject, content } = req.body;

    // Validate input
    if (!studentId || !subject || !content) {
      return res.status(400).json({ message: 'Student ID, subject, and content are required' });
    }

    // Get student details
    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Verify that the student is enrolled in at least one of the trainer's lectures
    const enrollment = await Lecture.findOne({
      trainer: user._id,
      'enrolledStudents.student': studentId
    });

    if (!enrollment) {
      return res.status(403).json({ message: 'You can only send emails to your enrolled students' });
    }

    // Create email transporter
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD
      }
    });

    // Email options
    const mailOptions = {
      from: `${user.name} <${process.env.EMAIL_USER}>`,
      to: student.email,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="color: #333; margin: 0;">Message from ${user.name}</h2>
            <p style="color: #666; margin: 5px 0 0 0;">Your Trainer on UpScholar</p>
          </div>
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0;">
            <div style="white-space: pre-wrap; color: #333; line-height: 1.6;">
              ${content}
            </div>
          </div>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 0 0 8px 8px; text-align: center;">
            <p style="color: #666; font-size: 12px; margin: 0;">
              This email was sent from UpScholar Learning Platform
            </p>
          </div>
        </div>
      `,
      text: content
    };

    // Send email
    await transporter.sendMail(mailOptions);

    res.json({ 
      success: true, 
      message: 'Email sent successfully',
      recipient: student.email
    });
  } catch (err) {
    console.error('Error sending email:', err.message);
    
    // Check if it's an email configuration error
    if (err.message.includes('auth') || err.message.includes('credentials')) {
      return res.status(500).json({ 
        message: 'Email service not configured. Please contact administrator.' 
      });
    }
    
    res.status(500).json({ message: 'Failed to send email. Please try again.' });
  }
});

/**
 * @route   GET /api/trainer/profile
 * @desc    Get trainer profile details
 * @access  Private (Trainer only)
 */
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'trainer') {
      return res.status(403).json({ message: 'Access denied. Trainer only.' });
    }

    // Get trainer profile with all details
    const trainer = await User.findById(req.user.id).select('-password');

    // Get additional stats
    const totalLectures = await Lecture.countDocuments({ trainer: req.user.id });
    const upcomingLectures = await Lecture.countDocuments({ 
      trainer: req.user.id,
      status: 'scheduled',
      scheduledAt: { $gte: new Date() }
    });
    const completedLectures = await Lecture.countDocuments({ 
      trainer: req.user.id,
      status: 'completed'
    });

    // Get total students enrolled
    const lectures = await Lecture.find({ trainer: req.user.id });
    const uniqueStudents = new Set();
    lectures.forEach(lecture => {
      lecture.enrolledStudents.forEach(enrollment => {
        uniqueStudents.add(enrollment.student.toString());
      });
    });

    res.json({
      ...trainer.toObject(),
      stats: {
        totalLectures,
        upcomingLectures,
        completedLectures,
        totalStudents: uniqueStudents.size
      }
    });
  } catch (err) {
    console.error('Error fetching trainer profile:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PUT /api/trainer/profile
 * @desc    Update trainer profile
 * @access  Private (Trainer only)
 */
router.put('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'trainer') {
      return res.status(403).json({ message: 'Access denied. Trainer only.' });
    }

    const { firstname, lastname, bio, demoVideoUrl, expertise } = req.body;

    // Build update object
    const updateFields = {};
    if (firstname) updateFields.firstname = firstname;
    if (lastname) updateFields.lastname = lastname;
    if (bio) updateFields.bio = bio;
    if (demoVideoUrl) updateFields.demoVideoUrl = demoVideoUrl;
    if (expertise) updateFields.expertise = expertise;
    // Note: experience cannot be updated by trainer, only by admin

    // Update name if first or last name changed
    if (firstname || lastname) {
      const currentUser = await User.findById(req.user.id);
      updateFields.name = `${firstname || currentUser.firstname} ${lastname || currentUser.lastname}`;
    }

    const updatedTrainer = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true }
    ).select('-password');

    res.json({
      message: 'Profile updated successfully',
      trainer: updatedTrainer
    });
  } catch (err) {
    console.error('Error updating trainer profile:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PUT /api/trainer/change-password
 * @desc    Change trainer password
 * @access  Private (Trainer only)
 */
router.put('/change-password', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'trainer') {
      return res.status(403).json({ message: 'Access denied. Trainer only.' });
    }

    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    // Validate new password strength
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    // Get user with password
    const trainer = await User.findById(req.user.id);

    // Check if user has a password (some trainers might not have one initially)
    if (!trainer.password) {
      return res.status(400).json({ 
        message: 'No password set. Please contact admin to set up your password.' 
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, trainer.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    trainer.password = await bcrypt.hash(newPassword, salt);
    await trainer.save();

    res.json({ 
      success: true,
      message: 'Password changed successfully' 
    });
  } catch (err) {
    console.error('Error changing password:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;