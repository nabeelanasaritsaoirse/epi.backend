/**
 * Test Live Notification - Send to nishantprofit1@gmail.com
 * Tests the production API at https://api.epielio.com
 */

const https = require('https');

const LIVE_API_URL = 'https://api.epielio.com';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = 'Admin@123456';
const TARGET_USER_EMAIL = 'nishantprofit1@gmail.com';

/**
 * Make HTTPS request
 */
function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, LIVE_API_URL);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
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
          const response = JSON.parse(body);
          resolve({ status: res.statusCode, data: response });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
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

async function testLiveNotification() {
  try {
    console.log('🚀 Testing Live Notification System\n');
    console.log(`📡 API: ${LIVE_API_URL}`);
    console.log(`👤 Target User: ${TARGET_USER_EMAIL}\n`);

    // Step 1: Admin Login
    console.log('🔑 Step 1: Logging in as admin...\n');

    const loginResponse = await makeRequest('POST', '/api/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    if (loginResponse.status !== 200 || !loginResponse.data.token) {
      console.log('❌ Admin login failed!');
      console.log(`   Status: ${loginResponse.status}`);
      console.log(`   Response:`, loginResponse.data);
      process.exit(1);
    }

    const adminToken = loginResponse.data.token;
    console.log('✅ Admin login successful');
    console.log(`   Token: ${adminToken.substring(0, 30)}...\n`);

    // Step 2: Find user by email
    console.log('🔍 Step 2: Finding user by email...\n');

    const usersResponse = await makeRequest('GET', `/api/admin/users?email=${TARGET_USER_EMAIL}`, null, adminToken);

    if (usersResponse.status !== 200) {
      console.log('❌ Failed to fetch users!');
      console.log(`   Status: ${usersResponse.status}`);
      console.log(`   Response:`, usersResponse.data);
      process.exit(1);
    }

    const users = usersResponse.data.users || usersResponse.data.data?.users || usersResponse.data;

    if (!users || users.length === 0) {
      console.log('❌ User not found with email:', TARGET_USER_EMAIL);
      console.log('   Response:', usersResponse.data);
      process.exit(1);
    }

    const targetUser = users[0];
    console.log('✅ User found!');
    console.log(`   Name: ${targetUser.name}`);
    console.log(`   Email: ${targetUser.email}`);
    console.log(`   User ID: ${targetUser._id || targetUser.id}`);
    console.log(`   Has FCM Token: ${targetUser.deviceToken ? 'Yes ✅' : 'No ❌'}`);

    if (targetUser.deviceToken) {
      console.log(`   Token: ${targetUser.deviceToken.substring(0, 30)}...`);
    }
    console.log('');

    const userId = targetUser._id || targetUser.id;

    // Step 3: Send notification
    console.log('📤 Step 3: Sending push notification...\n');

    const notificationPayload = {
      title: '🎉 Test Notification from Live Server',
      message: 'Hello Nishant! This is a test notification from the upgraded FCM service using sendEachForMulticast. If you see this, everything is working perfectly!',
      sendPush: true,
      sendInApp: true,
      userId: userId
    };

    console.log('📝 Notification payload:');
    console.log(JSON.stringify(notificationPayload, null, 2));
    console.log('');

    const notificationResponse = await makeRequest('POST', '/api/notifications/trigger', notificationPayload, adminToken);

    console.log('📊 Response:');
    console.log(`   Status: ${notificationResponse.status}`);
    console.log(`   Data:`, JSON.stringify(notificationResponse.data, null, 2));
    console.log('');

    // Analyze the response
    if (notificationResponse.status === 200 || notificationResponse.status === 201) {
      const result = notificationResponse.data;

      console.log('✅ API call successful!\n');

      if (result.sentPush) {
        console.log('✅ Push notification sent!');

        if (result.pushResult) {
          console.log(`   Sent: ${result.pushResult.sent || 0}`);
          console.log(`   Failed: ${result.pushResult.failed || 0}`);

          if (result.pushResult.sent > 0) {
            console.log('\n🎉 SUCCESS! Check the mobile device for notification!\n');
          } else if (result.pushResult.failed > 0) {
            console.log('\n⚠️  Notification failed to send');
            console.log('   Possible reasons:');
            console.log('   - User has no FCM token registered');
            console.log('   - FCM token is invalid/expired');
            console.log('   - Firebase not initialized on server\n');
          }
        } else {
          console.log('   ⚠️  pushResult is null');
          console.log('   This usually means Firebase is not initialized on the server\n');
        }
      } else {
        console.log('❌ Push notification not sent');
        console.log('   Reason:', result.reason || 'Unknown');
      }

      if (result.sentInApp) {
        console.log('✅ In-app notification created');
      }

    } else {
      console.log('❌ Notification API call failed!');
      console.log(`   Status: ${notificationResponse.status}`);
      console.log(`   Error:`, notificationResponse.data);
    }

    // Step 4: Check server logs suggestion
    console.log('\n📋 Next Steps:\n');

    if (!targetUser.deviceToken) {
      console.log('⚠️  USER HAS NO FCM TOKEN!');
      console.log('   The user needs to:');
      console.log('   1. Open the mobile app');
      console.log('   2. Allow notification permissions');
      console.log('   3. Login to register FCM token\n');
    } else {
      console.log('🔍 To check server logs:');
      console.log('   ssh to production server and run:');
      console.log('   pm2 logs epi-backend --lines 100 | grep -E "FCM|Firebase"\n');

      console.log('🔍 Look for these messages:');
      console.log('   ✅ "Firebase Admin SDK initialized successfully"');
      console.log('   ✅ "FCM] Attempting to send push notification"');
      console.log('   ✅ "FCM] Push sent: 1, failed: 0"\n');

      console.log('   OR error messages:');
      console.log('   ❌ "Firebase Admin SDK NOT initialized"');
      console.log('   ❌ "FCM] Error sending push notification"\n');
    }

    console.log('✅ Test complete!\n');

  } catch (error) {
    console.error('\n❌ Error during test:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testLiveNotification();
