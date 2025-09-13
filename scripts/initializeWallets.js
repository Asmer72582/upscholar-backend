const mongoose = require('mongoose');
const User = require('../src/models/User');
const Transaction = require('../src/models/Transaction');
require('dotenv').config();

const initializeWallets = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find all users with valid roles and initialize their wallets if needed
    const users = await User.find({ role: { $in: ['student', 'trainer', 'admin'] } });
    
    for (const user of users) {
      // Skip if user already has transactions
      const existingTransactions = await Transaction.findOne({ user: user._id });
      if (existingTransactions) {
        console.log(`User ${user.email} already has transactions, skipping...`);
        continue;
      }

      // Create welcome bonus transaction
      const welcomeBonus = new Transaction({
        user: user._id,
        type: 'credit',
        amount: 150,
        description: 'Welcome bonus - Free Upcoins to get started!',
        category: 'bonus',
        status: 'completed',
        reference: `welcome_${user._id}`,
        balanceBefore: 0,
        balanceAfter: 150,
        metadata: {
          isWelcomeBonus: true
        }
      });

      await welcomeBonus.save();

      // Update user's wallet balance directly without triggering validation
      await User.updateOne(
        { _id: user._id },
        { $set: { walletBalance: 150 } }
      );

      console.log(`Initialized wallet for ${user.email} with 150 UC welcome bonus`);
    }

    console.log('Wallet initialization completed!');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing wallets:', error);
    process.exit(1);
  }
};

initializeWallets();