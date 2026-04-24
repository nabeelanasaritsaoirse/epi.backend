/**
 * Diagnose the order creation and payment processing issue
 *
 * The problem: Order created successfully but payment fails with "unauthorized"
 * Hypothesis: Order saved to one database but payment API connects to different database
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function diagnoseIssue() {
  try {
    console.log('\n========================================');
    console.log('🔍 DIAGNOSING ORDER ISSUE');
    console.log('========================================\n');

    // Step 1: Check what database the .env is pointing to
    console.log('1️⃣ Environment Configuration:');
    console.log('   MONGO_URI from .env:', process.env.MONGO_URI || 'NOT SET');
    console.log('   NODE_ENV:', process.env.NODE_ENV || 'NOT SET');
    console.log('');

    // Step 2: Connect to the database
    console.log('2️⃣ Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('   ✅ Connected to:', mongoose.connection.name);
    console.log('   Host:', mongoose.connection.host);
    console.log('   Port:', mongoose.connection.port);
    console.log('');

    // Step 3: Check if the order exists in THIS database
    const InstallmentOrder = require('../models/InstallmentOrder');

    console.log('3️⃣ Searching for the problematic order...');
    console.log('   Order _id: 694b9bd2a317f56fc7f94194');
    console.log('   Order Number: ORD-20251224-8812');
    console.log('');

    const orderById = await InstallmentOrder.findById('694b9bd2a317f56fc7f94194');
    const orderByOrderId = await InstallmentOrder.findOne({ orderId: 'ORD-20251224-8812' });

    if (orderById || orderByOrderId) {
      const order = orderById || orderByOrderId;
      console.log('   ✅ ORDER FOUND IN THIS DATABASE!');
      console.log('   _id:', order._id.toString());
      console.log('   orderId:', order.orderId);
      console.log('   User ID:', order.user.toString());
      console.log('   Status:', order.status);
      console.log('   Created At:', order.createdAt);
      console.log('');

      // This means the order IS in the local database
      console.log('4️⃣ User from JWT token:');
      console.log('   User ID: 693ab2a96b96469dc79ae8d6');
      console.log('   Match:', order.user.toString() === '693ab2a96b96469dc79ae8d6' ? '✅ YES' : '❌ NO');
      console.log('');

      if (order.user.toString() !== '693ab2a96b96469dc79ae8d6') {
        console.log('   ⚠️  PROBLEM IDENTIFIED:');
        console.log('   The order belongs to a DIFFERENT user!');
        console.log('   Order User:', order.user.toString());
        console.log('   Your User:', '693ab2a96b96469dc79ae8d6');
        console.log('');
      }
    } else {
      console.log('   ❌ ORDER NOT FOUND in database:', mongoose.connection.name);
      console.log('');
      console.log('   This means:');
      console.log('   - Order was created in a DIFFERENT database');
      console.log('   - Or order creation response was fake/mocked');
      console.log('   - Or order was deleted');
      console.log('');
    }

    // Step 4: Check all orders in this database
    console.log('5️⃣ Checking all orders in this database...');
    const allOrders = await InstallmentOrder.find({}).sort({ createdAt: -1 }).limit(10);
    console.log(`   Found ${allOrders.length} orders total`);

    if (allOrders.length > 0) {
      console.log('\n   Recent orders:');
      allOrders.forEach(order => {
        console.log(`   - ${order.orderId} (User: ${order.user}) - ${order.status}`);
      });
    } else {
      console.log('   ⚠️  NO ORDERS FOUND in this database!');
    }
    console.log('');

    // Step 5: Check user
    const User = require('../models/User');
    const user = await User.findById('693ab2a96b96469dc79ae8d6');

    console.log('6️⃣ Checking if user exists in this database...');
    if (user) {
      console.log('   ✅ User found:', user.name || user.email);
      console.log('   Email:', user.email);
      console.log('   Phone:', user.phoneNumber);
    } else {
      console.log('   ❌ User NOT found in this database');
      console.log('   This confirms you are using a different database than where the user was created');
    }
    console.log('');

    console.log('========================================');
    console.log('📊 DIAGNOSIS SUMMARY:');
    console.log('========================================');

    if (!orderById && !orderByOrderId && !user) {
      console.log('❌ PROBLEM: Different Database');
      console.log('');
      console.log('The order creation returned a success response, but:');
      console.log('1. The order is NOT in the local database');
      console.log('2. The user is NOT in the local database');
      console.log('');
      console.log('SOLUTIONS:');
      console.log('a) Make sure your production .env has the correct MONGO_URI');
      console.log('b) Create the order again on the PRODUCTION API');
      console.log('c) Check if you have multiple database connections');
    } else if (orderById || orderByOrderId) {
      if ((orderById || orderByOrderId).user.toString() !== '693ab2a96b96469dc79ae8d6') {
        console.log('❌ PROBLEM: Wrong User');
        console.log('The order exists but belongs to a different user');
      } else {
        console.log('✅ Order and user exist - something else is wrong');
        console.log('The authorization should work. Check the API endpoint.');
      }
    }
    console.log('========================================\n');

    await mongoose.disconnect();

  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

diagnoseIssue();
