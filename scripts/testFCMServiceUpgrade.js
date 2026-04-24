/**
 * FCM Service Upgrade Test Script
 * Tests the new sendEachForMulticast implementation
 *
 * Usage:
 * node scripts/testFCMServiceUpgrade.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { sendPushNotification } = require('../services/fcmService');

async function testFCMUpgrade() {
  try {
    console.log('🔧 FCM Service Upgrade Test\n');

    // Connect to MongoDB
    const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!MONGO_URI) {
      console.error('❌ MONGO_URI not found in environment variables');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check Firebase initialization
    console.log('🔍 Checking Firebase configuration...');
    const hasFirebaseConfig = !!(
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    );

    if (!hasFirebaseConfig) {
      console.log('❌ Firebase environment variables not set!');
      console.log('   Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY\n');
      process.exit(1);
    }

    console.log('✅ Firebase credentials found');
    console.log(`   Project ID: ${process.env.FIREBASE_PROJECT_ID}\n`);

    // Find users with FCM tokens
    console.log('🔍 Searching for users with FCM tokens...');
    const usersWithTokens = await User.find({
      deviceToken: { $exists: true, $ne: null, $ne: '' }
    })
    .select('_id name email deviceToken')
    .limit(5);

    console.log(`✅ Found ${usersWithTokens.length} user(s) with FCM tokens\n`);

    if (usersWithTokens.length === 0) {
      console.log('⚠️  No users with FCM tokens found');
      console.log('   Users need to register their FCM tokens first via the mobile app\n');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Display users
    usersWithTokens.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.name || 'Unknown'} (${user.email})`);
      console.log(`   ID: ${user._id}`);
      console.log(`   Token: ${user.deviceToken.substring(0, 30)}...`);
    });

    console.log('\n📤 Sending test notification using NEW sendEachForMulticast method...\n');

    // Send test notification
    const userIds = usersWithTokens.map(u => u._id.toString());
    const result = await sendPushNotification(userIds, {
      title: '🎉 FCM Service Upgraded!',
      body: 'This notification was sent using the new sendEachForMulticast method for better performance!',
      data: {
        type: 'TEST_NOTIFICATION',
        testId: Date.now().toString()
      }
    });

    // Display results
    console.log('📊 Results:');
    console.log(`   ✅ Successfully sent: ${result.sent}`);
    console.log(`   ❌ Failed: ${result.failed}`);
    console.log(`   🎯 Total targeted: ${result.totalTargeted}`);
    console.log(`   📈 Success rate: ${((result.sent / result.totalTargeted) * 100).toFixed(1)}%\n`);

    if (result.sent > 0) {
      console.log('✅ SUCCESS! Check your mobile device(s) for the notification\n');
      console.log('📝 What changed:');
      console.log('   1. Now using getMessaging() from firebase-admin/messaging');
      console.log('   2. Using sendEachForMulticast() instead of individual send() calls');
      console.log('   3. Automatic cleanup of invalid/expired FCM tokens');
      console.log('   4. Better error handling and logging\n');
    }

    if (result.failed > 0) {
      console.log('⚠️  Some notifications failed to send');
      console.log('   Common reasons:');
      console.log('   - Expired FCM tokens (auto-cleaned)');
      console.log('   - Invalid tokens (auto-cleaned)');
      console.log('   - Network issues\n');
    }

    // Check for cleaned tokens
    console.log('🧹 Checking for cleaned tokens...');
    const remainingUsers = await User.find({
      _id: { $in: userIds },
      deviceToken: { $exists: true, $ne: null, $ne: '' }
    }).select('_id deviceToken');

    const removedCount = usersWithTokens.length - remainingUsers.length;
    if (removedCount > 0) {
      console.log(`   ✅ Cleaned ${removedCount} invalid token(s) automatically\n`);
    } else {
      console.log('   ✅ All tokens are valid\n');
    }

    await mongoose.connection.close();
    console.log('✅ Test complete!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error during test:', error.message);
    console.error('Stack trace:', error.stack);

    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }

    process.exit(1);
  }
}

// Run the test
testFCMUpgrade();
