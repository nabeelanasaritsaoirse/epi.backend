/**
 * Send Push Notification to New User (Angelo mathew)
 * User ID: 69334f2cd89d15d25dccfe84
 * Email: angelomathew319@gmail.com
 */

const https = require('https');

const BASE_URL = 'api.epielio.com';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = 'Admin@123456';
const NEW_USER_ID = '69334f2cd89d15d25dccfe84';

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
    console.log('🚀 Send Push Notification to New User (Angelo mathew)\n');
    console.log(`Target API: https://${BASE_URL}`);
    console.log(`User ID: ${NEW_USER_ID}`);
    console.log(`Email: angelomathew319@gmail.com`);
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

    // Step 2: Send notification using admin endpoint
    console.log('📤 Step 2: Sending push notification via admin endpoint...');
    console.log('   Endpoint: POST /api/admin/notifications/send-to-user\n');

    const notificationResult = await makeRequest('POST', '/api/admin/notifications/send-to-user', {
      userId: NEW_USER_ID,
      title: '🎉 Welcome to Epi!',
      message: 'Hello Angelo! Welcome to Epi! This is a test push notification to verify that our notification system is working. If you receive this, everything is set up correctly! 🚀',
      sendPush: true,
      sendInApp: true,
      data: {
        type: 'welcome',
        timestamp: Date.now().toString(),
        source: 'admin_test'
      }
    }, adminToken);

    console.log('📊 Response:');
    console.log(`   Status: ${notificationResult.statusCode}`);
    console.log('   Data:', JSON.stringify(notificationResult.data, null, 2));
    console.log();

    // Analyze result
    if (notificationResult.statusCode === 200) {
      const result = notificationResult.data.data;

      console.log('📈 Analysis:');
      console.log(`   API Success: ✅ ${notificationResult.data.success}`);
      console.log(`   User ID: ${result.userId}`);
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
          console.log('Check Angelo\'s device NOW!');
        } else {
          console.log('\n⚠️  Push notification not delivered');
          console.log('User may not have FCM token or server has old code');
        }
      } else {
        console.log('\n❌ pushResult is null');
        console.log('Server still running OLD CODE - needs update!');
      }

      if (result.inAppNotificationId) {
        console.log(`\n📱 In-app notification created: ${result.inAppNotificationId}`);
      }

    } else {
      console.log('❌ API call failed');
      console.log('Error:', notificationResult.data);
    }

    console.log('\n' + '='.repeat(70));
    console.log('⚠️  IMPORTANT: Server is still running OLD CODE');
    console.log('To fix, run on production server:');
    console.log('  pm2 stop all && pm2 delete all');
    console.log('  fuser -k 5000/tcp');
    console.log('  cd /var/www/epi-backend');
    console.log('  git pull origin main');
    console.log('  pm2 start index.js --name epi-backend');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

main();
