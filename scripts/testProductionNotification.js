/**
 * Test Notification API on Production
 * URL: https://api.epielio.com
 */

const axios = require('axios');

const PRODUCTION_URL = 'https://api.epielio.com';

// Test token
const userToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTMyYjE3MmY1NTViN2MxYjZiNWYzMjkiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NTAwMzIzMiwiZXhwIjoxNzY1NjA4MDMyfQ.Vzgtpw7ALFpRmOze1Z6IannUTvlC7MO2vxx5TwDOvhQ';

async function testAPI() {
  console.log('🧪 TESTING PRODUCTION NOTIFICATION API');
  console.log('='.repeat(60));
  console.log(`URL: ${PRODUCTION_URL}`);
  console.log('='.repeat(60));
  console.log('');

  // Test 1: Check if API is reachable
  console.log('📡 Test 1: Check API Connection');
  console.log('-'.repeat(60));
  try {
    const response = await axios.get(`${PRODUCTION_URL}/`);
    console.log('✅ API is reachable');
    console.log(`Response: ${response.data}`);
  } catch (error) {
    console.log('❌ Cannot connect to API');
    console.log(`Error: ${error.message}`);
    return;
  }

  console.log('\n');

  // Test 2: Trigger Push + In-App Notification
  console.log('📬 Test 2: Trigger Push + In-App Notification');
  console.log('-'.repeat(60));

  const payload = {
    title: '🎉 Production Test - Push + In-App',
    message: 'Testing notification from production API. This should send both push and in-app notification.',
    sendPush: true,
    sendInApp: true
  };

  console.log('Request Payload:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('');

  try {
    const response = await axios.post(
      `${PRODUCTION_URL}/api/notifications/trigger`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        }
      }
    );

    console.log('✅ SUCCESS!');
    console.log(`Status: ${response.status}`);
    console.log('Response:');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.data) {
      console.log('\n📊 Notification Status:');
      console.log(`  Push Sent: ${response.data.data.sentPush ? '✅' : '❌'}`);
      console.log(`  In-App Sent: ${response.data.data.sentInApp ? '✅' : '❌'}`);

      if (response.data.data.sentPush && !response.data.data.pushResult) {
        console.log('\n⚠️  Note: sentPush is true but pushResult is null');
        console.log('   This usually means Firebase is not initialized on server.');
      }
    }

  } catch (error) {
    console.log('❌ ERROR!');
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log('Response:');
      console.log(JSON.stringify(error.response.data, null, 2));
    } else {
      console.log(`Error: ${error.message}`);
    }
  }

  console.log('\n');

  // Test 3: Trigger In-App Only
  console.log('📱 Test 3: Trigger In-App Only Notification');
  console.log('-'.repeat(60));

  const inAppPayload = {
    title: '📲 Production Test - In-App Only',
    message: 'This is an in-app only notification test.',
    sendPush: false,
    sendInApp: true
  };

  console.log('Request Payload:');
  console.log(JSON.stringify(inAppPayload, null, 2));
  console.log('');

  try {
    const response = await axios.post(
      `${PRODUCTION_URL}/api/notifications/trigger`,
      inAppPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        }
      }
    );

    console.log('✅ SUCCESS!');
    console.log(`Status: ${response.status}`);
    console.log('Response:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.log('❌ ERROR!');
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log('Response:');
      console.log(JSON.stringify(error.response.data, null, 2));
    } else {
      console.log(`Error: ${error.message}`);
    }
  }

  console.log('\n');

  // Test 4: Check User Profile (FCM Token)
  console.log('👤 Test 4: Check User Profile & FCM Token');
  console.log('-'.repeat(60));

  try {
    const response = await axios.get(
      `${PRODUCTION_URL}/api/users/profile`,
      {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      }
    );

    console.log('✅ Profile Retrieved');

    if (response.data.fcmToken) {
      console.log('✅ FCM Token is registered');
      console.log(`   Token: ${response.data.fcmToken.substring(0, 50)}...`);
    } else {
      console.log('❌ FCM Token is NOT registered');
      console.log('   User needs to register FCM token first');
    }

    if (response.data.notificationPreferences) {
      console.log('\n🔔 Notification Preferences:');
      console.log(`   Push Enabled: ${response.data.notificationPreferences.pushEnabled ? '✅' : '❌'}`);
      console.log(`   Order Updates: ${response.data.notificationPreferences.orderUpdates ? '✅' : '❌'}`);
      console.log(`   Payment Alerts: ${response.data.notificationPreferences.paymentAlerts ? '✅' : '❌'}`);
      console.log(`   System Notifications: ${response.data.notificationPreferences.systemNotifications ? '✅' : '❌'}`);
    }

  } catch (error) {
    console.log('❌ ERROR!');
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log('Response:');
      console.log(JSON.stringify(error.response.data, null, 2));
    } else {
      console.log(`Error: ${error.message}`);
    }
  }

  console.log('\n');

  // Test 5: Get Notification Feed
  console.log('📋 Test 5: Get Notification Feed');
  console.log('-'.repeat(60));

  try {
    const response = await axios.get(
      `${PRODUCTION_URL}/api/notifications`,
      {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      }
    );

    console.log('✅ Notification Feed Retrieved');
    console.log(`Total Notifications: ${response.data.data?.notifications?.length || 0}`);

    if (response.data.data?.notifications?.length > 0) {
      console.log('\nRecent Notifications:');
      response.data.data.notifications.slice(0, 3).forEach((notif, idx) => {
        console.log(`\n${idx + 1}. ${notif.title}`);
        console.log(`   Type: ${notif.type}`);
        console.log(`   Date: ${new Date(notif.createdAt).toLocaleString()}`);
      });
    }

  } catch (error) {
    console.log('❌ ERROR!');
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log('Response:');
      console.log(JSON.stringify(error.response.data, null, 2));
    } else {
      console.log(`Error: ${error.message}`);
    }
  }

  console.log('\n');
  console.log('='.repeat(60));
  console.log('✅ TESTING COMPLETE');
  console.log('='.repeat(60));
}

// Run tests
testAPI().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
