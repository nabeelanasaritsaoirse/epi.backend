/**
 * Send Test Push Notification to Specific User
 */

const axios = require('axios');

const PRODUCTION_URL = 'https://api.epielio.com';
const USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTJlODY2YjcxODgxOTM5NjhkNWIzMmEiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NDY4MzUwNSwiZXhwIjoxNzY1Mjg4MzA1fQ.wx-AiBkaH3PE8YCIkFdTfpflA-q_YKgUIUZfb45psEU';

async function sendTestPush() {
  console.log('📱 SENDING TEST PUSH NOTIFICATION');
  console.log('='.repeat(60));
  console.log(`URL: ${PRODUCTION_URL}`);
  console.log('='.repeat(60));
  console.log('');

  // Decode token to show user ID
  const payload = USER_TOKEN.split('.')[1];
  const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
  console.log('🔑 Token Info:');
  console.log(`   User ID: ${decoded.userId}`);
  console.log(`   Role: ${decoded.role}`);
  console.log(`   Expires: ${new Date(decoded.exp * 1000).toLocaleString()}`);
  console.log('');

  // Test 1: Push + In-App
  console.log('📬 Test 1: Sending Push + In-App Notification');
  console.log('-'.repeat(60));

  const payload1 = {
    title: '🎉 Test Push Notification',
    message: 'This is a test push notification. If you see this on your device, push notifications are working!',
    sendPush: true,
    sendInApp: true
  };

  console.log('Payload:');
  console.log(JSON.stringify(payload1, null, 2));
  console.log('');

  try {
    const response = await axios.post(
      `${PRODUCTION_URL}/api/notifications/trigger`,
      payload1,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${USER_TOKEN}`
        }
      }
    );

    console.log('✅ REQUEST SUCCESSFUL!');
    console.log(`Status: ${response.status}`);
    console.log('Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    if (response.data.data) {
      console.log('📊 Status:');
      console.log(`   Push Sent: ${response.data.data.sentPush ? '✅ YES' : '❌ NO'}`);
      console.log(`   In-App Sent: ${response.data.data.sentInApp ? '✅ YES' : '❌ NO'}`);
      console.log('');

      if (response.data.data.sentPush && !response.data.data.pushResult) {
        console.log('⚠️  IMPORTANT:');
        console.log('   sentPush is true but pushResult is null');
        console.log('   This means the API processed your request, but Firebase is NOT initialized on the server.');
        console.log('   You will NOT receive a push notification on your device.');
        console.log('');
        console.log('💡 What this means:');
        console.log('   - The API code is working correctly ✅');
        console.log('   - Your request was processed ✅');
        console.log('   - But push notification was NOT sent because Firebase is not configured ❌');
        console.log('');
      } else if (response.data.data.pushResult) {
        console.log('✅ Push notification sent successfully!');
        console.log('   Check your device now - you should receive a notification.');
      }
    }

  } catch (error) {
    console.log('❌ REQUEST FAILED!');
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log('Error Response:');
      console.log(JSON.stringify(error.response.data, null, 2));
    } else {
      console.log(`Error: ${error.message}`);
    }
  }

  console.log('');

  // Wait 2 seconds
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Push Only (No In-App)
  console.log('📬 Test 2: Sending Push ONLY (No In-App)');
  console.log('-'.repeat(60));

  const payload2 = {
    title: '⚡ Urgent Push Notification',
    message: 'This is a push-only notification test. Check if this appears on your device.',
    sendPush: true,
    sendInApp: false
  };

  console.log('Payload:');
  console.log(JSON.stringify(payload2, null, 2));
  console.log('');

  try {
    const response = await axios.post(
      `${PRODUCTION_URL}/api/notifications/trigger`,
      payload2,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${USER_TOKEN}`
        }
      }
    );

    console.log('✅ REQUEST SUCCESSFUL!');
    console.log(`Status: ${response.status}`);
    console.log('Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

  } catch (error) {
    console.log('❌ REQUEST FAILED!');
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log('Error:');
      console.log(JSON.stringify(error.response.data, null, 2));
    } else {
      console.log(`Error: ${error.message}`);
    }
  }

  console.log('');

  // Test 3: Check if FCM token is registered
  console.log('👤 Test 3: Checking Your Profile & FCM Token');
  console.log('-'.repeat(60));

  try {
    const response = await axios.get(
      `${PRODUCTION_URL}/api/users/profile`,
      {
        headers: {
          'Authorization': `Bearer ${USER_TOKEN}`
        }
      }
    );

    console.log('✅ Profile Retrieved');
    console.log(`   Name: ${response.data.name || 'N/A'}`);
    console.log(`   Email: ${response.data.email || 'N/A'}`);
    console.log('');

    if (response.data.fcmToken) {
      console.log('✅ FCM Token is REGISTERED');
      console.log(`   Token: ${response.data.fcmToken.substring(0, 60)}...`);
      console.log('   Your device is ready to receive push notifications.');
    } else {
      console.log('❌ FCM Token is NOT REGISTERED');
      console.log('   You need to register your device FCM token first.');
      console.log('');
      console.log('💡 How to register:');
      console.log('   POST https://api.epielio.com/api/notifications/register-token');
      console.log('   Body: { "fcmToken": "your_device_fcm_token" }');
    }

    console.log('');

    if (response.data.notificationPreferences) {
      console.log('🔔 Notification Preferences:');
      console.log(`   Push Enabled: ${response.data.notificationPreferences.pushEnabled ? '✅ YES' : '❌ NO'}`);
      console.log(`   Order Updates: ${response.data.notificationPreferences.orderUpdates ? '✅' : '❌'}`);
      console.log(`   Payment Alerts: ${response.data.notificationPreferences.paymentAlerts ? '✅' : '❌'}`);
      console.log(`   Promotional Offers: ${response.data.notificationPreferences.promotionalOffers ? '✅' : '❌'}`);
      console.log(`   System Notifications: ${response.data.notificationPreferences.systemNotifications ? '✅' : '❌'}`);
    }

  } catch (error) {
    if (error.response?.status === 403) {
      console.log('⚠️  Cannot access profile endpoint (403 Forbidden)');
      console.log('   This endpoint might be admin-only.');
    } else {
      console.log('❌ ERROR!');
      if (error.response) {
        console.log(`Status: ${error.response.status}`);
        console.log('Error:');
        console.log(JSON.stringify(error.response.data, null, 2));
      } else {
        console.log(`Error: ${error.message}`);
      }
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ TESTING COMPLETE');
  console.log('='.repeat(60));
  console.log('');
  console.log('📱 Next Steps:');
  console.log('   1. Check your device for push notifications');
  console.log('   2. Check your app notification feed for in-app notifications');
  console.log('   3. If no push notification received, Firebase needs to be configured on server');
  console.log('');
}

// Run the test
sendTestPush().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
