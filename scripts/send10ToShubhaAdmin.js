/**
 * Send 10 Push Notifications to Shubha using Admin Endpoint
 * Email: shubhashri.it.saoirse@gmail.com
 */

const https = require('https');

const BASE_URL = 'api.epielio.com';
// Admin token - get this from admin login
const ADMIN_TOKEN = 'YOUR_ADMIN_TOKEN_HERE'; // Replace with actual admin token
const SHUBHA_USER_ID = 'USER_ID_HERE'; // Replace with Shubha's user ID

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
    console.log('🚀 Sending 10 Push Notifications to Shubha (Admin Mode)\n');
    console.log(`Target API: https://${BASE_URL}`);
    console.log(`Email: shubhashri.it.saoirse@gmail.com`);
    console.log(`User ID: ${SHUBHA_USER_ID}`);
    console.log('='.repeat(70) + '\n');

    // Send 10 notifications
    for (let i = 1; i <= 10; i++) {
      console.log(`📤 Sending notification ${i}/10...`);

      const result = await makeRequest('POST', '/api/admin/notifications/send-to-user', {
        userId: SHUBHA_USER_ID,
        title: `🎉 Test Notification #${i}`,
        message: `This is test push notification number ${i} sent to Shubha by admin. Testing FCM service! 🚀`,
        sendPush: true,
        sendInApp: true,
        data: {
          testNumber: i.toString(),
          type: 'ADMIN_TEST'
        }
      }, ADMIN_TOKEN);

      if (result.statusCode === 200 && result.data.success) {
        console.log(`   ✅ Notification ${i} sent successfully!`);
        if (result.data.data) {
          console.log(`      In-App: ${result.data.data.inAppCreated ? 'Yes' : 'No'}`);
          console.log(`      Push: ${result.data.data.pushSent ? 'Yes' : 'No'}`);
        }
      } else if (result.statusCode === 401) {
        console.log(`   ❌ Notification ${i} failed - Not authorized`);
        console.log('   Please update ADMIN_TOKEN in the script');
        break;
      } else {
        console.log(`   ❌ Notification ${i} failed - Status ${result.statusCode}`);
        console.log(`      Error: ${result.data.message || 'Unknown error'}`);
      }

      // Wait 2 seconds between notifications
      if (i < 10) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Finished sending 10 notifications!');
    console.log('Check Shubha\'s device for the push notifications.');
    console.log('\n📊 Server logs to check:');
    console.log('ssh ubuntu@13.127.101.211');
    console.log('pm2 logs epi-backend --lines 50 | grep -E "FCM|Shubha"');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

main();
