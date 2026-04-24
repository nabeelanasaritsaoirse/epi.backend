const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
require('dotenv').config();

async function addMoneyToWallet() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const userId = '693ab2a96b96469dc79ae8d6'; // User ID
    const amount = 10000; // ₹10,000

    const user = await User.findById(userId);
    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }

    console.log(`\n📊 Current Balance: ₹${user.wallet.balance || 0}`);

    // Add money to wallet
    user.wallet.balance = (user.wallet.balance || 0) + amount;
    await user.save();

    // Create transaction record
    const tx = new Transaction({
      user: userId,
      type: 'bonus',
      amount: amount,
      status: 'completed',
      paymentMethod: 'system',
      description: 'Test balance added for installment order testing'
    });
    await tx.save();

    console.log(`✅ Added ₹${amount} to wallet`);
    console.log(`📊 New Balance: ₹${user.wallet.balance}`);

    await mongoose.disconnect();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addMoneyToWallet();
