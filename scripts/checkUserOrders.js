// Check user's installment orders and referral connection
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const InstallmentOrder = require('../models/InstallmentOrder');
const Referral = require('../models/Referral');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function checkUserOrders() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // User with phone +918971234704 (ashu)
    const phone = '+918971234704';

    const user = await User.findOne({ phoneNumber: phone });

    if (!user) {
      console.log('❌ User not found with phone:', phone);
      return;
    }

    console.log('👤 USER DETAILS:');
    console.log('   Name:', user.name);
    console.log('   Phone:', user.phoneNumber);
    console.log('   User ID:', user._id);
    console.log('   Referred By:', user.referredBy || 'None');
    console.log('   Referral Code:', user.referralCode);
    console.log('');

    // Check if user has referredBy
    if (user.referredBy) {
      const referrer = await User.findById(user.referredBy);
      console.log('👥 REFERRER DETAILS:');
      console.log('   Name:', referrer.name);
      console.log('   Phone:', referrer.phoneNumber);
      console.log('   Referral Code:', referrer.referralCode);
      console.log('');
    }

    // Check installment orders
    const orders = await InstallmentOrder.find({ user: user._id })
      .populate('product', 'name productId')
      .populate('referrer', 'name phoneNumber referralCode');

    console.log('📦 INSTALLMENT ORDERS:', orders.length);
    console.log('');

    orders.forEach((order, idx) => {
      console.log(`ORDER ${idx + 1}:`);
      console.log('   Order ID:', order.orderId);
      console.log('   Product:', order.productName);
      console.log('   Total Days:', order.totalDays);
      console.log('   Daily Amount:', order.dailyPaymentAmount);
      console.log('   Paid Installments:', order.paidInstallments);
      console.log('   Total Paid:', order.totalPaidAmount);
      console.log('   Status:', order.status);
      console.log('   Referrer:', order.referrer ? order.referrer.name : 'None');
      console.log('   Commission %:', order.commissionPercentage);
      console.log('   Total Commission Paid:', order.totalCommissionPaid);
      console.log('   Created:', order.createdAt);
      console.log('');
    });

    // Check Referral records
    if (user.referredBy) {
      const referralRecords = await Referral.find({ referredUser: user._id })
        .populate('referrer', 'name phoneNumber');

      console.log('📋 REFERRAL RECORDS:', referralRecords.length);
      console.log('');

      referralRecords.forEach((ref, idx) => {
        console.log(`REFERRAL ${idx + 1}:`);
        console.log('   Referrer:', ref.referrer.name);
        console.log('   Status:', ref.status);
        console.log('   Commission Earned:', ref.commissionEarned || 0);
        console.log('   Days Paid:', ref.daysPaid || 0);
        console.log('   Purchases:', ref.purchases ? ref.purchases.length : 0);
        console.log('');
      });
    }

    console.log('✅ Check complete');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkUserOrders();
