/**
 * Test Push Notification on Live Server using Admin
 * Checks if there's an admin endpoint to send push to specific user
 */

const https = require('https');

const BASE_URL = 'api.epielio.com';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = 'Admin@123456';
const TARGET_USER_ID = '6923f85fd8823e6f88977191'; // Nishant's user ID

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

async function testEndpoint(method, path, data = null) {
  console.log(`\n📡 Testing: ${method} ${path}`);
  console.log('Data:', data ? JSON.stringify(data, null, 2) : 'None');

  const result = await makeRequest(method, path, data, adminToken);

  console.log('Status:', result.statusCode);
  console.log('Response:', JSON.stringify(result.data, null, 2));

  return result;
}

async function main() {
  try {
    console.log('🚀 Testing Live API - Admin Push Notification\n');
    console.log('Target API:', `https://${BASE_URL}`);
    console.log('Target User ID:', TARGET_USER_ID);
    console.log('='.repeat(60), '\n');

    // Step 1: Admin login
    const loginSuccess = await adminLogin();
    if (!loginSuccess) {
      console.log('❌ Cannot proceed without admin login');
      return;
    }

    // Step 2: Try different admin endpoints that might exist
    console.log('🔍 Searching for admin notification endpoints...\n');

    // Test 1: Direct admin notification endpoint
    await testEndpoint('POST', '/api/admin/notifications/send', {
      userId: TARGET_USER_ID,
      title: '🎉 Admin Test',
      message: 'Testing from admin endpoint',
      sendPush: true,
      sendInApp: true
    });

    // Test 2: Admin broadcast endpoint
    await testEndpoint('POST', '/api/admin/notifications/send-to-user', {
      userId: TARGET_USER_ID,
      title: '🎉 Admin Test',
      message: 'Testing from admin endpoint',
      sendPush: true
    });

    // Test 3: Check if admin can use regular trigger endpoint
    await testEndpoint('POST', '/api/notifications/trigger', {
      title: '🎉 Admin Trigger Test',
      message: 'Testing from regular trigger as admin',
      sendPush: true,
      sendInApp: true
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completed!');
    console.log('\nIf all endpoints returned 404, you may need to:');
    console.log('1. Check server logs for FCM service output');
    console.log('2. Run the script directly on production server');
    console.log('3. See SEND_PUSH_TO_NISHANT.md for production commands');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

// Run the test
main();
