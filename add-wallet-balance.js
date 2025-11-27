/**
 * Script to add wallet balance to a user for testing
 * This will credit money to the user's wallet via admin credit
 */

const mongoose = require('mongoose');

// Hardcoded MongoDB URI from the live server
const MONGO_URI = 'mongodb+srv://nabeelanasaritsaoirse:JDvSwcDslYk7sVLq@cluster0.cxfzl.mongodb.net/epi?retryWrites=true&w=majority&appName=Cluster0';

const USER_ID = '691d6035962542bf4120f30b';
const AMOUNT_TO_ADD = 50000; // ₹50,000 for testing

// Load models
const User = require('./models/User');
const Transaction = require('./models/Transaction');

async function addWalletBalance() {
  console.log('\n' + '💰'.repeat(35));
  console.log('   ADDING WALLET BALANCE FOR TESTING');
  console.log('💰'.repeat(35) + '\n');

  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find user
    console.log(`🔍 Finding user: ${USER_ID}...`);
    const user = await User.findById(USER_ID);

    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.name} (${user.email})\n`);

    // Check current balance
    const currentBalance = user.wallet?.balance || 0;
    console.log(`Current Balance: ₹${currentBalance.toLocaleString('en-IN')}`);

    // Create transaction
    console.log(`\n💳 Creating transaction for ₹${AMOUNT_TO_ADD.toLocaleString('en-IN')}...`);

    const transaction = await Transaction.create({
      user: user._id,
      type: 'bonus',
      amount: AMOUNT_TO_ADD,
      status: 'completed',
      paymentMethod: 'system',
      description: 'Admin credit for testing installment orders',
      createdAt: new Date()
    });

    console.log(`✅ Transaction created: ${transaction._id}`);

    // Update user wallet
    console.log('\n💰 Updating user wallet...');

    // Initialize wallet if it doesn't exist
    if (!user.wallet) {
      user.wallet = {
        balance: 0,
        transactions: []
      };
    }

    // Add to balance
    user.wallet.balance = (user.wallet.balance || 0) + AMOUNT_TO_ADD;

    // Add transaction to user's wallet transactions array
    if (!user.wallet.transactions) {
      user.wallet.transactions = [];
    }

    user.wallet.transactions.push({
      type: 'credit',
      amount: AMOUNT_TO_ADD,
      description: 'Admin credit for testing',
      status: 'completed',
      createdAt: new Date()
    });

    await user.save();

    console.log('✅ Wallet updated successfully!\n');

    // Display summary
    console.log('─'.repeat(70));
    console.log('📊 SUMMARY\n');
    console.log(`User: ${user.name} (${user.email})`);
    console.log(`Previous Balance: ₹${currentBalance.toLocaleString('en-IN')}`);
    console.log(`Amount Added: ₹${AMOUNT_TO_ADD.toLocaleString('en-IN')}`);
    console.log(`New Balance: ₹${user.wallet.balance.toLocaleString('en-IN')}`);
    console.log('─'.repeat(70));

    console.log('\n✅ User can now create orders with WALLET payment method!');
    console.log('✅ Ready to create ACTIVE and COMPLETED orders for testing!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');
  }
}

addWalletBalance()
  .then(() => {
    console.log('✅ Script completed successfully!\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
