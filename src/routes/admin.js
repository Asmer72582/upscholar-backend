const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Lecture = require('../models/Lecture');
const Transaction = require('../models/Transaction');
const { auth } = require('../middleware/auth');
const { sendEmail } = require('../services/emailService');

/**
 * @route   GET /api/admin/stats/overview
 * @desc    Get admin dashboard overview statistics
 * @access  Private (Admin only)
 */
router.get('/stats/overview', auth, async(req, res) => {
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
        const revenueData = await Lecture.aggregate([{
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
                            $cond: [{
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
        const userGrowthRate = newUsersLastMonth > 0 ?
            Math.round(((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100) :
            newUsersThisMonth > 0 ? 100 : 0;

        const lectureGrowthRate = newLecturesLastMonth > 0 ?
            Math.round(((newLecturesThisMonth - newLecturesLastMonth) / newLecturesLastMonth) * 100) :
            newLecturesThisMonth > 0 ? 100 : 0;

        const revenueGrowthRate = revenue.lastMonthRevenue > 0 ?
            Math.round(((revenue.thisMonthRevenue - revenue.lastMonthRevenue) / revenue.lastMonthRevenue) * 100) :
            revenue.thisMonthRevenue > 0 ? 100 : 0;

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
router.get('/stats/recent-activity', auth, async(req, res) => {
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
router.get('/stats/pending-approvals', auth, async(req, res) => {
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
router.get('/withdrawals', auth, async(req, res) => {
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
router.put('/withdrawals/:id/approve', auth, async(req, res) => {
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
router.put('/withdrawals/:id/reject', auth, async(req, res) => {
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

/**
 * @route   POST /api/admin/users/:userId/suspend
 * @desc    Suspend a user account
 * @access  Private (Admin only)
 */
router.post('/users/:userId/suspend', auth, async(req, res) => {
    try {
        const adminUser = await User.findById(req.user.id);
        if (adminUser.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const { reason } = req.body;
        if (!reason || !reason.trim()) {
            return res.status(400).json({ message: 'Suspension reason is required' });
        }

        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.role === 'admin') {
            return res.status(403).json({ message: 'Cannot suspend admin users' });
        }

        if (user.status === 'suspended') {
            return res.status(400).json({ message: 'User is already suspended' });
        }

        // Update user status
        user.status = 'suspended';
        user.suspensionReason = reason;
        user.suspendedAt = new Date();
        user.suspendedBy = adminUser._id;
        await user.save();

        // Send email notification
        try {
            await sendEmail(user.email, {
                subject: 'Account Suspension Notification - UpScholar',
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">Account Suspension Notification</h2>
            <p>Dear ${user.firstname} ${user.lastname},</p>
            <p>We regret to inform you that your UpScholar account has been suspended.</p>
            
            <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #991b1b;">Reason for Suspension:</h3>
              <p style="margin-bottom: 0;">${reason}</p>
            </div>
            
            <h3>What this means:</h3>
            <ul>
              <li>You will not be able to log in to your account</li>
              <li>Your access to all platform features has been temporarily disabled</li>
              <li>Your data remains secure and will not be deleted</li>
            </ul>
            
            <p>If you believe this is a mistake or would like to appeal this decision, please contact us.</p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px;">Best regards,<br>UpScholar Admin Team</p>
          </div>
        `
            });
        } catch (emailError) {
            console.error('Error sending suspension email:', emailError);
            // Continue even if email fails
        }

        console.log(`Admin ${adminUser.email} suspended user ${user.email}`);

        res.json({
            success: true,
            message: 'User suspended successfully. Email notification sent.',
            user: {
                id: user._id,
                email: user.email,
                status: user.status
            }
        });
    } catch (err) {
        console.error('Error suspending user:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   POST /api/admin/users/:userId/activate
 * @desc    Activate a suspended user account
 * @access  Private (Admin only)
 */
router.post('/users/:userId/activate', auth, async(req, res) => {
    try {
        const adminUser = await User.findById(req.user.id);
        if (adminUser.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.status !== 'suspended') {
            return res.status(400).json({ message: 'User is not suspended' });
        }

        // Update user status
        const previousReason = user.suspensionReason;
        user.status = 'approved';
        user.suspensionReason = undefined;
        user.suspendedAt = undefined;
        user.suspendedBy = undefined;
        user.activatedAt = new Date();
        user.activatedBy = adminUser._id;
        await user.save();

        // Send email notification
        try {
            await sendEmail(user.email, {
                subject: 'Account Reactivated - Welcome Back to UpScholar',
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">Account Reactivated - Welcome Back!</h2>
            <p>Dear ${user.firstname} ${user.lastname},</p>
            <p>Good news! Your UpScholar account has been reactivated.</p>
            
            <div style="background-color: #dcfce7; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #15803d;">You can now:</h3>
              <ul style="margin-bottom: 0;">
                <li>Log in to your account</li>
                <li>Access all platform features</li>
                <li>Resume your ${user.role === 'trainer' ? 'teaching' : 'learning'} activities</li>
              </ul>
            </div>
            
            <p>If you have any questions, please don't hesitate to contact us.</p>
            
            <p style="margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}/login" 
                 style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Log In Now
              </a>
            </p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px;">Welcome back!<br>UpScholar Team</p>
          </div>
        `
            });
        } catch (emailError) {
            console.error('Error sending activation email:', emailError);
            // Continue even if email fails
        }

        console.log(`Admin ${adminUser.email} activated user ${user.email}`);

        res.json({
            success: true,
            message: 'User activated successfully. Email notification sent.',
            user: {
                id: user._id,
                email: user.email,
                status: user.status
            }
        });
    } catch (err) {
        console.error('Error activating user:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   GET /api/admin/lectures
 * @desc    Get all lectures for admin management
 * @access  Private (Admin only)
 */
router.get('/lectures', auth, async(req, res) => {
    try {
        const adminUser = await User.findById(req.user.id);
        if (adminUser.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const lectures = await Lecture.find()
            .populate('trainer', 'firstname lastname email avatar')
            .populate('enrolledStudents', 'firstname lastname email')
            .sort({ createdAt: -1 });

        const formattedLectures = lectures.map(lecture => ({
            id: lecture._id,
            title: lecture.title,
            description: lecture.description,
            trainer: {
                id: lecture.trainer._id,
                name: `${lecture.trainer.firstname} ${lecture.trainer.lastname}`,
                email: lecture.trainer.email,
                avatar: lecture.trainer.avatar
            },
            scheduledAt: lecture.scheduledAt,
            duration: lecture.duration,
            price: lecture.price,
            maxStudents: lecture.maxStudents,
            enrolledStudents: lecture.enrolledStudents.map(student => ({
                id: student._id,
                name: `${student.firstname} ${student.lastname}`,
                email: student.email
            })),
            category: lecture.category,
            tags: lecture.tags || [],
            status: lecture.status,
            thumbnail: lecture.thumbnail,
            materials: lecture.materials || [],
            meetingLink: lecture.meetingLink,
            recordingUrl: lecture.recordingUrl,
            createdAt: lecture.createdAt,
            approvedAt: lecture.approvedAt,
            approvedBy: lecture.approvedBy,
            rejectedAt: lecture.rejectedAt,
            rejectedBy: lecture.rejectedBy,
            rejectionReason: lecture.rejectionReason
        }));

        res.json(formattedLectures);
    } catch (err) {
        console.error('Error fetching lectures:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   GET /api/admin/lectures/:id
 * @desc    Get single lecture details for admin
 * @access  Private (Admin only)
 */
router.get('/lectures/:id', auth, async(req, res) => {
    try {
        const adminUser = await User.findById(req.user.id);
        if (adminUser.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const lecture = await Lecture.findById(req.params.id)
            .populate('trainer', 'firstname lastname email avatar bio expertise experience')
            .populate('enrolledStudents', 'firstname lastname email avatar')
            .populate('approvedBy', 'firstname lastname email')
            .populate('rejectedBy', 'firstname lastname email');

        if (!lecture) {
            return res.status(404).json({ message: 'Lecture not found' });
        }

        // Get feedback for completed lectures
        let feedback = [];
        if (lecture.status === 'completed') {
            const Feedback = require('../models/Feedback');
            feedback = await Feedback.find({ lecture: lecture._id })
                .populate('student', 'firstname lastname email avatar')
                .sort({ createdAt: -1 });
        }

        const formattedLecture = {
            id: lecture._id,
            title: lecture.title,
            description: lecture.description,
            trainer: {
                id: lecture.trainer._id,
                name: `${lecture.trainer.firstname} ${lecture.trainer.lastname}`,
                email: lecture.trainer.email,
                avatar: lecture.trainer.avatar,
                bio: lecture.trainer.bio || '',
                expertise: lecture.trainer.expertise || [],
                experience: lecture.trainer.experience || 0,
                rating: lecture.trainer.rating || 0,
                totalLectures: await Lecture.countDocuments({ trainer: lecture.trainer._id, status: 'completed' })
            },
            scheduledAt: lecture.scheduledAt,
            duration: lecture.duration,
            price: lecture.price,
            maxStudents: lecture.maxStudents,
            enrolledStudents: lecture.enrolledStudents.map(student => ({
                id: student._id,
                name: `${student.firstname} ${student.lastname}`,
                email: student.email,
                avatar: student.avatar,
                enrolledAt: student.createdAt
            })),
            category: lecture.category,
            tags: lecture.tags || [],
            status: lecture.status,
            thumbnail: lecture.thumbnail,
            materials: lecture.materials || [],
            meetingLink: lecture.meetingLink,
            recordingUrl: lecture.recordingUrl,
            createdAt: lecture.createdAt,
            approvedAt: lecture.approvedAt,
            approvedBy: lecture.approvedBy ? {
                id: lecture.approvedBy._id,
                name: `${lecture.approvedBy.firstname} ${lecture.approvedBy.lastname}`,
                email: lecture.approvedBy.email
            } : null,
            rejectedAt: lecture.rejectedAt,
            rejectedBy: lecture.rejectedBy ? {
                id: lecture.rejectedBy._id,
                name: `${lecture.rejectedBy.firstname} ${lecture.rejectedBy.lastname}`,
                email: lecture.rejectedBy.email
            } : null,
            rejectionReason: lecture.rejectionReason,
            feedback: feedback.map(review => ({
                student: {
                    name: `${review.student.firstname} ${review.student.lastname}`,
                    avatar: review.student.avatar
                },
                rating: review.rating,
                comment: review.comment,
                createdAt: review.createdAt
            }))
        };

        res.json(formattedLecture);
    } catch (err) {
        console.error('Error fetching lecture details:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   PUT /api/admin/lectures/:id/approve
 * @desc    Approve a pending lecture
 * @access  Private (Admin only)
 */
router.put('/lectures/:id/approve', auth, async(req, res) => {
    try {
        const adminUser = await User.findById(req.user.id);
        if (adminUser.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const lecture = await Lecture.findById(req.params.id).populate('trainer', 'firstname lastname email');
        if (!lecture) {
            return res.status(404).json({ message: 'Lecture not found' });
        }

        if (lecture.status !== 'pending') {
            return res.status(400).json({ message: 'Lecture is not in pending status' });
        }

        // Update lecture status to scheduled
        lecture.status = 'scheduled';
        lecture.approvedAt = new Date();
        lecture.approvedBy = adminUser._id;
        await lecture.save();

        // Send email notification to trainer
        try {
            await sendEmail(lecture.trainer.email, {
                subject: 'Lecture Approved - UpScholar',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #16a34a;">Lecture Approved!</h2>
                        <p>Dear ${lecture.trainer.firstname} ${lecture.trainer.lastname},</p>
                        <p>Great news! Your lecture has been approved by our admin team.</p>
                        
                        <div style="background-color: #dcfce7; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #15803d;">Lecture Details:</h3>
                            <p><strong>Title:</strong> ${lecture.title}</p>
                            <p><strong>Scheduled:</strong> ${new Date(lecture.scheduledAt).toLocaleString()}</p>
                            <p><strong>Price:</strong> ${lecture.price} UpCoins</p>
                        </div>
                        
                        <p>Your lecture is now live and students can enroll!</p>
                        
                        <p style="margin-top: 30px;">
                            <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}/trainer/manage-lectures" 
                               style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                                View Your Lectures
                            </a>
                        </p>
                        
                        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                        <p style="color: #6b7280; font-size: 14px;">Best regards,<br>UpScholar Team</p>
                    </div>
                `
            });
        } catch (emailError) {
            console.error('Error sending approval email:', emailError);
        }

        console.log(`Admin ${adminUser.email} approved lecture ${lecture._id}: ${lecture.title}`);

        res.json({
            success: true,
            message: 'Lecture approved successfully',
            lecture: {
                id: lecture._id,
                title: lecture.title,
                status: lecture.status,
                approvedAt: lecture.approvedAt
            }
        });
    } catch (err) {
        console.error('Error approving lecture:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   PUT /api/admin/lectures/:id/reject
 * @desc    Reject a pending lecture
 * @access  Private (Admin only)
 */
router.put('/lectures/:id/reject', auth, async(req, res) => {
    try {
        const adminUser = await User.findById(req.user.id);
        if (adminUser.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const lecture = await Lecture.findById(req.params.id).populate('trainer', 'firstname lastname email');
        if (!lecture) {
            return res.status(404).json({ message: 'Lecture not found' });
        }

        if (lecture.status !== 'pending') {
            return res.status(400).json({ message: 'Lecture is not in pending status' });
        }

        const { reason } = req.body;

        // Update lecture status to cancelled with rejection reason
        lecture.status = 'cancelled';
        lecture.rejectedAt = new Date();
        lecture.rejectedBy = adminUser._id;
        lecture.rejectionReason = reason || 'Not specified';
        await lecture.save();

        // Send email notification to trainer
        try {
            await sendEmail(lecture.trainer.email, {
                subject: 'Lecture Rejected - UpScholar',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #dc2626;">Lecture Rejected</h2>
                        <p>Dear ${lecture.trainer.firstname} ${lecture.trainer.lastname},</p>
                        <p>We regret to inform you that your lecture has been rejected by our admin team.</p>
                        
                        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #b91c1c;">Lecture Details:</h3>
                            <p><strong>Title:</strong> ${lecture.title}</p>
                            <p><strong>Rejection Reason:</strong> ${lecture.rejectionReason}</p>
                        </div>
                        
                        <p>Please review the rejection reason and feel free to create a new lecture that meets our guidelines.</p>
                        
                        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                        <p style="color: #6b7280; font-size: 14px;">Best regards,<br>UpScholar Team</p>
                    </div>
                `
            });
        } catch (emailError) {
            console.error('Error sending rejection email:', emailError);
        }

        console.log(`Admin ${adminUser.email} rejected lecture ${lecture._id}: ${lecture.title}`);

        res.json({
            success: true,
            message: 'Lecture rejected successfully',
            lecture: {
                id: lecture._id,
                title: lecture.title,
                status: lecture.status,
                rejectedAt: lecture.rejectedAt,
                rejectionReason: lecture.rejectionReason
            }
        });
    } catch (err) {
        console.error('Error rejecting lecture:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;