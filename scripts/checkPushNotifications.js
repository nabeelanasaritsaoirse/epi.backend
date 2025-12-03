/**
 * Check Push Notification Setup
 * - Decode JWT tokens
 * - Check if users have FCM tokens
 * - Test push notification sending
 */

require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Connect to database
async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/epi_backend';

  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log(`✅ MongoDB Connected to ${mongoose.connection.name}\n`);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
}

// Decode JWT token
function decodeToken(token) {
  try {
    const decoded = jwt.decode(token);
    return decoded;
  } catch (error) {
    console.error('Error decoding token:', error.message);
    return null;
  }
}

// Check user FCM token
async function checkUserFCMToken(userId) {
  console.log('='.repeat(60));
  console.log(`👤 Checking User: ${userId}`);
  console.log('='.repeat(60));

  const user = await User.findById(userId);

  if (!user) {
    console.log('❌ User not found!\n');
    return null;
  }

  console.log(`Name: ${user.name}`);
  console.log(`Email: ${user.email}`);
  console.log(`Role: ${user.role}`);
  console.log(`Active: ${user.isActive}`);

  console.log('\n📱 FCM Token Status:');
  if (user.fcmToken) {
    console.log(`✅ FCM Token registered: ${user.fcmToken.substring(0, 50)}...`);
  } else {
    console.log('❌ NO FCM Token registered!');
    console.log('   The user needs to register their device token first.');
  }

  console.log('\n🔔 Notification Preferences:');
  if (user.notificationPreferences) {
    console.log(`   Push Enabled: ${user.notificationPreferences.pushEnabled ? '✅' : '❌'}`);
    console.log(`   Order Updates: ${user.notificationPreferences.orderUpdates ? '✅' : '❌'}`);
    console.log(`   Promotional Offers: ${user.notificationPreferences.promotionalOffers ? '✅' : '❌'}`);
    console.log(`   Payment Alerts: ${user.notificationPreferences.paymentAlerts ? '✅' : '❌'}`);
    console.log(`   System Notifications: ${user.notificationPreferences.systemNotifications ? '✅' : '❌'}`);
  } else {
    console.log('   ⚠️  No notification preferences set (using defaults)');
  }

  console.log('');

  return user;
}

// Check FCM service setup
async function checkFCMService() {
  console.log('='.repeat(60));
  console.log('🔥 Checking FCM Service Configuration');
  console.log('='.repeat(60));

  const admin = require('firebase-admin');

  try {
    // Check if Firebase Admin is initialized
    if (admin.apps.length === 0) {
      console.log('❌ Firebase Admin not initialized!');
      console.log('   Check your Firebase configuration in config/firebase.js');
      return false;
    }

    console.log('✅ Firebase Admin initialized');

    // Try to get the messaging service
    const messaging = admin.messaging();
    console.log('✅ Firebase Messaging service available');

    return true;

  } catch (error) {
    console.error('❌ Error checking FCM service:', error.message);
    return false;
  }
}

