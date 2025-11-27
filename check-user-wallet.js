/**
 * Check and update test user wallet balance
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function checkWallet() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/epi_backend');
    console.log('✅ Connected\n');

    const User = require('./models/User');

    const userId = '69272a87bb44289bef705343';
    const testUser = await User.findById(userId);

    if (!testUser) {
      console.log('❌ Test user not found!');
      process.exit(1);
    }

    console.log('👤 Test User Details:');
    console.log(`   ID: ${testUser._id}`);
    console.log(`   Name: ${testUser.name}`);
    console.log(`   Email: ${testUser.email}`);
    console.log(`   Wallet Balance: ₹${testUser.wallet?.balance || 0}\n`);

    // Ensure user has enough balance for testing
    if (!testUser.wallet || testUser.wallet.balance < 50000) {
      console.log('💰 Adding ₹100,000 to wallet for testing...');
      testUser.wallet = testUser.wallet || { balance: 0, transactions: [] };
      testUser.wallet.balance = 100000;
      await testUser.save();
      console.log('✅ Wallet balance updated to ₹100,000\n');
    } else {
      console.log('✅ User has sufficient balance for testing\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

checkWallet();
