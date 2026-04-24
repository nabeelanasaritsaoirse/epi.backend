/**
 * Find order and debug why it's not found
 */

require('dotenv').config();
const mongoose = require('mongoose');

const userId = '693ab2a96b96469dc79ae8d6';
const orderId = '694b9bd2a317f56fc7f94194';

async function findOrder() {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const InstallmentOrder = require('../models/InstallmentOrder');

    // Try different ways to find the order
    console.log('🔍 Trying different queries...\n');

    console.log('1️⃣ Find by _id:');
    const byId = await InstallmentOrder.findById(orderId);
    console.log('   Found:', !!byId);
    if (byId) {
      console.log('   orderId field:', byId.orderId);
      console.log('   user field:', byId.user);
      console.log('   status:', byId.status);
    }

    console.log('\n2️⃣ Find by orderId field:');
    const byOrderId = await InstallmentOrder.findOne({ orderId });
    console.log('   Found:', !!byOrderId);

    console.log('\n3️⃣ Find with $or query (like in code):');
    const byOr = await InstallmentOrder.findOne({
      $or: [{ _id: orderId }, { orderId }],
    });
    console.log('   Found:', !!byOr);
    if (byOr) {
      console.log('   Matched by which field?');
      console.log('   _id:', byOr._id.toString());
      console.log('   orderId:', byOr.orderId);
    }

    console.log('\n4️⃣ Find by user and _id:');
    const byUserAndId = await InstallmentOrder.findOne({
      _id: orderId,
      user: userId
    });
    console.log('   Found:', !!byUserAndId);

    console.log('\n5️⃣ List all orders for this user:');
    const allOrders = await InstallmentOrder.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('_id orderId status createdAt');

    console.log('   Total orders:', allOrders.length);
    allOrders.forEach((o, i) => {
      console.log(`   Order ${i + 1}:`);
      console.log('     _id:', o._id.toString());
      console.log('     orderId:', o.orderId);
      console.log('     status:', o.status);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

findOrder();
