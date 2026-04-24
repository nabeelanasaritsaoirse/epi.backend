/**
 * Debug why userId comparison is failing
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function debugComparison() {
  try {
    // Connect to production database (based on your GitHub secrets)
    // You need to update this with actual production MONGO_URI
    const PRODUCTION_MONGO_URI = process.env.MONGO_URI;

    await mongoose.connect(PRODUCTION_MONGO_URI);
    console.log('✅ Connected to database:', mongoose.connection.name);
    console.log('');

    const InstallmentOrder = require('../models/InstallmentOrder');

    // The problematic order
    const orderId = '694b9bd2a317f56fc7f94194';
    const userIdFromJWT = '693ab2a96b96469dc79ae8d6';

    console.log('🔍 Fetching order from database...');
    const order = await InstallmentOrder.findById(orderId);

    if (!order) {
      console.log('❌ Order not found');
      await mongoose.disconnect();
      return;
    }

    console.log('✅ Order found!\n');

    console.log('📊 Comparison Analysis:');
    console.log('=====================================');
    console.log('Order user field:');
    console.log('  Type:', typeof order.user);
    console.log('  Value:', order.user);
    console.log('  toString():', order.user.toString());
    console.log('');

    console.log('JWT userId:');
    console.log('  Type:', typeof userIdFromJWT);
    console.log('  Value:', userIdFromJWT);
    console.log('');

    console.log('Comparison Results:');
    console.log('  order.user.toString() === userIdFromJWT:', order.user.toString() === userIdFromJWT);
    console.log('  order.user.toString():', `'${order.user.toString()}'`);
    console.log('  userIdFromJWT:', `'${userIdFromJWT}'`);
    console.log('  String match:', order.user.toString() === userIdFromJWT ? '✅ MATCH' : '❌ NO MATCH');
    console.log('');

    // Check if it's an ObjectId comparison issue
    const userIdAsObjectId = new mongoose.Types.ObjectId(userIdFromJWT);
    console.log('Using ObjectId comparison:');
    console.log('  order.user.equals(userIdAsObjectId):', order.user.equals(userIdAsObjectId));
    console.log('');

    if (order.user.toString() !== userIdFromJWT) {
      console.log('❌ PROBLEM FOUND:');
      console.log('The order belongs to user:', order.user.toString());
      console.log('But JWT token has user:', userIdFromJWT);
      console.log('');
      console.log('This means either:');
      console.log('1. The order was created by a different user');
      console.log('2. The JWT token is from a different environment');
      console.log('3. The user ID in order.user field is wrong');
    } else {
      console.log('✅ User IDs match - the authorization should work!');
      console.log('The error might be happening due to:');
      console.log('1. ObjectId vs String comparison bug');
      console.log('2. The userId being passed differently');
    }

    await mongoose.disconnect();

  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
  }
}

debugComparison();
