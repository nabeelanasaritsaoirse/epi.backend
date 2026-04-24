/**
 * Final Push Notification Test
 * Tests if Firebase Admin SDK update fixed push notifications
 */

const https = require('https');

const BASE_URL = 'https://api.epielio.com';
const USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTMyNWQ2NTBlNWZhZTBkYTI3MzkxMjIiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NDkzMTE2NCwiZXhwIjoxNzY1NTM1OTY0fQ.AwRgt8wMb_GLK4cvoZKBsmXY3smCsFTbAUsIKYVd5CQ';

const testData = {
  title: '🎉 Firebase Test',
  message: 'Testing push notifications after Firebase Admin SDK update!',
  sendPush: true,
  sendInApp: true
};

function makeRequest(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);

    const options = {
      hostname: 'api.epielio.com',
      port: 443,
      path: '/api/notifications/trigger',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${USER_TOKEN}`,
        'Content-Length': Buffer.byteLength(postData)
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

    req.write(postData);
    req.end();
  });
}

async function runTest() {
  console.log('🚀 Testing Push Notifications After Firebase Update\n');
  console.log('Target URL:', BASE_URL + '/api/notifications/trigger');
  console.log('Test Data:', JSON.stringify(testData, null, 2));
  console.log('\n⏳ Sending request...\n');

  try {
    const result = await makeRequest(testData);

    console.log('📊 Response Status:', result.statusCode);
    console.log('📦 Response Data:', JSON.stringify(result.data, null, 2));

    if (result.statusCode === 200) {
      console.log('\n✅ API call successful!');

      const { data } = result.data;

      if (data.pushResult && data.pushResult !== null) {
        console.log('\n🎉 SUCCESS! Firebase push notification sent!');
        console.log('Push Result:', JSON.stringify(data.pushResult, null, 2));
        console.log('\n✅ Firebase Admin SDK is working correctly!');
        console.log('✅ The sendMulticast() function is now available!');
      } else {
        console.log('\n⚠️  Warning: pushResult is null');
        console.log('This might mean:');
        console.log('- No FCM token registered for the user');
        console.log('- Firebase still not fully initialized');
        console.log('- Server needs another restart');
      }
    } else {
      console.log('\n❌ API call failed with status:', result.statusCode);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

runTest();
