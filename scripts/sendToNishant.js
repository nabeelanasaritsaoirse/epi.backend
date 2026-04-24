/**
 * Send push notification to nishantprofit1@gmail.com
 */

const https = require('https');

const BASE_URL = 'api.epielio.com';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = 'Admin@123456';
const TARGET_EMAIL = 'nishantprofit1@gmail.com';

let adminToken = null;

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

async function getUserByEmail(email) {
  console.log(`📧 Getting user details for: ${email}`);

  const result = await makeRequest('GET', '/api/users', null, adminToken);

  if (result.statusCode === 200) {
    const users = result.data;
    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (user) {
      console.log('✅ User found:');
      console.log('  - ID:', user._id);
      console.log('  - Name:', user.name);
      console.log('  - Email:', user.email);
      console.log('  - Device Token:', user.deviceToken ? '✅ Present' : '❌ Missing');
      console.log('  - Token:', user.deviceToken ? user.deviceToken.substring(0, 50) + '...' : 'N/A');
      console.log();
      return user;
    } else {
      console.log('❌ User not found');
      return null;
    }
  } else {
    console.log('❌ Failed to get users');
    console.log('Response:', result.data);
    return null;
  }
}

async function sendPushNotification(userId) {
  console.log('🔔 Sending push notification...');

  const result = await makeRequest('POST', '/api/notifications/send-to-user', {
    userId: userId,
    title: '🎉 Test Notification',
    message: 'Testing push notification for nishantprofit1@gmail.com!',
    sendPush: true,
    sendInApp: true
  }, adminToken);

  console.log('\n📊 Response Status:', result.statusCode);
  console.log('📦 Response Data:', JSON.stringify(result.data, null, 2));

  if (result.data.success) {
    console.log('\n✅ Notification sent successfully!');

    if (result.data.data && result.data.data.pushResult) {
      const pushResult = result.data.data.pushResult;
      console.log('\n📱 Push Result:');
      console.log('  - Sent:', pushResult.sent || 0);
      console.log('  - Failed:', pushResult.failed || 0);
      console.log('  - Total Targeted:', pushResult.totalTargeted || 0);

      if (pushResult.sent > 0) {
        console.log('\n🎉 Push notification delivered successfully! Check the device!');
      } else {
        console.log('\n⚠️  Push notification not sent. Check logs.');
      }
    } else {
      console.log('\n⚠️  pushResult is null - notification may not have been sent');
    }
  } else {
    console.log('\n❌ Failed to send notification');
  }

  return result;
}

async function main() {
  try {
    console.log('🚀 Send Push Notification to nishantprofit1@gmail.com\n');
    console.log('Target API:', `https://${BASE_URL}`);
    console.log('='.repeat(60), '\n');

    // Step 1: Admin login
    const loginSuccess = await adminLogin();
    if (!loginSuccess) {
      console.log('❌ Cannot proceed without admin login');
      return;
    }

    // Step 2: Get user details
    const user = await getUserByEmail(TARGET_EMAIL);
    if (!user) {
      console.log('❌ Cannot proceed without user');
      return;
    }

    if (!user.deviceToken) {
      console.log('❌ User does not have a device token. Push notification cannot be sent.');
      return;
    }

    // Step 3: Send push notification
    await sendPushNotification(user._id);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completed!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

// Run the test
main();
