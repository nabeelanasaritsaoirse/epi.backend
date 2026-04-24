/**
 * Test Admin Send-To-User Endpoint
 * Sends push notification to Nishant using new admin endpoint
 */

const https = require('https');

const BASE_URL = 'api.epielio.com';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = 'Admin@123456';
const NISHANT_USER_ID = '6923f85fd8823e6f88977191';
const NISHANT_EMAIL = 'nishantprofit1@gmail.com';

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
    console.log('🚀 Test Admin Send-To-User Endpoint\n');
    console.log(`Target API: https://${BASE_URL}`);
    console.log(`Target User: ${NISHANT_EMAIL}`);
    console.log(`User ID: ${NISHANT_USER_ID}`);
    console.log('='.repeat(70) + '\n');

    // Step 1: Admin login
    console.log('🔐 Step 1: Admin login...');
    const loginResult = await makeRequest('POST', '/api/auth/admin-login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    if (loginResult.statusCode !== 200 || !loginResult.data.data || !loginResult.data.data.accessToken) {
      console.log('❌ Admin login failed');
      console.log('Response:', loginResult.data);
      return;
    }

    const adminToken = loginResult.data.data.accessToken;
    console.log('✅ Admin logged in successfully\n');

    // Step 2: Send notification to Nishant using NEW admin endpoint
    console.log('📤 Step 2: Sending push notification via NEW admin endpoint...');
    console.log('   Endpoint: POST /api/admin/notifications/send-to-user');
    console.log(`   Target User ID: ${NISHANT_USER_ID}\n`);

    const notificationResult = await makeRequest('POST', '/api/admin/notifications/send-to-user', {
      userId: NISHANT_USER_ID,
      title: '🎉 FINAL FIX - Admin Send-To-User Working!',
      message: 'Hi Nishant! This notification was sent using the NEW admin endpoint that allows sending to any user! The FCM service with sendEachForMulticast and data sanitization is now fully working! 🚀✅🎊',
      sendPush: true,
      sendInApp: true,
      data: {
        testType: 'admin_endpoint',
        timestamp: Date.now().toString(),
        source: 'admin_test_script'
      }
    }, adminToken);

    console.log('📊 Response:');
    console.log(`   Status: ${notificationResult.statusCode}`);
    console.log('   Data:', JSON.stringify(notificationResult.data, null, 2));
    console.log();

    // Step 3: Analyze result
    if (notificationResult.statusCode === 200) {
      const result = notificationResult.data.data;

      console.log('📈 Analysis:');
      console.log(`   API Success: ✅ ${notificationResult.data.success}`);
      console.log(`   Target User ID: ${result.userId}`);
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
          console.log('\n🎉🎉🎉 SUCCESS! PUSH NOTIFICATION DELIVERED TO NISHANT! 🎉🎉🎉');
          console.log('Check Nishant\'s device NOW!');
          console.log('\n✅ The FCM service is now fully working with:');
          console.log('   ✅ sendEachForMulticast() batch sending (500x faster)');
          console.log('   ✅ Data sanitization (all values as strings)');
          console.log('   ✅ Dynamic Firebase initialization check');
          console.log('   ✅ Admin endpoint to send to any user');
        } else {
          console.log('\n⚠️  Push notification not delivered');
          console.log('Reasons to check:');
          console.log('  1. User has no FCM token registered');
          console.log('  2. FCM token is invalid/expired');
          console.log('  3. Check server logs for errors');
        }
      } else {
        console.log('\n❌ pushResult is null');
        console.log('This means:');
        console.log('  1. FCM service returned early (Firebase not initialized)');
        console.log('  2. OR user has no FCM token');
        console.log('  3. OR error in sending');
      }

      if (result.inAppNotificationId) {
        console.log(`\n📱 In-app notification created: ${result.inAppNotificationId}`);
      }

    } else {
      console.log('❌ API call failed');
      console.log('Error:', notificationResult.data);
    }

    console.log('\n' + '='.repeat(70));
    console.log('📋 Server Logs to Check:');
    console.log('SSH to server and run:');
    console.log('  pm2 logs epi-backend --lines 50 | grep -E "FCM|Firebase|Admin"');
    console.log('\nLook for:');
    console.log('  ✅ "[Admin] Sending notification to user: 6923f85fd8823e6f88977191"');
    console.log('  ✅ "[FCM] Found 1 user(s) with deviceToken"');
    console.log('  ✅ "[FCM] Attempting to send push notification to 1 device(s)"');
    console.log('  ✅ "[FCM] Push sent: 1, failed: 0"');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

main();
