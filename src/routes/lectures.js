const express = require('express');
const router = express.Router();
const Lecture = require('../models/Lecture');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { auth } = require('../middleware/auth');
const { PLATFORM_FEE_PERCENTAGE } = require('../config/razorpay');
const { sendEmail } = require('../services/emailService');

/**
 * @route   GET /api/lectures
 * @desc    Get all lectures (with filters)
 * @access  Public
 */
router.get('/', async(req, res) => {
    try {
        const {
            category,
            trainer,
            search,
            sortBy = 'scheduledAt',
            sortOrder = 'asc',
            page = 1,
            limit = 20
        } = req.query;

        // Build filter query - only show scheduled/live (approved) lectures to students
        // Pending and cancelled lectures are hidden from students
        let query = { isPublished: true, status: { $in: ['scheduled', 'live'] } };

        if (category && category !== 'all') {
            query.category = category;
        }

        // Note: Status filter is ignored for public endpoint to ensure only scheduled lectures are shown

        if (trainer) {
            query.trainer = trainer;
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } }
            ];
        }

        // Build sort object
        const sortObj = {};
        sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Execute query with pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const lectures = await Lecture.find(query)
            .populate('trainer', 'firstname lastname email avatar')
            .sort(sortObj)
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count for pagination
        const total = await Lecture.countDocuments(query);

        res.json({
            lectures,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / parseInt(limit)),
                total,
                limit: parseInt(limit)
            }
        });
    } catch (err) {
        console.error('Error fetching lectures:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   GET /api/lectures/:id
 * @desc    Get single lecture by ID
 * @access  Public
 */
router.get('/:id', async(req, res) => {
    try {
        const lecture = await Lecture.findById(req.params.id)
            .populate('trainer', 'firstname lastname email avatar bio expertise experience')
            .populate('enrolledStudents.student', 'firstname lastname email avatar')
            .populate('feedback.student', 'firstname lastname avatar');

        if (!lecture) {
            return res.status(404).json({ message: 'Lecture not found' });
        }

        res.json(lecture);
    } catch (err) {
        console.error('Error fetching lecture:', err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Lecture not found' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   POST /api/lectures
 * @desc    Create a new lecture
 * @access  Private (Trainer only)
 */
router.post('/', auth, async(req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.role !== 'trainer' || !user.isApproved) {
            return res.status(403).json({ message: 'Access denied. Approved trainers only.' });
        }

        // No UC requirement for creating lectures - they are free for trainers

        const {
            title,
            description,
            category,
            tags,
            price,
            duration,
            scheduledAt,
            maxStudents,
            meetingLink,
            materials
        } = req.body;

        // Validate required fields
        if (!title || !description || !category || !price || !duration || !scheduledAt) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }

        // Validate scheduled time is in the future
        const scheduledTime = new Date(scheduledAt);
        if (scheduledTime <= new Date()) {
            return res.status(400).json({ message: 'Scheduled time must be in the future' });
        }

        // Lectures are free for trainers - no UC deduction

        // Create new lecture
        const lecture = new Lecture({
            title,
            description,
            trainer: req.user.id,
            category,
            tags: tags || [],
            price: parseFloat(price),
            duration: parseInt(duration),
            scheduledAt: scheduledTime,
            maxStudents: parseInt(maxStudents) || 50,
            meetingLink,
            materials: materials || []
        });

        await lecture.save();

        // Populate trainer info before sending response
        await lecture.populate('trainer', 'firstname lastname email avatar');

        console.log(`Lecture created by ${user.email}. Lecture is pending admin approval.`);

        res.status(201).json({
            message: 'Lecture created successfully! It will be reviewed by admin before going live.',
            lecture
        });
    } catch (err) {
        console.error('Error creating lecture:', err.message);

        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(error => error.message);
            return res.status(400).json({
                message: 'Validation failed',
                errors
            });
        }

        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   PUT /api/lectures/:id
 * @desc    Update a lecture
 * @access  Private (Trainer who created it or Admin)
 */
router.put('/:id', auth, async(req, res) => {
    try {
        const lecture = await Lecture.findById(req.params.id);
        if (!lecture) {
            return res.status(404).json({ message: 'Lecture not found' });
        }

        const user = await User.findById(req.user.id);

        // Check if user can update this lecture
        if (user.role !== 'admin' && lecture.trainer.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Don't allow updates if lecture is live or completed
        if (lecture.status === 'live' || lecture.status === 'completed') {
            return res.status(400).json({ message: 'Cannot update lecture that is live or completed' });
        }

        const {
            title,
            description,
            category,
            tags,
            price,
            duration,
            scheduledAt,
            maxStudents,
            meetingLink,
            materials,
            status
        } = req.body;

        // Update fields
        if (title) lecture.title = title;
        if (description) lecture.description = description;
        if (category) lecture.category = category;
        if (tags) lecture.tags = tags;
        if (price !== undefined) lecture.price = parseFloat(price);
        if (duration) lecture.duration = parseInt(duration);
        if (scheduledAt) {
            const scheduledTime = new Date(scheduledAt);
            if (scheduledTime <= new Date()) {
                return res.status(400).json({ message: 'Scheduled time must be in the future' });
            }
            lecture.scheduledAt = scheduledTime;
        }
        if (maxStudents) lecture.maxStudents = parseInt(maxStudents);
        if (meetingLink) lecture.meetingLink = meetingLink;
        if (materials) lecture.materials = materials;
        if (status && ['scheduled', 'cancelled'].includes(status)) {
            lecture.status = status;
        }

        await lecture.save();
        await lecture.populate('trainer', 'firstname lastname email avatar');

        res.json({
            message: 'Lecture updated successfully',
            lecture
        });
    } catch (err) {
        console.error('Error updating lecture:', err.message);

        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(error => error.message);
            return res.status(400).json({
                message: 'Validation failed',
                errors
            });
        }

        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   DELETE /api/lectures/:id
 * @desc    Delete a lecture
 * @access  Private (Trainer who created it or Admin)
 */
router.delete('/:id', auth, async(req, res) => {
    try {
        const lecture = await Lecture.findById(req.params.id);
        if (!lecture) {
            return res.status(404).json({ message: 'Lecture not found' });
        }

        const user = await User.findById(req.user.id);

        // Check if user can delete this lecture
        if (user.role !== 'admin' && lecture.trainer.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Don't allow deletion if lecture is live or has enrolled students
        if (lecture.status === 'live') {
            return res.status(400).json({ message: 'Cannot delete lecture that is currently live' });
        }

        if (lecture.enrolledStudents.length > 0) {
            return res.status(400).json({ message: 'Cannot delete lecture with enrolled students' });
        }

        await Lecture.findByIdAndDelete(req.params.id);

        res.json({ message: 'Lecture deleted successfully' });
    } catch (err) {
        console.error('Error deleting lecture:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   POST /api/lectures/:id/enroll
 * @desc    Enroll in a lecture
 * @access  Private (Student only)
 */
router.post('/:id/enroll', auth, async(req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.role !== 'student') {
            return res.status(403).json({ message: 'Access denied. Students only.' });
        }

        const lecture = await Lecture.findById(req.params.id).populate('trainer');
        if (!lecture) {
            return res.status(404).json({ message: 'Lecture not found' });
        }

        // Check if lecture is available for enrollment
        if (lecture.status !== 'scheduled') {
            return res.status(400).json({ message: 'Lecture is not available for enrollment' });
        }

        if (lecture.isFull) {
            return res.status(400).json({ message: 'Lecture is full' });
        }

        // Check if already enrolled
        const alreadyEnrolled = lecture.enrolledStudents.some(
            enrollment => enrollment.student.toString() === req.user.id
        );

        if (alreadyEnrolled) {
            return res.status(400).json({ message: 'Already enrolled in this lecture' });
        }

        // Check if student has enough UpCoins
        if (user.walletBalance < lecture.price) {
            return res.status(400).json({
                message: `Insufficient UpCoins. Required: ${lecture.price}, Current: ${user.walletBalance}`,
                required: lecture.price,
                current: user.walletBalance
            });
        }

        // Calculate platform fee and trainer earnings
        const platformFee = Math.floor((lecture.price * PLATFORM_FEE_PERCENTAGE) / 100);
        const trainerEarnings = lecture.price - platformFee;

        // Deduct UpCoins from student
        const studentBalanceBefore = user.walletBalance;
        user.walletBalance -= lecture.price;
        user.totalSpent += lecture.price;
        await user.save();

        // Create student transaction
        const studentTransaction = new Transaction({
            user: user._id,
            type: 'debit',
            amount: lecture.price,
            realMoneyAmount: 0,
            currency: 'INR',
            description: `Enrolled in "${lecture.title}"`,
            category: 'lecture_enrollment',
            status: 'completed',
            paymentMethod: 'wallet',
            reference: `enrollment_${lecture._id}`,
            relatedLecture: lecture._id,
            balanceBefore: studentBalanceBefore,
            balanceAfter: user.walletBalance,
            metadata: {
                lectureTitle: lecture.title,
                trainerId: lecture.trainer._id,
                platformFee: platformFee
            }
        });
        await studentTransaction.save();

        // Credit trainer's wallet
        const trainer = await User.findById(lecture.trainer._id);
        const trainerBalanceBefore = trainer.walletBalance;
        trainer.walletBalance += trainerEarnings;
        trainer.totalEarned += trainerEarnings;
        await trainer.save();

        // Create trainer transaction
        const trainerTransaction = new Transaction({
            user: trainer._id,
            type: 'credit',
            amount: trainerEarnings,
            realMoneyAmount: 0,
            currency: 'INR',
            description: `Earnings from "${lecture.title}" (${PLATFORM_FEE_PERCENTAGE}% platform fee deducted)`,
            category: 'lecture_enrollment',
            status: 'completed',
            paymentMethod: 'wallet',
            reference: `earnings_${lecture._id}`,
            relatedLecture: lecture._id,
            balanceBefore: trainerBalanceBefore,
            balanceAfter: trainer.walletBalance,
            metadata: {
                lectureTitle: lecture.title,
                studentId: user._id,
                studentName: `${user.firstname} ${user.lastname}`,
                platformFee: platformFee,
                grossAmount: lecture.price,
                netAmount: trainerEarnings
            }
        });
        await trainerTransaction.save();

        // Add student to enrolled list
        await Lecture.updateOne({ _id: req.params.id }, {
            $push: {
                enrolledStudents: {
                    student: req.user.id,
                    enrolledAt: new Date()
                }
            }
        });

        // Get updated lecture for response
        const updatedLecture = await Lecture.findById(req.params.id);

        console.log(`Student ${user.email} enrolled in "${lecture.title}". Paid: ${lecture.price} UC. Trainer earned: ${trainerEarnings} UC (${platformFee} UC platform fee)`);

        res.json({
            message: 'Successfully enrolled in lecture',
            enrolledCount: updatedLecture.enrolledStudents.length,
            walletBalance: user.walletBalance,
            amountPaid: lecture.price,
            trainerEarned: trainerEarnings,
            platformFee: platformFee
        });
    } catch (err) {
        console.error('Error enrolling in lecture:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   DELETE /api/lectures/:id/enroll
 * @desc    Unenroll from a lecture
 * @access  Private (Student only)
 */
router.delete('/:id/enroll', auth, async(req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.role !== 'student') {
            return res.status(403).json({ message: 'Access denied. Students only.' });
        }

        const lecture = await Lecture.findById(req.params.id);
        if (!lecture) {
            return res.status(404).json({ message: 'Lecture not found' });
        }

        // Check if lecture can be unenrolled from (at least 2 hours before)
        const now = new Date();
        const scheduledTime = new Date(lecture.scheduledAt);
        const timeDiff = scheduledTime.getTime() - now.getTime();
        const hoursDiff = timeDiff / (1000 * 3600);

        if (hoursDiff < 2) {
            return res.status(400).json({ message: 'Cannot unenroll less than 2 hours before lecture' });
        }

        // Remove student from enrolled list
        lecture.enrolledStudents = lecture.enrolledStudents.filter(
            enrollment => enrollment.student.toString() !== req.user.id
        );

        await lecture.save();

        res.json({
            message: 'Successfully unenrolled from lecture',
            enrolledCount: lecture.enrolledStudents.length
        });
    } catch (err) {
        console.error('Error unenrolling from lecture:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   GET /api/lectures/trainer/:trainerId
 * @desc    Get lectures by trainer
 * @access  Public
 */
router.get('/trainer/:trainerId', async(req, res) => {
    try {
        const lectures = await Lecture.find({
                trainer: req.params.trainerId,
                isPublished: true
            })
            .populate('trainer', 'firstname lastname email avatar')
            .sort({ scheduledAt: 1 });

        res.json(lectures);
    } catch (err) {
        console.error('Error fetching trainer lectures:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   GET /api/lectures/my/lectures
 * @desc    Get current user's lectures (trainer) or enrolled lectures (student)
 * @access  Private
 */
router.get('/my/lectures', auth, async(req, res) => {
    try {
        const user = await User.findById(req.user.id);
        let lectures;

        if (user.role === 'trainer') {
            // Get trainer's lectures
            lectures = await Lecture.find({ trainer: req.user.id })
                .populate('trainer', 'firstname lastname email avatar')
                .sort({ scheduledAt: -1 });
        } else if (user.role === 'student') {
            // Get student's enrolled lectures
            lectures = await Lecture.find({
                    'enrolledStudents.student': req.user.id
                })
                .populate('trainer', 'firstname lastname email avatar')
                .sort({ scheduledAt: 1 });
        } else {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json(lectures);
    } catch (err) {
        console.error('Error fetching user lectures:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   POST /api/lectures/:id/review
 * @desc    Submit a review for a lecture
 * @access  Private (Student only)
 */
router.post('/:id/review', auth, async(req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.role !== 'student') {
            return res.status(403).json({ message: 'Access denied. Students only.' });
        }

        const { rating, comment } = req.body;

        // Validate rating
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rating must be between 1 and 5' });
        }

        const lecture = await Lecture.findById(req.params.id);
        if (!lecture) {
            return res.status(404).json({ message: 'Lecture not found' });
        }

        // Check if user is enrolled in this lecture
        const isEnrolled = lecture.enrolledStudents.some(
            enrollment => enrollment.student.toString() === req.user.id
        );

        if (!isEnrolled) {
            return res.status(403).json({ message: 'You must be enrolled in this lecture to review it' });
        }

        // Check if lecture is completed or past its scheduled time
        const now = new Date();
        const lectureTime = new Date(lecture.scheduledAt);
        const lectureEndTime = new Date(lectureTime.getTime() + (lecture.duration * 60 * 1000));

        if (lecture.status !== 'completed' && now < lectureEndTime) {
            return res.status(400).json({ message: 'You can only review lectures after they have been completed' });
        }

        // Check if user has already reviewed this lecture
        const existingReviewIndex = lecture.feedback.findIndex(
            feedback => feedback.student.toString() === req.user.id
        );

        const reviewData = {
            student: req.user.id,
            rating: parseInt(rating),
            comment: comment || '',
            createdAt: new Date()
        };

        if (existingReviewIndex !== -1) {
            // Update existing review
            lecture.feedback[existingReviewIndex] = reviewData;
        } else {
            // Add new review
            lecture.feedback.push(reviewData);
        }

        // Recalculate average rating
        const totalRating = lecture.feedback.reduce((sum, feedback) => sum + feedback.rating, 0);
        lecture.averageRating = totalRating / lecture.feedback.length;

        // Save without running validators to avoid scheduledAt validation
        await Lecture.updateOne({ _id: req.params.id }, {
            feedback: lecture.feedback,
            averageRating: lecture.averageRating
        });

        res.json({
            message: existingReviewIndex !== -1 ? 'Review updated successfully' : 'Review submitted successfully',
            review: reviewData,
            averageRating: lecture.averageRating
        });
    } catch (err) {
        console.error('Error submitting review:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   PATCH /api/lectures/:id/complete
 * @desc    Mark a lecture as completed
 * @access  Private (Trainer who created it or Admin)
 */
router.patch('/:id/complete', auth, async(req, res) => {
    try {
        const lecture = await Lecture.findById(req.params.id);
        if (!lecture) {
            return res.status(404).json({ message: 'Lecture not found' });
        }

        const user = await User.findById(req.user.id);

        // Check if user can complete this lecture
        if (user.role !== 'admin' && lecture.trainer.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Check if lecture can be completed
        if (lecture.status === 'completed') {
            return res.status(400).json({ message: 'Lecture is already completed' });
        }

        if (lecture.status === 'cancelled') {
            return res.status(400).json({ message: 'Cannot complete a cancelled lecture' });
        }

        // Update lecture status to completed
        await Lecture.updateOne({ _id: req.params.id }, {
            status: 'completed',
            updatedAt: new Date()
        });

        // Get updated lecture
        const updatedLecture = await Lecture.findById(req.params.id)
            .populate('trainer', 'firstname lastname email avatar');

        res.json({
            message: 'Lecture marked as completed successfully',
            lecture: updatedLecture
        });
    } catch (err) {
        console.error('Error completing lecture:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   GET /api/lectures/:id/reviews
 * @desc    Get reviews for a specific lecture
 * @access  Public
 */
router.get('/:id/reviews', async(req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const lecture = await Lecture.findById(req.params.id)
            .populate('feedback.student', 'firstname lastname avatar')
            .select('feedback averageRating');

        if (!lecture) {
            return res.status(404).json({ message: 'Lecture not found' });
        }

        // Sort reviews by creation date (newest first)
        const sortedFeedback = lecture.feedback.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Paginate results
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const paginatedFeedback = sortedFeedback.slice(skip, skip + parseInt(limit));

        res.json({
            reviews: paginatedFeedback,
            averageRating: lecture.averageRating,
            totalReviews: lecture.feedback.length,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(lecture.feedback.length / parseInt(limit)),
                total: lecture.feedback.length,
                limit: parseInt(limit)
            }
        });
    } catch (err) {
        console.error('Error fetching reviews:', err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Lecture not found' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   GET /api/lectures/stats/overview
 * @desc    Get lecture statistics
 * @access  Private (Admin only)
 */
router.get('/stats/overview', auth, async(req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const [
            totalLectures,
            scheduledLectures,
            completedLectures,
            cancelledLectures,
            totalEnrollments
        ] = await Promise.all([
            Lecture.countDocuments(),
            Lecture.countDocuments({ status: 'scheduled' }),
            Lecture.countDocuments({ status: 'completed' }),
            Lecture.countDocuments({ status: 'cancelled' }),
            Lecture.aggregate([
                { $unwind: '$enrolledStudents' },
                { $count: 'total' }
            ])
        ]);

        const totalRevenue = await Lecture.aggregate([
            { $group: { _id: null, total: { $sum: '$totalEarnings' } } }
        ]);

        res.json({
            totalLectures,
            scheduledLectures,
            completedLectures,
            cancelledLectures,
            totalEnrollments: totalEnrollments.length > 0 ? totalEnrollments[0].total : 0,
            totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0
        });
    } catch (err) {
        console.error('Error fetching lecture stats:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   POST /api/lectures/:id/start-meeting
 * @desc    Start meeting and notify enrolled students (Using GetStream.io Video)
 * @access  Private (Trainer who created it)
 */
router.post('/:id/start-meeting', auth, async(req, res) => {
    try {
        const lecture = await Lecture.findById(req.params.id).populate('trainer', 'firstname lastname email');

        if (!lecture) {
            return res.status(404).json({ message: 'Lecture not found' });
        }

        // Check if user is the trainer
        if (lecture.trainer._id.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Only the trainer can start the meeting' });
        }

        // Update lecture status to live
        lecture.status = 'live';
        const meetingLink = `${process.env.FRONTEND_URL}/meeting/${lecture._id}`;
        lecture.meetingLink = meetingLink;
        await lecture.save();

        // Create Stream call if Stream is configured
        try {
            const streamService = require('../services/streamService');
            if (streamService.isConfigured()) {
                await streamService.createOrGetCall(lecture._id.toString(), {
                    createdBy: req.user.id,
                    title: lecture.title,
                    description: lecture.description,
                    lectureId: lecture._id.toString()
                });
                console.log(`Stream call created for lecture: ${lecture._id}`);
            }
        } catch (streamError) {
            console.warn('Stream call creation failed (non-critical):', streamError.message);
        }

        // Get all enrolled students - handle both array of objects and array of IDs
        const studentIds = lecture.enrolledStudents.map(enrollment => 
            enrollment.student ? enrollment.student : enrollment
        );
        
        const enrolledStudents = await User.find({
            _id: { $in: studentIds }
        });

        // Send email notifications to all enrolled students
        const emailPromises = enrolledStudents.map(student => {
            const emailTemplate = {
                subject: `Live Lecture Started: ${lecture.title}`,
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">Live Lecture Started!</h2>
            <p>Hi ${student.firstname},</p>
            <p>The lecture "<strong>${lecture.title}</strong>" has started!</p>
            <p><strong>Trainer:</strong> ${lecture.trainer.firstname} ${lecture.trainer.lastname}</p>
            
            <div style="margin: 30px 0; text-align: center;">
              <a href="${meetingLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Join Meeting Now</a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">Or copy this link: <br><code style="background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px;">${meetingLink}</code></p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p>Best regards,<br><strong>UpScholar Team</strong></p>
          </div>
        `
            };

            return sendEmail(student.email, emailTemplate).catch(err => {
                console.error(`Failed to send email to ${student.email}:`, err);
            });
        });

        await Promise.all(emailPromises);

        console.log(`Meeting started for lecture: ${lecture.title}. Notified ${enrolledStudents.length} students. Using GetStream.io Video.`);

        res.json({
            success: true,
            message: `Meeting started! ${enrolledStudents.length} students notified.`,
            meetingLink,
            lecture,
            videoProvider: 'getstream'
        });

    } catch (err) {
        console.error('Error starting meeting:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;