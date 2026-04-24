/**
 * Complete pending wallet transaction for user
 * This simulates successful Razorpay payment verification
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const recalcWallet = require('../services/walletCalculator');

const userId = '693ab2a96b96469dc79ae8d6';

async function completePendingTransaction() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find pending wallet load transaction
    const pendingTx = await Transaction.findOne({
      user: userId,
      type: 'bonus',
      status: 'pending',
      description: 'Wallet load'
    }).sort({ createdAt: -1 });

    if (!pendingTx) {
      console.log('❌ No pending wallet load transaction found');
      process.exit(0);
    }

    console.log('\n📋 Found pending transaction:');
    console.log('Transaction ID:', pendingTx._id);
    console.log('Amount:', pendingTx.amount);
    console.log('Status:', pendingTx.status);
    console.log('Created:', pendingTx.createdAt);

    // Update transaction to completed
    pendingTx.status = 'completed';
    pendingTx.paymentDetails.paymentId = 'pay_SIMULATED_' + Date.now();
    pendingTx.paymentDetails.signature = 'sig_SIMULATED';
    await pendingTx.save();

    console.log('\n✅ Transaction marked as completed');

    // Recalculate wallet
    const updatedUser = await recalcWallet(userId);

    console.log('\n💰 Updated Wallet Balances:');
    console.log('Available Balance:', updatedUser.wallet.balance);
    console.log('Hold Balance:', updatedUser.wallet.holdBalance);
    console.log('Total Balance:', updatedUser.totalBalance);
    console.log('Total Earnings:', updatedUser.totalEarnings);

    console.log('\n✅ Done! User can now place orders using wallet.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

completePendingTransaction();