// Send test push notification
async function sendTestPushNotification(user) {
  console.log('='.repeat(60));
  console.log(`📤 Sending Test Push Notification to ${user.name}`);
  console.log('='.repeat(60));

  if (!user.fcmToken) {
    console.log('❌ Cannot send push notification: No FCM token registered');
    console.log('\n💡 Solution:');
    console.log('   1. User needs to call: POST /api/notifications/register-token');
    console.log('   2. Body: { "fcmToken": "device_fcm_token_here" }');
    console.log('   3. Headers: { "Authorization": "Bearer user_jwt_token" }');
    return false;
  }

  if (!user.notificationPreferences?.pushEnabled) {
    console.log('⚠️  Push notifications are disabled in user preferences');
  }

  try {
    const admin = require('firebase-admin');
    const messaging = admin.messaging();

    const message = {
      token: user.fcmToken,
      notification: {
        title: '🧪 Test Push Notification',
        body: 'This is a test push notification from the backend server.'
      },
      data: {
        type: 'TEST',
        timestamp: new Date().toISOString()
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'default'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    console.log('\n📨 Sending message...');
    const response = await messaging.send(message);

    console.log('✅ Push notification sent successfully!');
    console.log(`   Message ID: ${response}`);
    console.log(`   Sent to: ${user.fcmToken.substring(0, 50)}...`);

    return true;

  } catch (error) {
    console.error('❌ Failed to send push notification!');
    console.error(`   Error: ${error.message}`);

    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      console.log('\n💡 The FCM token is invalid or expired.');
      console.log('   User needs to register a new FCM token.');
    }

    return false;
  }
}

// Create test notification for user
async function createTestNotificationForUser(user) {
  console.log('='.repeat(60));
  console.log(`📬 Creating Test Notification for ${user.name}`);
  console.log('='.repeat(60));

  try {
    const notification = await Notification.create({
      notificationId: `TEST_PUSH_${Date.now()}`,
      type: 'SYSTEM_NOTIFICATION',
      systemType: 'GENERAL',
      title: '🧪 Test Push Notification',
      body: `Hello ${user.name}! This is a test push notification to verify your device is receiving notifications.`,
      targetType: 'SPECIFIC_USER',
      targetUserId: user._id,
      sendInApp: true,
      sendPush: true,
      status: 'PUBLISHED',
      publishedAt: new Date()
    });

    console.log('✅ Test notification created!');
    console.log(`   Notification ID: ${notification._id}`);
    console.log(`   Type: ${notification.systemType}`);
    console.log(`   Send Push: ${notification.sendPush ? 'Yes' : 'No'}`);
    console.log(`   Send In-App: ${notification.sendInApp ? 'Yes' : 'No'}`);

    return notification;

  } catch (error) {
    console.error('❌ Failed to create notification:', error.message);
    return null;
  }
}

// Main function
async function main() {
  const tokens = [
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFhZjM4OTQxNWEzZDA3N2MzYmIxNTQiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NDYxMjE3MiwiZXhwIjoxNzY1MjE2OTcyfQ.17eA30HF8teTB3-3G-NNYWLPr1bj4nK4cbeb3NP10v8',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFkNmQ4Mzk2MjU0MmJmNDEyMGYzNTciLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NDY1MTg0NiwiZXhwIjoxNzY1MjU2NjQ2fQ.ZJ1wmE1aBdD-CfbK2GV4KfwNc2V-tFg2Qpt8YxmCMUg'
  ];

  await connectDB();

  console.log('🧪 PUSH NOTIFICATION CHECK');
  console.log('='.repeat(60));
  console.log('');

  // Check FCM service first
  const fcmAvailable = await checkFCMService();
  console.log('');

  if (!fcmAvailable) {
    console.log('❌ Cannot proceed without FCM service. Please check Firebase configuration.');
    await mongoose.connection.close();
    return;
  }

  // Decode tokens and check users
  const users = [];

  for (let i = 0; i < tokens.length; i++) {
    console.log(`\n📝 Token ${i + 1}:`);
    const decoded = decodeToken(tokens[i]);

    if (decoded) {
      console.log(`   User ID: ${decoded.userId}`);
      console.log(`   Role: ${decoded.role}`);
      console.log(`   Issued At: ${new Date(decoded.iat * 1000).toLocaleString()}`);
      console.log(`   Expires At: ${new Date(decoded.exp * 1000).toLocaleString()}`);

      // Check if token is expired
      if (decoded.exp * 1000 < Date.now()) {
        console.log('   ⚠️  Token is EXPIRED!');
      } else {
        console.log('   ✅ Token is valid');
      }

      console.log('');

      // Check user FCM token
      const user = await checkUserFCMToken(decoded.userId);
      if (user) {
        users.push(user);
      }
    } else {
      console.log('   ❌ Failed to decode token');
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 PUSH NOTIFICATION STATUS SUMMARY');
  console.log('='.repeat(60));

  const usersWithFCM = users.filter(u => u.fcmToken);
  const usersWithoutFCM = users.filter(u => !u.fcmToken);

  console.log(`\nTotal Users Checked: ${users.length}`);
  console.log(`✅ Users with FCM Token: ${usersWithFCM.length}`);
  console.log(`❌ Users without FCM Token: ${usersWithoutFCM.length}`);

  if (usersWithoutFCM.length > 0) {
    console.log('\n⚠️  Users need to register FCM tokens:');
    usersWithoutFCM.forEach(u => {
      console.log(`   - ${u.name} (${u._id})`);
    });

    console.log('\n💡 How to register FCM token:');
    console.log('   POST /api/notifications/register-token');
    console.log('   Headers: { "Authorization": "Bearer USER_JWT_TOKEN" }');
    console.log('   Body: { "fcmToken": "device_fcm_token_here" }');
  }

  // Offer to send test notifications
  if (usersWithFCM.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 SENDING TEST PUSH NOTIFICATIONS');
    console.log('='.repeat(60));

    for (const user of usersWithFCM) {
      console.log('');
      await sendTestPushNotification(user);

      // Also create a test notification in DB
      console.log('');
      await createTestNotificationForUser(user);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ CHECK COMPLETE');
  console.log('='.repeat(60));

  await mongoose.connection.close();
  console.log('\n👋 Database connection closed');
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
