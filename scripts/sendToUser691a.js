/**
 * Send Push Notification to User 691af38941
 */

const axios = require('axios');

const PRODUCTION_URL = 'https://api.epielio.com';
const userToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFhZjM4OTQxNWEzZDA3N2MzYmIxNTQiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NTAwMTAxMiwiZXhwIjoxNzY1NjA1ODEyfQ.GzePwiIzKLtbZFfnPnQlCwOJknKH6qKW5QoCf-n3DDA';

async function sendNotification() {
  console.log('📬 Sending Push Notification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Target: User 691af38941`);
  console.log(`URL: ${PRODUCTION_URL}`);
  console.log('');

  const payload = {
    title: '🔔 Test Notification',
    message: 'Hello! This is a test push notification sent at ' + new Date().toLocaleTimeString(),
    sendPush: true,
    sendInApp: true
  };

  console.log('Payload:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('');

  try {
    console.log('Sending...');
    const response = await axios.post(
      `${PRODUCTION_URL}/api/notifications/trigger`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        }
      }
    );

    console.log('');
    console.log('✅ SUCCESS!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Status: ${response.status}`);
    console.log('');
    console.log('Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    if (response.data.data) {
      console.log('📊 Notification Status:');
      console.log(`   Push Notification: ${response.data.data.sentPush ? '✅ Sent' : '❌ Not Sent'}`);
      console.log(`   In-App Notification: ${response.data.data.sentInApp ? '✅ Created' : '❌ Not Created'}`);

      if (response.data.data.pushResult) {
        console.log('   Push Result:', response.data.data.pushResult);
      } else {
        console.log('   Push Result: null (but check server logs for actual delivery status)');
      }
    }

    console.log('');
    console.log('✅ Notification sent successfully!');
    console.log('   Check the user\'s device for the push notification');
    console.log('   Check the app\'s notification feed for the in-app notification');

  } catch (error) {
    console.log('');
    console.log('❌ ERROR!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log('');
      console.log('Response:');
      console.log(JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.log('No response received from server');
      console.log(`Error: ${error.message}`);
    } else {
      console.log(`Error: ${error.message}`);
    }
  }
}

// Run
sendNotification().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
