const express = require('express');
const router = express.Router();
const Lecture = require('../models/Lecture');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

/**
 * @route   GET /api/lectures
 * @desc    Get all lectures (with filters)
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const {
      category,
      status,
      trainer,
      search,
      sortBy = 'scheduledAt',
      sortOrder = 'asc',
      page = 1,
      limit = 20
    } = req.query;

    // Build filter query
    let query = { isPublished: true };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

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
router.get('/:id', async (req, res) => {
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
router.post('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'trainer' || !user.isApproved) {
      return res.status(403).json({ message: 'Access denied. Approved trainers only.' });
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

    res.status(201).json({
      message: 'Lecture created successfully',
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
router.put('/:id', auth, async (req, res) => {
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
router.delete('/:id', auth, async (req, res) => {
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
router.post('/:id/enroll', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'student') {
      return res.status(403).json({ message: 'Access denied. Students only.' });
    }

    const lecture = await Lecture.findById(req.params.id);
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

    // Add student to enrolled list using updateOne to avoid validation
    await Lecture.updateOne(
      { _id: req.params.id },
      { 
        $push: { 
          enrolledStudents: {
            student: req.user.id,
            enrolledAt: new Date()
          }
        }
      }
    );

    // Get updated lecture for response
    const updatedLecture = await Lecture.findById(req.params.id);

    res.json({
      message: 'Successfully enrolled in lecture',
      enrolledCount: updatedLecture.enrolledStudents.length
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
router.delete('/:id/enroll', auth, async (req, res) => {
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
router.get('/trainer/:trainerId', async (req, res) => {
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
router.get('/my/lectures', auth, async (req, res) => {
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
router.post('/:id/review', auth, async (req, res) => {
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
    await Lecture.updateOne(
      { _id: req.params.id },
      { 
        feedback: lecture.feedback,
        averageRating: lecture.averageRating
      }
    );

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
router.patch('/:id/complete', auth, async (req, res) => {
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
    await Lecture.updateOne(
      { _id: req.params.id },
      { 
        status: 'completed',
        updatedAt: new Date()
      }
    );

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
router.get('/:id/reviews', async (req, res) => {
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
router.get('/stats/overview', auth, async (req, res) => {
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
      totalEnrollments: totalEnrollments[0]?.total || 0,
      totalRevenue: totalRevenue[0]?.total || 0
    });
  } catch (err) {
    console.error('Error fetching lecture stats:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;