/**
 * Send 10 test PUSH notifications to Shubha
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { sendPushNotification } = require('../services/fcmService');

async function sendTestNotifications() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find user by email
    const user = await User.findOne({ email: 'shubhashri.it.saoirse@gmail.com' });

    if (!user) {
      console.error('❌ User not found with email: shubhashri.it.saoirse@gmail.com');
      process.exit(1);
    }

    console.log(`✅ User found: ${user.name} (${user._id})`);
    console.log(`   Device Token: ${user.deviceToken ? 'Yes' : 'No'}`);

    if (!user.deviceToken) {
      console.error('❌ User does not have a device token registered');
      process.exit(1);
    }

    // Send 10 PUSH notifications
    console.log('\n📤 Sending 10 PUSH notifications...\n');

    for (let i = 1; i <= 10; i++) {
      const result = await sendPushNotification(user._id, {
        title: `Test Notification #${i}`,
        body: `This is test push notification number ${i} sent to Shubha`,
        data: {
          testNumber: String(i),
          timestamp: Date.now().toString(),
          type: 'TEST_NOTIFICATION'
        }
      });

      console.log(`${i}. Push #${i}: Success=${result.success}, Sent=${result.sent || 0}, Failed=${result.failed || 0}`);

      // Wait 2 seconds between notifications to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n✅ All 10 push notifications sent!');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

sendTestNotifications();
