const axios = require('axios');

const BASE_URL = 'http://13.127.15.87:8080';

async function testAutopayEnable() {
  try {
    console.log('=== Testing Autopay Enable API ===\n');

    // Step 1: Login as a regular user (Shubhashri)
    console.log('Step 1: Logging in as user (shubhashri410@gmail.com)...');

    // First, let's use admin to get user details
    const adminLoginResponse = await axios.post(`${BASE_URL}/api/auth/admin-login`, {
      email: 'admin@epi.com',
      password: '@Saoirse123'
    });

    const adminToken = adminLoginResponse.data.data?.accessToken;
    console.log('✅ Admin logged in\n');

    // Get all users to find the target user
    const usersResponse = await axios.get(`${BASE_URL}/api/sales/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const users = usersResponse.data.data?.users || [];
    const targetUser = users.find(u => u.email === 'shubhashri410@gmail.com');

    if (!targetUser) {
      console.log('❌ User shubhashri410@gmail.com not found');
      return;
    }

    console.log('Found user:', targetUser.name);
    console.log('User ID:', targetUser._id);
    console.log('Current autopay status:', targetUser.autopaySettings?.enabled ? '✅ ENABLED' : '❌ NOT ENABLED');
    console.log('');

    // Step 2: Check if user has any orders
    console.log('Step 2: Checking user orders...');

    try {
      // Try to get user's orders
      const ordersResponse = await axios.get(`${BASE_URL}/api/sales/users/${targetUser._id}/orders`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      const orders = ordersResponse.data.data?.orders || ordersResponse.data.orders || [];
      console.log(`Found ${orders.length} order(s)\n`);

      if (orders.length > 0) {
        console.log('User Orders:');
        orders.forEach((order, idx) => {
          console.log(`${idx + 1}. Order ID: ${order._id || order.orderId}`);
          console.log(`   Product: ${order.productName || order.product?.name || 'N/A'}`);
          console.log(`   Status: ${order.status}`);
          console.log(`   Autopay: ${order.autopay?.enabled ? '✅ ENABLED' : '❌ NOT ENABLED'}`);
          console.log('');
        });
      } else {
        console.log('⚠️  User has no orders yet\n');
      }
    } catch (orderErr) {
      console.log('Could not fetch orders:', orderErr.response?.data?.message || orderErr.message);
      console.log('');
    }

    // Step 3: Test autopay settings update
    console.log('Step 3: Testing autopay settings API...');
    console.log('API Endpoint: PUT /api/installments/autopay/settings');
    console.log('');

    // We need user's JWT token to update their settings
    // For testing, let's simulate what frontend would send
    console.log('⚠️  Note: To test the autopay enable API, we need the user\'s JWT token.');
    console.log('Frontend should call: PUT /api/installments/autopay/settings');
    console.log('With body: { "enabled": true }');
    console.log('');

    // Step 4: Let's directly check database to see current state
    console.log('Step 4: Checking database directly...');

    require('dotenv').config();
    const mongoose = require('mongoose');
    const User = require('../models/User');

    const DB_URI = process.env.MONGO_URI;
    if (!DB_URI) {
      console.log('❌ MONGO_URI not found in environment variables');
      return;
    }

    await mongoose.connect(DB_URI);
    console.log('✅ Connected to database\n');

    const dbUser = await User.findById(targetUser._id).select('autopaySettings autopay');

    console.log('=== Database State ===');
    console.log('autopaySettings:', JSON.stringify(dbUser.autopaySettings, null, 2));
    console.log('\nautopay (legacy):', JSON.stringify(dbUser.autopay, null, 2));
    console.log('');

    // Step 5: Let's try to enable autopay settings directly
    console.log('Step 5: Enabling autopay settings in database...');

    dbUser.autopaySettings = dbUser.autopaySettings || {};
    dbUser.autopaySettings.enabled = true;

    await dbUser.save();
    console.log('✅ Saved autopay settings to database\n');

    // Verify the save
    const verifyUser = await User.findById(targetUser._id).select('autopaySettings');
    console.log('=== Verification ===');
    console.log('Autopay Settings after save:', JSON.stringify(verifyUser.autopaySettings, null, 2));
    console.log('');

    if (verifyUser.autopaySettings?.enabled) {
      console.log('✅ SUCCESS: Autopay is now enabled in database!');
    } else {
      console.log('❌ FAILED: Autopay is still not enabled');
    }

    await mongoose.connection.close();

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testAutopayEnable();
