const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('../src/models/User');
const Lecture = require('../src/models/Lecture');
const Transaction = require('../src/models/Transaction');

const createSampleData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find the trainer user
    const trainer = await User.findOne({ email: 'trainer@upscholer.com' });
    if (!trainer) {
      console.log('Trainer user not found. Please create trainer first.');
      process.exit(1);
    }

    // Find some student users
    const students = await User.find({ role: 'student' }).limit(5);
    console.log(`Found ${students.length} students`);

    // Create sample lectures
    const sampleLectures = [
      {
        title: 'Introduction to React Hooks',
        description: 'Learn the fundamentals of React Hooks and how to use them effectively in your applications.',
        trainer: trainer._id,
        category: 'Web Development',
        tags: ['React', 'JavaScript', 'Frontend'],
        price: 75,
        duration: 90,
        scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        maxStudents: 25,
        status: 'scheduled',
        isPublished: true
      },
      {
        title: 'Advanced TypeScript Patterns',
        description: 'Master advanced TypeScript patterns and techniques for building robust applications.',
        trainer: trainer._id,
        category: 'Programming',
        tags: ['TypeScript', 'JavaScript', 'Advanced'],
        price: 100,
        duration: 120,
        scheduledAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        maxStudents: 20,
        status: 'scheduled',
        isPublished: true
      },
      {
        title: 'Node.js Best Practices',
        description: 'Learn industry best practices for building scalable Node.js applications.',
        trainer: trainer._id,
        category: 'Programming',
        tags: ['Node.js', 'JavaScript', 'Backend'],
        price: 85,
        duration: 105,
        scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Will be updated later
        maxStudents: 30,
        status: 'scheduled',
        isPublished: true
      },
      {
        title: 'JavaScript Fundamentals',
        description: 'Master the core concepts of JavaScript programming language.',
        trainer: trainer._id,
        category: 'Programming',
        tags: ['JavaScript', 'Fundamentals', 'Beginner'],
        price: 50,
        duration: 75,
        scheduledAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Will be updated later
        maxStudents: 40,
        status: 'scheduled',
        isPublished: true
      }
    ];

    // Create lectures
    const createdLectures = [];
    for (const lectureData of sampleLectures) {
      const lecture = new Lecture(lectureData);
      
      // Add enrolled students for some lectures
      if (students.length > 0) {
        const numEnrolled = Math.min(students.length, Math.floor(Math.random() * lectureData.maxStudents * 0.8));
        for (let i = 0; i < numEnrolled; i++) {
          lecture.enrolledStudents.push({
            student: students[i % students.length]._id,
            enrolledAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date in last 30 days
            attended: lectureData.status === 'completed' ? Math.random() > 0.2 : false // 80% attendance for completed lectures
          });
        }
      }

      await lecture.save();
      createdLectures.push(lecture);
      console.log(`Created lecture: ${lecture.title}`);
    }

    // Update the last two lectures to be completed (bypass validation)
    const lectureToComplete1 = createdLectures[2]; // Node.js Best Practices
    const lectureToComplete2 = createdLectures[3]; // JavaScript Fundamentals

    if (lectureToComplete1) {
      await Lecture.findByIdAndUpdate(lectureToComplete1._id, {
        status: 'completed',
        scheduledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        averageRating: 4.8,
        feedback: [
          {
            student: students[0]?._id,
            rating: 5,
            comment: 'Excellent lecture! Very informative and well-structured.',
            createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
          },
          {
            student: students[1]?._id,
            rating: 4,
            comment: 'Great content, learned a lot about Node.js best practices.',
            createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
          }
        ]
      });
      lectureToComplete1.status = 'completed';
    }

    if (lectureToComplete2) {
      await Lecture.findByIdAndUpdate(lectureToComplete2._id, {
        status: 'completed',
        scheduledAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        averageRating: 4.6,
        feedback: [
          {
            student: students[2]?._id,
            rating: 5,
            comment: 'Perfect for beginners! Clear explanations and good examples.',
            createdAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000)
          }
        ]
      });
      lectureToComplete2.status = 'completed';
    }

    // Create sample transactions for completed lectures
    const completedLectures = [lectureToComplete1, lectureToComplete2].filter(Boolean);
    for (const lecture of completedLectures) {
      for (const enrollment of lecture.enrolledStudents) {
        // Get student's current balance
        const student = await User.findById(enrollment.student);
        const balanceBefore = student.walletBalance;
        const balanceAfter = balanceBefore - lecture.price;

        // Create debit transaction for student
        const studentTransaction = new Transaction({
          user: enrollment.student,
          type: 'debit',
          amount: lecture.price,
          description: `Enrollment in lecture: ${lecture.title}`,
          category: 'lecture_enrollment',
          status: 'completed',
          balanceBefore: balanceBefore,
          balanceAfter: balanceAfter,
          relatedLecture: lecture._id,
          metadata: {
            lecture: lecture._id,
            lectureTitle: lecture.title,
            trainer: trainer._id
          },
          createdAt: enrollment.enrolledAt
        });
        await studentTransaction.save();

        // Update student balance
        await User.findByIdAndUpdate(enrollment.student, {
          walletBalance: balanceAfter,
          totalSpent: (student.totalSpent || 0) + lecture.price
        });

        // Create credit transaction for trainer
        const trainerBalanceBefore = trainer.walletBalance || 0;
        const trainerBalanceAfter = trainerBalanceBefore + lecture.price;

        const trainerTransaction = new Transaction({
          user: trainer._id,
          type: 'credit',
          amount: lecture.price,
          description: `Earnings from lecture: ${lecture.title}`,
          category: 'lecture_enrollment',
          status: 'completed',
          balanceBefore: trainerBalanceBefore,
          balanceAfter: trainerBalanceAfter,
          relatedLecture: lecture._id,
          metadata: {
            lecture: lecture._id,
            lectureTitle: lecture.title,
            student: enrollment.student
          },
          createdAt: enrollment.enrolledAt
        });
        await trainerTransaction.save();

        // Update trainer balance
        trainer.walletBalance = trainerBalanceAfter;
      }
    }

    // Update trainer's total earned
    const totalEarned = completedLectures.reduce((sum, lecture) => {
      return sum + (lecture.price * lecture.enrolledStudents.length);
    }, 0);

    await User.findByIdAndUpdate(trainer._id, {
      totalEarned: totalEarned + 1250 // Add to existing earnings
    });

    console.log('Sample data created successfully!');
    console.log(`Created ${createdLectures.length} lectures`);
    console.log(`Total earnings: ${totalEarned} UC`);

  } catch (error) {
    console.error('Error creating sample data:', error);
  } finally {
    mongoose.connection.close();
  }
};

createSampleData();