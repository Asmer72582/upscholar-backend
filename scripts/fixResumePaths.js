const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// Import User model
const User = require('../src/models/User');

async function fixResumePaths() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find all trainers with resume paths
    const trainers = await User.find({ 
      role: 'trainer',
      resume: { $exists: true, $ne: null }
    });

    console.log(`Found ${trainers.length} trainers with resumes`);

    let updatedCount = 0;

    for (const trainer of trainers) {
      // Check if the path is already in the correct format
      if (trainer.resume.startsWith('/uploads/')) {
        console.log(`✓ ${trainer.email} - Already correct format`);
        continue;
      }

      // Extract just the filename from the full path
      const filename = path.basename(trainer.resume);
      const newPath = `/uploads/resumes/${filename}`;

      // Update the trainer
      trainer.resume = newPath;
      await trainer.save();

      updatedCount++;
      console.log(`✓ Updated ${trainer.email}: ${trainer.resume}`);
    }

    console.log(`\n✅ Migration complete! Updated ${updatedCount} trainer records.`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
fixResumePaths();
