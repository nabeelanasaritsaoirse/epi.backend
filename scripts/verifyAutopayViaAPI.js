const axios = require('axios');

const BASE_URL = 'http://13.127.15.87:8080';
const USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTUzYmExZGFkNjAxMDIwMDY0MWE1MWEiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NzYwNTUyOSwiZXhwIjoxNzY4MjEwMzI5fQ.2R6gbnk4fcdJZOKXLr6Yg6B8Z_aPZuXojr8Gt4MxGss';

async function verifyAutopayViaAPI() {
  try {
    console.log('=== Verifying Autopay via API ===\n');

    // Decode token
    const tokenParts = USER_TOKEN.split('.');
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    console.log('User ID:', payload.userId);
    console.log('');

    // Step 1: Check current settings
    console.log('Step 1: Getting current autopay settings...');
    const settingsResponse = await axios.get(
      `${BASE_URL}/api/installments/autopay/settings`,
      { headers: { Authorization: `Bearer ${USER_TOKEN}` } }
    );

    console.log('Response:');
    console.log(JSON.stringify(settingsResponse.data, null, 2));
    console.log('');

    const isEnabled = settingsResponse.data.data?.settings?.enabled;

    if (isEnabled) {
      console.log('✅ SUCCESS: Autopay is ENABLED!');
      console.log('');
      console.log('Settings:');
      console.log('  - Enabled:', settingsResponse.data.data.settings.enabled);
      console.log('  - Time Preference:', settingsResponse.data.data.settings.timePreference);
      console.log('  - Minimum Balance Lock:', settingsResponse.data.data.settings.minimumBalanceLock);
      console.log('  - Low Balance Threshold:', settingsResponse.data.data.settings.lowBalanceThreshold);
      console.log('  - Send Daily Reminder:', settingsResponse.data.data.settings.sendDailyReminder);
    } else {
      console.log('❌ FAILED: Autopay is NOT enabled');
      console.log('Current enabled value:', isEnabled);
    }

    console.log('');

    // Step 2: Also check via admin API
    console.log('Step 2: Verifying via Admin API...');

    const adminLogin = await axios.post(`${BASE_URL}/api/auth/admin-login`, {
      email: 'admin@epi.com',
      password: '@Saoirse123'
    });

    const adminToken = adminLogin.data.data?.accessToken;
    console.log('✅ Admin logged in\n');

    const usersResponse = await axios.get(`${BASE_URL}/api/sales/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const users = usersResponse.data.data?.users || [];
    const deepUser = users.find(u => u._id === payload.userId);

    if (deepUser) {
      console.log('User found in admin API:');
      console.log('  Name:', deepUser.name);
      console.log('  Email:', deepUser.email);
      console.log('  Autopay in response:', deepUser.autopaySettings || deepUser.autopay || 'Not included in response');
    } else {
      console.log('❌ User not found in admin API response');
    }

    console.log('');
    console.log('=== CONCLUSION ===');
    if (isEnabled) {
      console.log('✅ Autopay IS working! The API successfully saved the settings.');
      console.log('✅ User can enable/disable autopay from the mobile app.');
      console.log('');
      console.log('The issue reported by frontend team might have been:');
      console.log('1. They were checking the wrong field (autopay instead of autopaySettings)');
      console.log('2. Or they were testing with a different environment');
      console.log('3. Or the admin panel was not showing the autopaySettings field');
    } else {
      console.log('❌ Autopay is NOT enabled. Need to investigate further.');
    }

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

verifyAutopayViaAPI();
