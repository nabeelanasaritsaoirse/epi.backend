require('dotenv').config();
const mongoose = require('mongoose');
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

mongoose.connect(MONGO_URI).then(async () => {
  const User = require('../models/User');
  const InstallmentOrder = require('../models/InstallmentOrder');

  console.log('=== Finding users with referrals ===\n');

  // Find users who have referred someone (via User.referredBy)
  const referrers = await User.aggregate([
    { $match: { referredBy: { $ne: null } } },
    { $group: { _id: '$referredBy', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ]);

  console.log('Top referrers (via User.referredBy):');
  for (const r of referrers) {
    const user = await User.findById(r._id).select('name email');
    console.log('  ' + r._id + ' - ' + (user?.name || 'Unknown') + ' (' + r.count + ' referrals)');
  }

  // Find orders with referrers
  console.log('\n--- InstallmentOrders with referrers ---');
  const ordersWithReferrer = await InstallmentOrder.find({
    referrer: { $ne: null }
  }).populate('referrer', 'name email').populate('user', 'name email').limit(10);

  console.log('Orders with referrer:', ordersWithReferrer.length);
  for (const order of ordersWithReferrer) {
    console.log(`\n  Order: ${order.orderId}`);
    console.log(`  Referrer: ${order.referrer?.name || 'N/A'} (${order.referrer?._id})`);
    console.log(`  Buyer: ${order.user?.name || 'N/A'} (${order.user?._id})`);
    console.log(`  Product: ${order.productName}`);
    console.log(`  TotalCommissionPaid: ${order.totalCommissionPaid}`);
  }

  mongoose.disconnect();
}).catch(console.error);
