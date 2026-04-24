/**
 * Send 10 Push Notifications to Shubha
 * Email: shubhashri.it.saoirse@gmail.com
 */

const https = require('https');

const BASE_URL = 'api.epielio.com';
// You need to provide Shubha's user token here
const USER_TOKEN = 'SHUBHA_USER_TOKEN_HERE'; // Replace with actual token

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
    console.log('🚀 Sending 10 Push Notifications to Shubha\n');
    console.log(`Target API: https://${BASE_URL}`);
    console.log(`Email: shubhashri.it.saoirse@gmail.com`);
    console.log('='.repeat(70) + '\n');

    // Send 10 notifications
    for (let i = 1; i <= 10; i++) {
      console.log(`📤 Sending notification ${i}/10...`);

      const result = await makeRequest('POST', '/api/notifications/trigger', {
        title: `🎉 Test Notification #${i}`,
        message: `This is test push notification number ${i} sent to Shubha. Testing FCM service! 🚀`,
        sendPush: true,
        sendInApp: true
      }, USER_TOKEN);

      if (result.statusCode === 200) {
        const pushResult = result.data.data?.pushResult;
        if (pushResult && pushResult.sent > 0) {
          console.log(`   ✅ Notification ${i} delivered successfully!`);
        } else {
          console.log(`   ⚠️  Notification ${i} API success but push not delivered`);
        }
      } else if (result.statusCode === 401) {
        console.log(`   ❌ Notification ${i} failed - Token expired or invalid`);
        console.log('   Please update USER_TOKEN in the script');
        break;
      } else {
        console.log(`   ❌ Notification ${i} failed - Status ${result.statusCode}`);
      }

      // Wait 2 seconds between notifications
      if (i < 10) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Finished sending 10 notifications!');
    console.log('Check Shubha\'s device for the push notifications.');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

main();
