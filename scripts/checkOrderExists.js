/**
 * Check if order exists at all
 */

require('dotenv').config();
const mongoose = require('mongoose');

const orderId = '694b9bd2a317f56fc7f94194';

async function checkOrder() {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const InstallmentOrder = require('../models/InstallmentOrder');

    // Try to find order regardless of user
    console.log('🔍 Searching for order:', orderId);
    console.log('');

    const order = await InstallmentOrder.findById(orderId);

    if (!order) {
      console.log('❌ Order does NOT exist in database\n');

      // Check recent orders
      console.log('📋 Last 10 orders in system:');
      const recentOrders = await InstallmentOrder.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select('_id orderId user status createdAt');

      recentOrders.forEach((o, i) => {
        console.log(`\nOrder ${i + 1}:`);
        console.log('  _id:', o._id.toString());
        console.log('  orderId:', o.orderId);
        console.log('  user:', o.user.toString());
        console.log('  status:', o.status);
        console.log('  created:', o.createdAt);
      });
    } else {
      console.log('✅ Order EXISTS!\n');
      console.log('Order Details:');
      console.log('  _id:', order._id.toString());
      console.log('  orderId:', order.orderId);
      console.log('  user:', order.user.toString());
      console.log('  status:', order.status);
      console.log('  productPrice:', order.productPrice);
      console.log('  totalPaidAmount:', order.totalPaidAmount);
      console.log('  remainingInstallments:', order.remainingInstallments);
      console.log('  created:', order.createdAt);

      console.log('\n🔑 User Comparison:');
      console.log('  Order user:', order.user.toString());
      console.log('  Expected user:', '693ab2a96b96469dc79ae8d6');
      console.log('  Match:', order.user.toString() === '693ab2a96b96469dc79ae8d6');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkOrder();
