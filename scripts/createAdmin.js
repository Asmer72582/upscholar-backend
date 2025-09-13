const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Import User model
const User = require('../src/models/User');

const createAdminUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@upscholer.com' });
    if (existingAdmin) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    // Create admin user
    const adminUser = new User({
      name: 'Admin User',
      firstname: 'Admin',
      lastname: 'User',
      email: 'admin@upscholer.com',
      password: 'admin123456', // This will be hashed by the pre-save hook
      role: 'admin',
      isApproved: true
    });

    await adminUser.save();
    console.log('Admin user created successfully!');
    console.log('Email: admin@upscholer.com');
    console.log('Password: admin123456');
    console.log('Please change the password after first login.');

  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    mongoose.connection.close();
  }
};

createAdminUser();