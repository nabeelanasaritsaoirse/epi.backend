/**
 * Admin Push Notification Test
 * Uses admin credentials to check user FCM token and test push notifications
 */

const https = require('https');

const BASE_URL = 'https://api.epielio.com';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = 'Admin@123456';
const USER_ID = '69325d650e5fae0da2739122'; // User from the token

let adminToken = null;

function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.epielio.com',
      port: 443,
      path: path,
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
          resolve({ statusCode: res.statusCode, data: response });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function adminLogin() {
  console.log('🔐 Admin Login...');

  const result = await makeRequest('POST', '/api/auth/admin-login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD
  });

  if (result.statusCode === 200 && result.data.data && result.data.data.accessToken) {
    adminToken = result.data.data.accessToken;
    console.log('✅ Admin logged in successfully\n');
    return true;
  } else {
    console.log('❌ Admin login failed');
    console.log('Response:', result.data);
    return false;
  }
}

async function getUserDetails() {
  console.log('👤 Fetching user details...');
  console.log('   User ID:', USER_ID);

  const result = await makeRequest('GET', `/api/admin/users/${USER_ID}`, null, adminToken);

  if (result.statusCode === 200) {
    const user = result.data.data || result.data;

    console.log('\n📋 User Information:');
    console.log('   Name:', user.name || 'N/A');
    console.log('   Phone:', user.phoneNumber || 'N/A');
    console.log('   Email:', user.email || 'N/A');
    console.log('\n📱 FCM Token Status:');

    if (user.deviceToken) {
      console.log('   ✅ FCM Token: PRESENT');
      console.log('   Token (first 50 chars):', user.deviceToken.substring(0, 50) + '...');
      return { hasFCMToken: true, user };
    } else {
      console.log('   ❌ FCM Token: NOT REGISTERED');
      console.log('\n⚠️  This user has NO FCM token!');
      console.log('   This is why pushResult is null.');
      console.log('\n💡 The user needs to:');
      console.log('   1. Open the mobile app');
      console.log('   2. Allow notification permissions');
      console.log('   3. App will register FCM token automatically');
      return { hasFCMToken: false, user };
    }
  } else {
    console.log('❌ Failed to fetch user details');
    console.log('Response:', result.data);
    return { hasFCMToken: false, user: null };
  }
}

async function sendTestNotification() {
  console.log('\n🚀 Sending Test Push Notification...\n');

  const testData = {
    title: '🎉 Admin Test Push',
    message: 'Testing push notification from admin! If you see this, Firebase is working!',
    sendPush: true,
    sendInApp: true
  };

  const result = await makeRequest('POST', '/api/notifications/trigger', testData, adminToken);

  console.log('📊 Response Status:', result.statusCode);
  console.log('📦 Response Data:', JSON.stringify(result.data, null, 2));

  if (result.statusCode === 200) {
    const { data } = result.data;

    console.log('\n📈 Results:');
    console.log('   Sent Push:', data.sentPush);
    console.log('   Sent In-App:', data.sentInApp);
    console.log('   Push Result:', data.pushResult || 'null');

    if (data.pushResult && data.pushResult !== null) {
      console.log('\n🎉 SUCCESS! Firebase push notification sent!');
      console.log('✅ Firebase Admin SDK is working correctly!');
      console.log('✅ FCM sendMulticast() function is available!');
      console.log('\n📱 Check the device for notification!');
    } else {
      console.log('\n⚠️  pushResult is null');
      console.log('\nPossible reasons:');
      console.log('1. ❌ User has no FCM token (most common)');
      console.log('2. ❌ Firebase Admin SDK not initialized');
      console.log('3. ❌ FCM token is invalid/expired');
    }
  } else {
    console.log('\n❌ Failed to send notification');
  }
}

async function runTest() {
  console.log('🧪 Admin Push Notification Test\n');
  console.log('=' .repeat(60));
  console.log('\n');

  try {
    // Step 1: Login as admin
    const loginSuccess = await adminLogin();
    if (!loginSuccess) {
      console.log('\n❌ Cannot proceed without admin access');
      return;
    }

    // Step 2: Check user's FCM token
    const { hasFCMToken } = await getUserDetails();

    // Step 3: Send test notification
    await sendTestNotification();

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📝 Summary:\n');

    if (hasFCMToken) {
      console.log('✅ User HAS FCM token registered');
      console.log('🔍 If pushResult is still null, check:');
      console.log('   1. Firebase Admin SDK initialization on production');
      console.log('   2. Run: pm2 logs epi-backend | grep -i firebase');
      console.log('   3. Should see: "✅ Firebase Admin SDK initialized successfully"');
    } else {
      console.log('❌ User does NOT have FCM token');
      console.log('💡 Solution: User needs to open app and allow notifications');
      console.log('📝 This is the EXPECTED behavior - not a bug!');
    }

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

runTest();
