/**
 * Direct FCM push notification test to Nishant
 * Uses FCM service directly with admin privileges
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { sendPushNotification } = require('../services/fcmService');
const User = require('../models/User');

const TARGET_EMAIL = 'nishantprofit1@gmail.com';

async function main() {
  try {
    console.log('🚀 Direct Push Notification Test to Nishant\n');

    // Connect to MongoDB
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find user
    console.log(`🔍 Finding user: ${TARGET_EMAIL}`);
    const user = await User.findOne({ email: TARGET_EMAIL });

    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }

    console.log('✅ User found:');
    console.log('  - ID:', user._id);
    console.log('  - Name:', user.name);
    console.log('  - Email:', user.email);
    console.log('  - Device Token:', user.deviceToken ? '✅ Present' : '❌ Missing');

    if (!user.deviceToken) {
      console.log('\n❌ User does not have a device token. Cannot send push notification.');
      process.exit(1);
    }

    console.log('  - Token:', user.deviceToken.substring(0, 50) + '...\n');

    // Send push notification
    console.log('🔔 Sending push notification via FCM service...\n');

    const result = await sendPushNotification(user._id.toString(), {
      title: '🎉 Direct FCM Test',
      body: 'Testing push notification directly from FCM service to Nishant!',
      data: {
        type: 'TEST',
        timestamp: Date.now().toString()
      }
    });

    console.log('📊 Push Result:', JSON.stringify(result, null, 2));

    if (result.success && result.sent > 0) {
      console.log('\n✅ Push notification sent successfully!');
      console.log('📱 Check Nishant\'s device for the notification!');
    } else if (result.success && result.sent === 0) {
      console.log('\n⚠️  Push notification not sent');
      console.log('Reason:', result.message || 'Unknown');
    } else {
      console.log('\n❌ Failed to send push notification');
      console.log('Error:', result.error || 'Unknown error');
    }

    // Close connection
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
