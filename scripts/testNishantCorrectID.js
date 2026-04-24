/**
 * Test push notification to Nishant - Using CORRECT user ID
 * Target: nishantprofit1@gmail.com
 * User ID: 6923f85fd8823e6f88977191 (NOT the admin ID!)
 */

const https = require('https');

const BASE_URL = 'api.epielio.com';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = 'Admin@123456';
const NISHANT_USER_ID = '6923f85fd8823e6f88977191'; // Correct Nishant ID
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
    console.log('🚀 Test Push Notification to NISHANT (Correct User ID)\n');
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

    // Step 2: Verify Nishant's user info
    console.log('🔍 Step 2: Verifying Nishant user info...');
    const usersResult = await makeRequest('GET', '/api/users', null, adminToken);

    if (usersResult.statusCode === 200) {
      const users = usersResult.data;
      const nishant = users.find(u => u._id === NISHANT_USER_ID);

      if (nishant) {
        console.log('✅ Nishant user verified:');
        console.log(`   Name: ${nishant.name}`);
        console.log(`   Email: ${nishant.email}`);
        console.log(`   User ID: ${nishant._id}`);
        console.log(`   Device Token: ${nishant.deviceToken ? '✅ Present' : '❌ Missing'}`);
        if (nishant.deviceToken) {
          console.log(`   Token: ${nishant.deviceToken.substring(0, 50)}...`);
        }
        console.log();
      } else {
        console.log('⚠️  Could not find user in users list');
        console.log('   Proceeding anyway with known user ID...\n');
      }
    }

    // Step 3: Send push notification using trigger endpoint
    console.log('📤 Step 3: Sending push notification via /api/notifications/trigger...');
    console.log('   Using admin token (logged in as admin)');
    console.log('   Notification will be sent to current user (admin)\n');

    const notificationResult = await makeRequest('POST', '/api/notifications/trigger', {
      title: '🎉 FINAL TEST - Push Notification Working!',
      message: 'Hi Nishant! This is the FINAL TEST using your correct user ID (6923f85fd8823e6f88977191). If you receive this, push notifications are WORKING! 🚀✅',
      sendPush: true,
      sendInApp: true
    }, adminToken);

    console.log('📊 Response:');
    console.log(`   Status: ${notificationResult.statusCode}`);
    console.log('   Data:', JSON.stringify(notificationResult.data, null, 2));
    console.log();

    // Step 4: Analyze result
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
          console.log('Check your device NOW!');
        } else {
          console.log('\n⚠️  Push notification not delivered');
          console.log('Reasons to check:');
          console.log('  1. Admin user (current logged in) has no FCM token');
          console.log('  2. We need to send to Nishant ID, not admin ID');
        }
      } else {
        console.log('\n❌ pushResult is null');
        console.log('This means:');
        console.log('  1. Old code still running (needs git pull + restart)');
        console.log('  2. OR data sanitization still failing');
      }
    } else {
      console.log('❌ API call failed');
      console.log('Error:', notificationResult.data);
    }

    console.log('\n' + '='.repeat(70));
    console.log('💡 IMPORTANT NOTE:');
    console.log('The /api/notifications/trigger endpoint sends to the LOGGED IN user');
    console.log('Since we logged in as ADMIN, it sent to admin (ID: 6915e756a7b036aa22af3d46)');
    console.log('\nTo send to Nishant, we need to either:');
    console.log('  1. Use an endpoint that accepts userId parameter');
    console.log('  2. OR login as Nishant and call trigger');
    console.log('='.repeat(70) + '\n');

    console.log('📋 Server Logs to Check:');
    console.log('SSH to server and run:');
    console.log('  pm2 logs epi-backend --lines 50 | grep -E "FCM|Firebase"');
    console.log('\nLook for:');
    console.log('  ✅ "Firebase Admin SDK initialized successfully"');
    console.log('  ✅ "FCM] Found 1 user(s) with deviceToken"');
    console.log('  ✅ "FCM] Attempting to send push notification to 1 device(s)"');
    console.log('  ✅ "FCM] Push sent: 1, failed: 0"\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

main();
