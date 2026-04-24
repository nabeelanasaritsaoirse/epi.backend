require('dotenv').config();
const mongoose = require('mongoose');

const USER_ID = '698ad0c598104dd8464e00f8';
const USER_PHONE = '1234567899';

async function main() {
  try {
    console.log('=== CHECKING ORDERS IN DATABASE ===\n');

    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const InstallmentOrder = require('../models/InstallmentOrder');

    // Check all orders for this user
    console.log(`Looking for orders for user ${USER_ID} (phone: ${USER_PHONE})...\n`);

    const allOrders = await InstallmentOrder.find({ user: USER_ID })
      .sort({ createdAt: -1 })
      .lean();

    console.log(`Total orders found: ${allOrders.length}\n`);

    if (allOrders.length > 0) {
      allOrders.forEach((order, i) => {
        console.log(`${i + 1}. Order: ${order.orderId} (${order._id})`);
        console.log(`   Product: ${order.productName}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Delivery Status: ${order.deliveryStatus}`);
        console.log(`   Paid: ${order.paidInstallments}/${order.totalDays}`);
        console.log(`   Total Paid: ₹${order.totalPaidAmount}`);
        console.log(`   Remaining: ₹${order.remainingAmount}`);
        console.log(`   Completed At: ${order.completedAt || 'NULL'}`);
        console.log(`   Created At: ${order.createdAt}`);
        console.log('');
      });

      // Check by status
      console.log('\n=== BY STATUS ===');
      const completed = allOrders.filter(o => o.status === 'COMPLETED');
      const active = allOrders.filter(o => o.status === 'ACTIVE');
      const pending = allOrders.filter(o => o.status === 'PENDING');

      console.log(`COMPLETED: ${completed.length}`);
      console.log(`ACTIVE: ${active.length}`);
      console.log(`PENDING: ${pending.length}`);

    } else {
      console.log('❌ No orders found for this user!');
      console.log('\nLet me check if the user exists...');

      const User = require('../models/User');
      const user = await User.findById(USER_ID);

      if (user) {
        console.log('✅ User exists:');
        console.log(`   Name: ${user.name}`);
        console.log(`   Phone: ${user.phoneNumber}`);
        console.log(`   Email: ${user.email}`);
      } else {
        console.log('❌ User NOT found in database!');
      }
    }

    await mongoose.disconnect();
    console.log('\n=== CHECK COMPLETED ===');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

main();
