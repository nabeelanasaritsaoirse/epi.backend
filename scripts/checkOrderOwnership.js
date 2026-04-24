const mongoose = require('mongoose');
require('dotenv').config();

const InstallmentOrder = require('../models/InstallmentOrder');

async function checkOrderOwnership() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to database');

    // The order ID from the error
    const orderId = '694b9bd2a317f56fc7f94194';

    // The user ID from JWT
    const userId = '693ab2a96b96469dc79ae8d6';

    console.log('\n🔍 Searching for order:', orderId);

    const order = await InstallmentOrder.findById(orderId);

    if (!order) {
      console.log('❌ Order not found with _id:', orderId);

      // Try to find by orderId field
      const orderByOrderId = await InstallmentOrder.findOne({ orderId: 'ORD-20251224-8812' });
      if (orderByOrderId) {
        console.log('\n✅ Found order by orderId field:');
        console.log('_id:', orderByOrderId._id.toString());
        console.log('orderId:', orderByOrderId.orderId);
        console.log('User ID from order:', orderByOrderId.user.toString());
        console.log('User ID from JWT:', userId);
        console.log('Match:', orderByOrderId.user.toString() === userId);
        console.log('Status:', orderByOrderId.status);
      } else {
        console.log('\n❌ Order not found by orderId either');

        // Search for recent orders for this user
        console.log('\n🔍 Searching for recent orders for user:', userId);
        const recentOrders = await InstallmentOrder.find({ user: userId }).sort({ createdAt: -1 }).limit(5);
        console.log(`Found ${recentOrders.length} recent orders:`);
        recentOrders.forEach(o => {
          console.log(`  - ${o.orderId} (${o._id}) - ${o.status} - ${o.productName}`);
        });
      }

      await mongoose.disconnect();
      process.exit(0);
    }

    console.log('\n📋 Order Details:');
    console.log('Order ID:', order._id.toString());
    console.log('Order Number:', order.orderId);
    console.log('User ID from order:', order.user.toString());
    console.log('User ID from JWT:', userId);
    console.log('Match:', order.user.toString() === userId);
    console.log('\n📝 Full Order User Field Type:', typeof order.user);
    console.log('Full Order User Field:', order.user);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkOrderOwnership();
