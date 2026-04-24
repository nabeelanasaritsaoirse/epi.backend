/**
 * Production Server Test - Run this ON the production server
 *
 * Upload this file to /var/www/epi-backend/
 * Then run: node production-test-push.js
 */

const mongoose = require('mongoose');
const notificationService = require('./services/notificationSystemService');

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/your_database';

async function testPushNotification() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find user with phone +919922133164 (Dadu)
    const User = require('./models/User');
    const user = await User.findOne({ phoneNumber: '+919922133164' });

    if (!user) {
      console.log('❌ User not found with phone +919922133164');
      process.exit(1);
    }

    console.log('👤 Found user:', {
      id: user._id,
      name: user.name,
      phone: user.phoneNumber,
      hasFCMToken: !!user.deviceToken
    });

    if (!user.deviceToken) {
      console.log('\n⚠️  User has no FCM token registered');
      console.log('Push notification cannot be sent without FCM token');
      process.exit(1);
    }

    console.log('\n🚀 Sending test push notification...\n');

    const result = await notificationService.triggerNotification({
      type: 'GENERAL',
      userId: user._id,
      title: '🎉 Firebase Test',
      body: 'Testing push notifications after Firebase Admin SDK update! If you see this, it works!',
      sendPush: true,
      sendInApp: true,
      metadata: {
        source: 'production_test',
        testTimestamp: new Date()
      }
    });

    console.log('📊 Result:', JSON.stringify(result, null, 2));

    if (result.pushResult && result.pushResult !== null) {
      console.log('\n🎉 SUCCESS! Firebase push notification sent!');
      console.log('✅ Firebase Admin SDK is working correctly!');
      console.log('✅ The sendMulticast() function is now available!');
      console.log('\n📱 Check your device for the notification!');
    } else {
      console.log('\n⚠️  Push result is null');
      console.log('Possible reasons:');
      console.log('- Firebase credentials not loaded');
      console.log('- Firebase Admin SDK not initialized');
      console.log('- FCM token invalid or expired');
    }

    mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

testPushNotification();
