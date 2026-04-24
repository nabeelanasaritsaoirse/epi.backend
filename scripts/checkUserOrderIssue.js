require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');
const InstallmentOrder = require('../models/InstallmentOrder');

async function checkUserOrders() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');

    const phoneNumber = '8897193576';

    // Find user by phone
    console.log(`\n🔍 Searching for user with phone: ${phoneNumber}`);
    const user = await User.findOne({ phone: phoneNumber });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('✅ User found:');
    console.log(`- ID: ${user._id}`);
    console.log(`- Name: ${user.name}`);
    console.log(`- Email: ${user.email}`);
    console.log(`- Phone: ${user.phone}`);

    // Check normal orders
    console.log('\n📦 Checking NORMAL Orders:');
    const normalOrders = await Order.find({ user: user._id }).sort({ createdAt: -1 });
    console.log(`Found ${normalOrders.length} normal order(s)`);

    if (normalOrders.length > 0) {
      normalOrders.forEach((order, index) => {
        console.log(`\n--- Normal Order ${index + 1} ---`);
        console.log(`Order ID: ${order._id}`);
        console.log(`Created At: ${order.createdAt}`);
        console.log(`Status: ${order.status}`);
        console.log(`Payment Status: ${order.paymentStatus}`);
        console.log(`Total Amount: ₹${order.totalAmount}`);
        console.log(`Items Count: ${order.items?.length || 0}`);

        if (order.items && order.items.length > 0) {
          console.log('\nOrder Items:');
          order.items.forEach((item, i) => {
            console.log(`  ${i + 1}. Product: ${item.product}`);
            console.log(`     Name: ${item.name}`);
            console.log(`     Quantity: ${item.quantity}`);
            console.log(`     Price: ₹${item.price}`);
            console.log(`     Total: ₹${item.quantity * item.price}`);
          });
        }

        console.log(`\nShipping Address: ${JSON.stringify(order.shippingAddress, null, 2)}`);
      });

      // Show the most recent order in detail for migration
      console.log('\n\n🎯 MOST RECENT ORDER DETAILS (for migration):');
      const latestOrder = normalOrders[0];
      console.log(JSON.stringify({
        orderId: latestOrder._id,
        userId: latestOrder.user,
        items: latestOrder.items,
        totalAmount: latestOrder.totalAmount,
        shippingAddress: latestOrder.shippingAddress,
        paymentStatus: latestOrder.paymentStatus,
        status: latestOrder.status,
        createdAt: latestOrder.createdAt
      }, null, 2));
    }

    // Check installment orders
    console.log('\n\n💳 Checking INSTALLMENT Orders:');
    const installmentOrders = await InstallmentOrder.find({ user: user._id }).sort({ createdAt: -1 });
    console.log(`Found ${installmentOrders.length} installment order(s)`);

    if (installmentOrders.length > 0) {
      installmentOrders.forEach((order, index) => {
        console.log(`\n--- Installment Order ${index + 1} ---`);
        console.log(`Order ID: ${order._id}`);
        console.log(`Created At: ${order.createdAt}`);
        console.log(`Status: ${order.status}`);
        console.log(`Total Amount: ₹${order.totalAmount}`);
        console.log(`Items Count: ${order.items?.length || 0}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from database');
  }
}

checkUserOrders();
