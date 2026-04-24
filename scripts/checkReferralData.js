require('dotenv').config();
const mongoose = require('mongoose');
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

mongoose.connect(MONGO_URI).then(async () => {
  const User = require('../models/User');
  const InstallmentOrder = require('../models/InstallmentOrder');
  const Referral = require('../models/Referral');

  console.log('=== REFERRAL DATA CHECK ===\n');

  // 1. Check Referral collection
  const referralCount = await Referral.countDocuments();
  console.log('Referral documents:', referralCount);

  if (referralCount > 0) {
    const sampleReferrals = await Referral.find().limit(3)
      .populate('referrer', 'name email')
      .populate('referredUser', 'name email');
    console.log('\nSample Referrals:');
    for (const r of sampleReferrals) {
      console.log(`  Referrer: ${r.referrer?.name} -> Referred: ${r.referredUser?.name}`);
      console.log(`    Purchases: ${r.purchases?.length || 0}`);
    }
  }

  // 2. Check Users with referredBy
  const usersWithReferrer = await User.countDocuments({ referredBy: { $ne: null } });
  console.log('\nUsers with referredBy set:', usersWithReferrer);

  // 3. Check InstallmentOrders with referrer
  const ordersWithReferrer = await InstallmentOrder.countDocuments({ referrer: { $ne: null } });
  console.log('InstallmentOrders with referrer set:', ordersWithReferrer);

  // 4. Total orders
  const totalOrders = await InstallmentOrder.countDocuments();
  console.log('Total InstallmentOrders:', totalOrders);

  // 5. Check if orders have productCommissionPercentage or commissionPercentage set
  const ordersWithCommission = await InstallmentOrder.countDocuments({
    $or: [
      { productCommissionPercentage: { $gt: 0 } },
      { commissionPercentage: { $gt: 0 } }
    ]
  });
  console.log('Orders with commission % > 0:', ordersWithCommission);

  // 6. Sample recent orders
  console.log('\n--- Sample Recent Orders ---');
  const recentOrders = await InstallmentOrder.find()
    .sort({ createdAt: -1 })
    .limit(3)
    .populate('user', 'name referredBy');

  for (const order of recentOrders) {
    console.log(`\n  Order: ${order.orderId}`);
    console.log(`  User: ${order.user?.name} (${order.user?._id})`);
    console.log(`  User.referredBy: ${order.user?.referredBy || 'None'}`);
    console.log(`  Order.referrer: ${order.referrer || 'None'}`);
    console.log(`  commissionPercentage: ${order.commissionPercentage}`);
    console.log(`  totalCommissionPaid: ${order.totalCommissionPaid}`);
  }

  mongoose.disconnect();
}).catch(console.error);
