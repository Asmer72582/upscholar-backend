const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./src/models/User');
require('dotenv').config();

async function resetTrainerPassword() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Find the trainer
    const trainer = await User.findOne({ email: 'trainer@upscholer.com' });
    if (!trainer) {
      console.log('Trainer not found');
      return;
    }
    
    console.log('Found trainer:', trainer.email);
    console.log('Current password exists:', !!trainer.password);
    
    // Set a new password (don't hash here, let the pre-save hook do it)
    const newPassword = 'trainer123456';
    trainer.password = newPassword; // Set plain password, pre-save hook will hash it
    await trainer.save();
    
    console.log('Password reset successfully!');
    console.log('New password:', newPassword);
    
    // Test the password comparison
    console.log('Password field type:', typeof trainer.password);
    console.log('Password field length:', trainer.password.length);
    console.log('Password field preview:', trainer.password.substring(0, 20) + '...');
    const isMatch = await trainer.comparePassword(newPassword);
    console.log('Password comparison test:', isMatch);
    
    // Test direct bcrypt comparison
    const directMatch = await bcrypt.compare(newPassword, trainer.password);
    console.log('Direct bcrypt comparison:', directMatch);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    mongoose.connection.close();
  }
}

resetTrainerPassword();