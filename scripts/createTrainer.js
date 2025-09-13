const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
require("dotenv").config();

// Import User model
const User = require("../src/models/User");

const createTrainerUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Check if trainer already exists
    const existingTrainer = await User.findOne({
      email: "trainer@upscholer.com",
    });
    if (existingTrainer) {
      console.log("Trainer user already exists");
      process.exit(0);
    }

    // Create trainer user
    const trainerUser = new User({
      name: "Test Trainer",
      firstname: "Test",
      lastname: "Trainer",
      email: "trainer@upscholer.com",
      password: "trainer123456", // This will be hashed by the pre-save hook
      role: "trainer",
      isApproved: true,
      status: "approved",
      walletBalance: 0,
      totalEarned: 1250,
      totalSpent: 0,
      expertise: ["JavaScript", "React", "Node.js"],
      experience: 5,
      bio: "Experienced full-stack developer and educator with 5+ years of teaching experience.",
      resume: "uploads/trainer-resume.pdf",
      demoVideoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });

    await trainerUser.save();
    console.log("Trainer user created successfully!");
    console.log("Email: trainer@upscholer.com");
    console.log("Password: trainer123456");
    console.log("Please change the password after first login.");
  } catch (error) {
    console.error("Error creating trainer user:", error);
  } finally {
    mongoose.connection.close();
  }
};

createTrainerUser();
