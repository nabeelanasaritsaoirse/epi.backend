/**
 * Debug script to check referral list API
 * Usage: node scripts/debugReferralList.js <referrerId>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const InstallmentOrder = require('../models/InstallmentOrder');
const Referral = require('../models/Referral');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function debugReferralList(referrerId) {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    console.log('\n=== DEBUG REFERRAL LIST ===');
    console.log('Referrer ID:', referrerId);

    // 1. Check if referrer exists
    const referrer = await User.findById(referrerId).select('name email referralCode');
    if (!referrer) {
      console.log('ERROR: Referrer not found!');
      return;
    }
    console.log('\nReferrer:', referrer.name, '-', referrer.email);

    // 2. Find all users referred by this person
    const referredUsers = await User.find({ referredBy: referrerId })
      .select('name email profilePicture createdAt');

    console.log('\n--- Referred Users (via User.referredBy) ---');
    console.log('Count:', referredUsers.length);

    for (const user of referredUsers) {
      console.log(`\n  User: ${user.name} (${user._id})`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Joined: ${user.createdAt}`);

      // Check legacy referral
      const legacyReferral = await Referral.findOne({
        referrer: referrerId,
        referredUser: user._id
      });

      if (legacyReferral) {
        console.log(`  Legacy Referral: Found (${legacyReferral.purchases?.length || 0} purchases)`);
      } else {
        console.log('  Legacy Referral: None');
      }

      // Check installment orders
      const installmentOrders = await InstallmentOrder.find({
        referrer: referrerId,
        user: user._id
      }).populate('product', 'name images productId');

      console.log(`  Installment Orders (referrer=${referrerId}, user=${user._id}): ${installmentOrders.length}`);

      for (const order of installmentOrders) {
        console.log(`    - Order: ${order.orderId}`);
        console.log(`      Product: ${order.productName}`);
        console.log(`      Status: ${order.status}`);
        console.log(`      TotalCommissionPaid: ${order.totalCommissionPaid}`);
        console.log(`      Product populated: ${order.product ? 'Yes' : 'No'}`);
        if (order.product) {
          console.log(`      Product.productId: ${order.product.productId}`);
          console.log(`      Product.images: ${order.product.images?.length || 0} images`);
        }
      }
    }

    // 3. Also check all installment orders where referrer is this user
    console.log('\n\n--- ALL InstallmentOrders where referrer = this user ---');
    const allReferrerOrders = await InstallmentOrder.find({ referrer: referrerId })
      .populate('user', 'name email')
      .populate('product', 'name productId');

    console.log('Total orders:', allReferrerOrders.length);

    for (const order of allReferrerOrders) {
      console.log(`\n  Order: ${order.orderId}`);
      console.log(`  User: ${order.user?.name || 'N/A'} (${order.user?._id || order.user})`);
      console.log(`  Product: ${order.productName}`);
      console.log(`  Status: ${order.status}`);
      console.log(`  TotalCommissionPaid: ${order.totalCommissionPaid}`);
    }

    // 4. Check if the user IDs match what we expect
    console.log('\n\n--- Checking User.referredBy matches ---');
    for (const order of allReferrerOrders) {
      const buyer = await User.findById(order.user).select('name referredBy');
      if (buyer) {
        const refByMatches = buyer.referredBy?.toString() === referrerId;
        console.log(`  ${buyer.name}: referredBy=${buyer.referredBy} (matches: ${refByMatches})`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

const referrerId = process.argv[2];
if (!referrerId) {
  console.log('Usage: node scripts/debugReferralList.js <referrerId>');
  console.log('Example: node scripts/debugReferralList.js 6831be16fac54e58faf691a6');
  process.exit(1);
}

debugReferralList(referrerId);
