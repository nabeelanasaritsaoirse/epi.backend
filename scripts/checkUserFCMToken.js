/**
 * Check User FCM Token Status
 * Run this on production server to check if user has FCM token
 */

const https = require('https');

const USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTMyNWQ2NTBlNWZhZTBkYTI3MzkxMjIiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NDkzMTE2NCwiZXhwIjoxNzY1NTM1OTY0fQ.AwRgt8wMb_GLK4cvoZKBsmXY3smCsFTbAUsIKYVd5CQ';

function makeRequest() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.epielio.com',
      port: 443,
      path: '/api/users/profile',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${USER_TOKEN}`
      }
    };

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

    req.end();
  });
}

async function checkUser() {
  console.log('🔍 Checking User FCM Token Status\n');

  try {
    const result = await makeRequest();

    if (result.statusCode === 200) {
      const user = result.data.data || result.data;

      console.log('👤 User Information:');
      console.log('   User ID:', user._id);
      console.log('   Name:', user.name || 'N/A');
      console.log('   Phone:', user.phoneNumber || 'N/A');
      console.log('   Email:', user.email || 'N/A');
      console.log('\n📱 FCM Token Status:');

      if (user.deviceToken) {
        console.log('   ✅ FCM Token: Present');
        console.log('   Token:', user.deviceToken);
      } else {
        console.log('   ❌ FCM Token: NOT REGISTERED');
        console.log('\n⚠️  This is why push notifications are not working!');
        console.log('\n💡 Solution:');
        console.log('   The user needs to:');
        console.log('   1. Open the mobile app');
        console.log('   2. Allow notification permissions');
        console.log('   3. The app will automatically register FCM token');
        console.log('   4. Then push notifications will work');
      }
    } else {
      console.log('❌ Failed to fetch user profile');
      console.log('Status:', result.statusCode);
      console.log('Response:', result.data);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkUser();
