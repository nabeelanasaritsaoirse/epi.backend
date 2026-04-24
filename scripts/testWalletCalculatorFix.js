/**
 * Test WalletCalculator fix
 * Verifies that WalletTransaction records are now included in balance calculation
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const WalletTransaction = require('../models/WalletTransaction');
const recalcWallet = require('../services/walletCalculator');

const userId = '693ab2a96b96469dc79ae8d6';

async function testWalletFix() {
  try {
    // Connect to production database
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get current user state
    const userBefore = await User.findById(userId);
    console.log('📊 BEFORE recalcWallet:');
    console.log('  wallet.balance:', userBefore.wallet.balance);
    console.log('  availableBalance:', userBefore.availableBalance);
    console.log('  totalBalance:', userBefore.totalBalance);
    console.log('  holdBalance:', userBefore.wallet.holdBalance);

    // Count transactions
    const txCount = await Transaction.countDocuments({ user: userId });
    const walletTxCount = await WalletTransaction.countDocuments({ user: userId });
    console.log('\n📝 Transaction Counts:');
    console.log('  Transaction model:', txCount);
    console.log('  WalletTransaction model:', walletTxCount);

    // Get sample WalletTransaction
    const sampleWalletTx = await WalletTransaction.findOne({ user: userId })
      .sort({ createdAt: -1 });

    if (sampleWalletTx) {
      console.log('\n💰 Latest WalletTransaction:');
      console.log('  Type:', sampleWalletTx.type);
      console.log('  Amount:', sampleWalletTx.amount);
      console.log('  Status:', sampleWalletTx.status);
      console.log('  Description:', sampleWalletTx.description);
    }

    // Run recalcWallet
    console.log('\n🔄 Running recalcWallet...');
    const updatedUser = await recalcWallet(userId);

    console.log('\n📊 AFTER recalcWallet:');
    console.log('  wallet.balance:', updatedUser.wallet.balance);
    console.log('  availableBalance:', updatedUser.availableBalance);
    console.log('  totalBalance:', updatedUser.totalBalance);
    console.log('  holdBalance:', updatedUser.wallet.holdBalance);

    // Calculate difference
    const balanceDiff = updatedUser.wallet.balance - userBefore.wallet.balance;
    console.log('\n📈 Changes:');
    console.log('  Balance difference:', balanceDiff);
    console.log('  Status:', balanceDiff === 0 ? '⚠️  No change' : '✅ Balance updated!');

    console.log('\n✅ Test completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testWalletFix();
