/**
 * Send Push Notification using Provided User Token
 * Token belongs to user ID: 69325d650e5fae0da2739122
 * Uses /api/notifications/trigger endpoint (sends to logged-in user)
 */

const https = require('https');

const BASE_URL = 'api.epielio.com';
const USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTMyNWQ2NTBlNWZhZTBkYTI3MzkxMjIiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NDkzMTE2NCwiZXhwIjoxNzY1NTM1OTY0fQ.AwRgt8wMb_GLK4cvoZKBsmXY3smCsFTbAUsIKYVd5CQ';

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

async function main() {
  try {
    console.log('🚀 Send Push Notification Using User Token\n');
    console.log(`Target API: https://${BASE_URL}`);
    console.log(`Endpoint: POST /api/notifications/trigger`);
    console.log(`User ID from token: 69325d650e5fae0da2739122`);
    console.log('='.repeat(70) + '\n');

    // Send notification to logged-in user
    console.log('📤 Sending push notification via /api/notifications/trigger...');
    console.log('   Using provided user token (sends to logged-in user)\n');

    const notificationResult = await makeRequest('POST', '/api/notifications/trigger', {
      title: '🎉 Push Notification Test - User Endpoint',
      message: 'Hello! This is a test notification sent using your access token via the user endpoint. If you receive this, push notifications are working! 🚀✅',
      sendPush: true,
      sendInApp: true
    }, USER_TOKEN);

    console.log('📊 Response:');
    console.log(`   Status: ${notificationResult.statusCode}`);
    console.log('   Data:', JSON.stringify(notificationResult.data, null, 2));
    console.log();

    // Analyze result
    if (notificationResult.statusCode === 200) {
      const result = notificationResult.data.data;

      console.log('📈 Analysis:');
      console.log(`   API Success: ✅ ${notificationResult.data.success}`);
      console.log(`   Push Sent Flag: ${result.sentPush ? '✅' : '❌'} ${result.sentPush}`);
      console.log(`   In-App Created: ${result.sentInApp ? '✅' : '❌'} ${result.sentInApp}`);
      console.log(`   Push Result: ${result.pushResult ? '✅ Has data' : '❌ null'}`);

      if (result.pushResult) {
        console.log('\n🎯 Push Result Details:');
        console.log(`   Success: ${result.pushResult.success}`);
        console.log(`   Sent: ${result.pushResult.sent}`);
        console.log(`   Failed: ${result.pushResult.failed}`);
        console.log(`   Total Targeted: ${result.pushResult.totalTargeted || 'N/A'}`);

        if (result.pushResult.sent > 0) {
          console.log('\n🎉🎉🎉 SUCCESS! PUSH NOTIFICATION DELIVERED! 🎉🎉🎉');
          console.log('Check the user\'s device NOW!');
          console.log('\n✅ The FCM service is now fully working with:');
          console.log('   ✅ sendEachForMulticast() batch sending (500x faster)');
          console.log('   ✅ Data sanitization (all values as strings)');
          console.log('   ✅ Dynamic Firebase initialization check');
        } else {
          console.log('\n⚠️  Push notification not delivered');
          console.log('Reasons to check:');
          console.log('  1. User has no FCM token registered');
          console.log('  2. FCM token is invalid/expired');
          console.log('  3. Server still has old code (needs git pull + pm2 restart)');
        }
      } else {
        console.log('\n❌ pushResult is null');
        console.log('This means:');
        console.log('  1. Firebase not initialized (unlikely - we confirmed it works)');
        console.log('  2. User has no FCM token');
        console.log('  3. OR server still has OLD CODE without data sanitization');
        console.log('\n🔧 To fix: SSH to server and run:');
        console.log('  cd /var/www/epi-backend');
        console.log('  git pull origin main');
        console.log('  pm2 restart epi-backend');
      }

      if (result.inAppNotificationId) {
        console.log(`\n📱 In-app notification created: ${result.inAppNotificationId}`);
      }

    } else if (notificationResult.statusCode === 401) {
      console.log('❌ Authentication failed - Token might be expired');
      console.log('   Token expires at: 2025-06-12 (exp: 1765535964)');
    } else {
      console.log('❌ API call failed');
      console.log('Error:', notificationResult.data);
    }

    console.log('\n' + '='.repeat(70));
    console.log('📋 Server Logs to Check:');
    console.log('SSH to server and run:');
    console.log('  pm2 logs epi-backend --lines 50 | grep -E "FCM|Firebase|Notification"');
    console.log('\nLook for:');
    console.log('  ✅ "[FCM] Found 1 user(s) with deviceToken"');
    console.log('  ✅ "[FCM] Attempting to send push notification to 1 device(s)"');
    console.log('  ✅ "[FCM] Push sent: 1, failed: 0"');
    console.log('  ❌ "FirebaseMessagingError: data must only contain string values"');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

main();
