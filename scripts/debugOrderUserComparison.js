/**
 * Debug order.user comparison issue in payment authorization
 */

require('dotenv').config();
const mongoose = require('mongoose');

const userId = '693ab2a96b96469dc79ae8d6';
const orderId = '694b9bd2a317f56fc7f94194';

async function debugComparison() {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const InstallmentOrder = require('../models/InstallmentOrder');

    const order = await InstallmentOrder.findOne({
      $or: [{ _id: orderId }, { orderId }],
    }).populate('referrer', 'name email');

    if (!order) {
      console.log('❌ Order not found');
      process.exit(1);
    }

    console.log('📋 Order Details:');
    console.log('  Order ID:', order._id);
    console.log('  Order orderId:', order.orderId);
    console.log('  Order status:', order.status);

    console.log('\n🔍 User Field Analysis:');
    console.log('  order.user type:', typeof order.user);
    console.log('  order.user value:', order.user);
    console.log('  order.user.toString():', order.user.toString());
    console.log('  userId from token:', userId);

    console.log('\n⚠️  PROBLEMATIC COMPARISON (current code):');
    console.log('  order.user.toString() !== userId:', order.user.toString() !== userId);

    console.log('\n✅ CORRECT COMPARISON (using equals):');
    const userIdObj = new mongoose.Types.ObjectId(userId);
    console.log('  order.user.equals(userIdObj):', order.user.equals(userIdObj));

    console.log('\n🔧 SOLUTION:');
    console.log('  Change line 117 from:');
    console.log('    if (order.user.toString() !== userId) {');
    console.log('  To:');
    console.log('    if (order.user.toString() !== userId.toString()) {');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugComparison();
