/**
 * Send 10 test PUSH notifications to Shubha on PRODUCTION
 */

const axios = require('axios');

const PRODUCTION_URL = 'https://api.saoirse.in';

// You need to get admin credentials - use the admin login endpoint
async function sendNotifications() {
  try {
    console.log('📤 Sending 10 PUSH notifications to Shubha on PRODUCTION...\n');

    // Login as admin first (you'll need admin credentials)
    console.log('⚠️  You need to login as admin first to get the token.');
    console.log('⚠️  Use the admin panel or provide admin credentials here.\n');

    // Example: Replace with actual admin token
    const ADMIN_TOKEN = 'YOUR_ADMIN_TOKEN_HERE';

    // Find Shubha's user ID
    const email = 'shubhashri.it.saoirse@gmail.com';

    // Send 10 notifications using admin endpoint
    for (let i = 1; i <= 10; i++) {
      try {
        const response = await axios.post(
          `${PRODUCTION_URL}/api/admin/notifications/send-to-user`,
          {
            email: email,
            title: `Test Notification #${i}`,
            body: `This is test push notification number ${i} sent to Shubha`,
            data: {
              testNumber: String(i),
              timestamp: Date.now().toString(),
              type: 'TEST_NOTIFICATION'
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${ADMIN_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );

        console.log(`${i}. Push #${i}: ✅ Success`);
      } catch (error) {
        console.log(`${i}. Push #${i}: ❌ Failed - ${error.response?.data?.message || error.message}`);
      }

      // Wait 2 seconds between notifications
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n✅ Finished sending notifications!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

sendNotifications();
