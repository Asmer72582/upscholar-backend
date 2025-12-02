const mongoose = require('mongoose');
const User = require('./src/models/User');
require('dotenv').config();

async function findTrainer() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/upscholar');
    
    // Check specifically for the trainer account
    const trainer = await User.findOne({ email: 'trainer@upscholer.com' });
    if (trainer) {
      console.log('Found trainer:', trainer.email);
      console.log('Role:', trainer.role);
      console.log('Password exists:', !!trainer.password);
      console.log('Password length:', trainer.password ? trainer.password.length : 'N/A');
      console.log('Is approved:', trainer.isApproved);
      console.log('Status:', trainer.status);
      
      if (!trainer.password) {
        console.log('Trainer has no password set - this is the issue!');
      }
    } else {
      console.log('Trainer not found');
    }
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}
findTrainer();