const axios = require('axios');
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const BASE_URL = 'http://13.127.15.87:8080';
const USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTUzYmExZGFkNjAxMDIwMDY0MWE1MWEiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NzYwNTUyOSwiZXhwIjoxNzY4MjEwMzI5fQ.2R6gbnk4fcdJZOKXLr6Yg6B8Z_aPZuXojr8Gt4MxGss';

async function testAutopayWithToken() {
  try {
    console.log('=== Testing Autopay Enable with User Token ===\n');

    // Decode token to get userId (simple base64 decode)
    const tokenParts = USER_TOKEN.split('.');
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    const userId = payload.userId;

    console.log('User ID from token:', userId);
    console.log('Token expires:', new Date(payload.exp * 1000).toLocaleString());
    console.log('');

    // Step 1: Check current autopay settings
    console.log('Step 1: Checking current autopay settings...');

    try {
      const currentSettings = await axios.get(`${BASE_URL}/api/installments/autopay/settings`, {
        headers: { Authorization: `Bearer ${USER_TOKEN}` }
      });

      console.log('Current Settings Response:');
      console.log(JSON.stringify(currentSettings.data, null, 2));
      console.log('');
    } catch (err) {
      console.log('Error getting current settings:', err.response?.data || err.message);
      console.log('');
    }

    // Step 2: Enable autopay via API
    console.log('Step 2: Enabling autopay via API...');
    console.log('Calling: PUT /api/installments/autopay/settings');
    console.log('Body: { enabled: true }\n');

    try {
      const enableResponse = await axios.put(
        `${BASE_URL}/api/installments/autopay/settings`,
        {
          enabled: true,
          timePreference: 'MORNING_6AM',
          minimumBalanceLock: 100,
          lowBalanceThreshold: 500,
          sendDailyReminder: true
        },
        {
          headers: { Authorization: `Bearer ${USER_TOKEN}` }
        }
      );

      console.log('✅ API Response:');
      console.log(JSON.stringify(enableResponse.data, null, 2));
      console.log('');

      if (enableResponse.data.success) {
        console.log('✅ API call successful!');
      } else {
        console.log('⚠️  API returned success: false');
      }
      console.log('');

    } catch (err) {
      console.log('❌ Error calling API:');
      console.log('Status:', err.response?.status);
      console.log('Response:', JSON.stringify(err.response?.data, null, 2));
      console.log('');
    }

    // Step 3: Verify in database
    console.log('Step 3: Verifying in database...');

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to database\n');

    const dbUser = await User.findById(userId).select('name email autopaySettings autopay');

    if (!dbUser) {
      console.log('❌ User not found in database');
      await mongoose.connection.close();
      return;
    }

    console.log('=== Database State ===');
    console.log('User:', dbUser.name, '(' + dbUser.email + ')');
    console.log('');
    console.log('autopaySettings:');
    console.log(JSON.stringify(dbUser.autopaySettings, null, 2));
    console.log('');
    console.log('autopay (legacy field):');
    console.log(JSON.stringify(dbUser.autopay, null, 2));
    console.log('');

    // Step 4: Final verification
    console.log('=== Final Verification ===');

    if (dbUser.autopaySettings?.enabled === true) {
      console.log('✅ SUCCESS: autopaySettings.enabled is TRUE in database!');
    } else {
      console.log('❌ FAILED: autopaySettings.enabled is NOT true in database');
      console.log('   Current value:', dbUser.autopaySettings?.enabled);
    }

    await mongoose.connection.close();
    console.log('\n✅ Test completed');

  } catch (error) {
    console.error('\n❌ Unexpected error:', error.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  }
}

testAutopayWithToken();
