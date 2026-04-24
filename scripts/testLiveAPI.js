/**
 * Test Push Notification on Live Server
 * Tests the live API directly
 */

const https = require('https');

const BASE_URL = 'api.epielio.com';
const TEST_EMAIL = 'nishantprofit1@gmail.com';
const TEST_PASSWORD = 'Nishant@123'; // You'll need to provide this

let userToken = null;

function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      rejectUnauthorized: false
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({
            statusCode: res.statusCode,
            data: parsed
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function loginAsUser() {
  console.log('🔐 Logging in as user:', TEST_EMAIL);

  const result = await makeRequest('POST', '/api/auth/login', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  });

  if (result.statusCode === 200 && result.data.data && result.data.data.accessToken) {
    userToken = result.data.data.accessToken;
    console.log('✅ User logged in successfully\n');
    return true;
  } else {
    console.log('❌ User login failed');
    console.log('Response:', result.data);
    console.log('\n⚠️  You may need to update TEST_PASSWORD in the script\n');
    return false;
  }
}

async function triggerPushNotification() {
  console.log('🔔 Triggering push notification via /api/notifications/trigger...\n');

  const result = await makeRequest('POST', '/api/notifications/trigger', {
    title: '🎉 Live API Test',
    message: 'Testing push notification from live server to Nishant!',
    sendPush: true,
    sendInApp: true
  }, userToken);

  console.log('📊 Response Status:', result.statusCode);
  console.log('📦 Response Data:', JSON.stringify(result.data, null, 2));

  if (result.statusCode === 200 && result.data.success) {
    console.log('\n✅ API call successful!');

    if (result.data.data && result.data.data.pushResult) {
      const pushResult = result.data.data.pushResult;
      console.log('\n📱 Push Result:');
      console.log('  - Success:', pushResult.success);
      console.log('  - Sent:', pushResult.sent || 0);
      console.log('  - Failed:', pushResult.failed || 0);
      console.log('  - Total Targeted:', pushResult.totalTargeted || 0);

      if (pushResult.success && pushResult.sent > 0) {
        console.log('\n🎉 Push notification sent successfully!');
        console.log('📱 Check Nishant\'s device for the notification!');
      } else if (pushResult.success && pushResult.sent === 0) {
        console.log('\n⚠️  Push notification not sent (sent: 0)');
        console.log('Possible reasons:');
        console.log('  - User has push notifications disabled');
        console.log('  - Device token not found');
        console.log('  - Check server logs for more details');
      } else {
        console.log('\n⚠️  Push result shows failure');
      }
    } else if (result.data.data && result.data.data.pushResult === null) {
      console.log('\n⚠️  pushResult is null');
      console.log('This means:');
      console.log('  - FCM service couldn\'t find user with device token');
      console.log('  - Field name mismatch (fcmToken vs deviceToken)');
      console.log('  - Firebase not initialized properly');
      console.log('\n📋 Check server logs with:');
      console.log('  pm2 logs epi-backend --lines 50');
    }
  } else {
    console.log('\n❌ API call failed');
  }

  return result;
}

async function main() {
  try {
    console.log('🚀 Testing Push Notification on Live Server\n');
    console.log('Target API:', `https://${BASE_URL}`);
    console.log('='.repeat(60), '\n');

    // Step 1: Login as user
    const loginSuccess = await loginAsUser();
    if (!loginSuccess) {
      console.log('❌ Cannot proceed without user login');
      console.log('\n💡 To fix: Update TEST_PASSWORD in this script with Nishant\'s password');
      return;
    }

    // Step 2: Trigger notification
    await triggerPushNotification();

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completed!');
    console.log('\nIf pushResult is null, check server logs:');
    console.log('  ssh production "pm2 logs epi-backend --lines 100 | grep -E \'(FCM|Firebase|deviceToken)\'"');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

// Run the test
main();
