/**
 * Commission System Test Script
 *
 * Tests:
 * 1. Razorpay first payment commission
 * 2. 10% in-app usage rule for withdrawal
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const InstallmentOrder = require('../models/InstallmentOrder');
const PaymentRecord = require('../models/PaymentRecord');
const WalletTransaction = require('../models/WalletTransaction');

require('dotenv').config();

async function testCommissionSystem() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // =========================================
    // TEST 1: Check Commission Tracking Fields
    // =========================================
    console.log('📋 TEST 1: Checking User Model Fields');
    console.log('=' .repeat(50));

    const testUser = await User.findOne().limit(1);
    if (testUser) {
      console.log('User:', testUser.email);
      console.log('Wallet Balance:', testUser.wallet.balance || 0);
      console.log('Commission Earned:', testUser.wallet.commissionEarned || 0);
      console.log('Commission Used In-App:', testUser.wallet.commissionUsedInApp || 0);

      const requiredUsage = (testUser.wallet.commissionEarned || 0) * 0.1;
      const canWithdraw = (testUser.wallet.commissionUsedInApp || 0) >= requiredUsage;

      console.log('Required In-App Usage (10%):', requiredUsage);
      console.log('Can Withdraw:', canWithdraw ? '✅ YES' : '❌ NO');

      if (!canWithdraw && testUser.wallet.commissionEarned > 0) {
        console.log(`⚠️  Need to use ₹${Math.ceil(requiredUsage - (testUser.wallet.commissionUsedInApp || 0))} more in-app`);
      }
    } else {
      console.log('⚠️  No users found in database');
    }

    console.log('\n');

    // =========================================
    // TEST 2: Check Orders with Referrers
    // =========================================
    console.log('📋 TEST 2: Checking Orders with Referrers');
    console.log('=' .repeat(50));

    const ordersWithReferrers = await InstallmentOrder.find({
      referrer: { $exists: true, $ne: null }
    })
    .populate('referrer', 'name email')
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .limit(5);

    if (ordersWithReferrers.length > 0) {
      console.log(`Found ${ordersWithReferrers.length} orders with referrers:\n`);

      for (const order of ordersWithReferrers) {
        console.log(`Order ID: ${order.orderId}`);
        console.log(`  User: ${order.user?.name || 'N/A'}`);
        console.log(`  Referrer: ${order.referrer?.name || 'N/A'}`);
        console.log(`  Status: ${order.status}`);
        console.log(`  First Payment Method: ${order.firstPaymentMethod}`);
        console.log(`  Paid Installments: ${order.paidInstallments}/${order.totalDays}`);
        console.log(`  Total Commission Paid: ₹${order.totalCommissionPaid || 0}`);
        console.log(`  Commission %: ${order.commissionPercentage || order.productCommissionPercentage || 10}%`);
        console.log('');
      }
    } else {
      console.log('⚠️  No orders with referrers found');
    }

    console.log('\n');

    // =========================================
    // TEST 3: Check Payment Records
    // =========================================
    console.log('📋 TEST 3: Checking Payment Records with Commission');
    console.log('=' .repeat(50));

    const paymentsWithCommission = await PaymentRecord.find({
      commissionCalculated: true
    })
    .populate('order', 'orderId')
    .sort({ createdAt: -1 })
    .limit(5);

    if (paymentsWithCommission.length > 0) {
      console.log(`Found ${paymentsWithCommission.length} payments with commission:\n`);

      for (const payment of paymentsWithCommission) {
        console.log(`Payment ID: ${payment.paymentId}`);
        console.log(`  Order: ${payment.order?.orderId || 'N/A'}`);
        console.log(`  Installment #: ${payment.installmentNumber}`);
        console.log(`  Amount: ₹${payment.amount}`);
        console.log(`  Payment Method: ${payment.paymentMethod}`);
        console.log(`  Commission: ₹${payment.commissionAmount || 0} (${payment.commissionPercentage || 0}%)`);
        console.log(`  Commission Credited: ${payment.commissionCreditedToReferrer ? '✅' : '❌'}`);
        console.log('');
      }
    } else {
      console.log('⚠️  No payments with commission found');
    }

    console.log('\n');

    // =========================================
    // TEST 4: Check Commission Wallet Transactions
    // =========================================
    console.log('📋 TEST 4: Checking Commission Wallet Transactions');
    console.log('=' .repeat(50));

    const commissionTransactions = await WalletTransaction.find({
      type: { $in: ['referral_bonus', 'investment'] }
    })
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .limit(5);

    if (commissionTransactions.length > 0) {
      console.log(`Found ${commissionTransactions.length} commission transactions:\n`);

      for (const tx of commissionTransactions) {
        console.log(`Transaction ID: ${tx._id}`);
        console.log(`  User: ${tx.user?.name || 'N/A'}`);
        console.log(`  Type: ${tx.type}`);
        console.log(`  Amount: ₹${tx.amount}`);
        console.log(`  Description: ${tx.description}`);
        console.log(`  Status: ${tx.status}`);
        if (tx.meta?.totalCommission) {
          console.log(`  Total Commission: ₹${tx.meta.totalCommission}`);
          console.log(`  Available (90%): ₹${tx.meta.availableAmount || 0}`);
          console.log(`  Locked (10%): ₹${tx.meta.lockedAmount || 0}`);
        }
        console.log(`  Created: ${tx.createdAt}`);
        console.log('');
      }
    } else {
      console.log('⚠️  No commission transactions found');
    }

    console.log('\n');

    // =========================================
    // TEST 5: Verify 10% Rule Implementation
    // =========================================
    console.log('📋 TEST 5: Verify 10% In-App Usage Rule');
    console.log('=' .repeat(50));

    const usersWithCommission = await User.find({
      'wallet.commissionEarned': { $gt: 0 }
    }).limit(5);

    if (usersWithCommission.length > 0) {
      console.log(`Found ${usersWithCommission.length} users with commission:\n`);

      for (const user of usersWithCommission) {
        const earned = user.wallet.commissionEarned || 0;
        const used = user.wallet.commissionUsedInApp || 0;
        const required = earned * 0.1;
        const remaining = Math.max(0, required - used);
        const canWithdraw = used >= required;

        console.log(`User: ${user.name} (${user.email})`);
        console.log(`  Commission Earned: ₹${earned}`);
        console.log(`  Used In-App: ₹${used}`);
        console.log(`  Required Usage (10%): ₹${required.toFixed(2)}`);
        console.log(`  Can Withdraw: ${canWithdraw ? '✅ YES' : '❌ NO'}`);
        if (!canWithdraw) {
          console.log(`  ⚠️  Must use ₹${remaining.toFixed(2)} more in-app`);
        }
        console.log('');
      }
    } else {
      console.log('⚠️  No users with commission earned found');
      console.log('ℹ️  This is normal if no commission has been generated yet');
    }

    console.log('\n');
    console.log('✅ All tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run tests
testCommissionSystem();
