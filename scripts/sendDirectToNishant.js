/**
 * Direct test to Nishant using notification system service
 * This bypasses the API and tests the FCM service directly
 */

require('dotenv').config();
const mongoose = require('mongoose');
const notificationService = require('../services/notificationSystemService');

const NISHANT_USER_ID = '6923f85fd8823e6f88977191';
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function testDirectNotification() {
  try {
    console.log('🚀 Direct FCM Test to Nishant\n');

    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log(`📤 Sending notification directly to user: ${NISHANT_USER_ID}`);
    console.log('   Using notificationSystemService.triggerNotification()\n');

    // Send notification directly using the service
    const result = await notificationService.triggerNotification({
      type: 'GENERAL',
      userId: NISHANT_USER_ID,
      title: '🎉 DIRECT TEST - FCM Service Working!',
      body: 'Hi Nishant! This notification was sent DIRECTLY using the notification service, bypassing the API. If you receive this, the FCM service is working perfectly! 🚀✅',
      sendPush: true,
      sendInApp: true,
      metadata: {
        source: 'direct_test_script',
        testId: Date.now().toString()
      }
    });

    console.log('📊 Result:', JSON.stringify(result, null, 2));
    console.log();

    if (result.pushResult) {
      console.log('🎯 Push Result:');
      console.log(`   Success: ${result.pushResult.success}`);
      console.log(`   Sent: ${result.pushResult.sent}`);
      console.log(`   Failed: ${result.pushResult.failed}`);
      console.log(`   Total Targeted: ${result.pushResult.totalTargeted || 'N/A'}`);

      if (result.pushResult.sent > 0) {
        console.log('\n🎉🎉🎉 SUCCESS! PUSH NOTIFICATION SENT! 🎉🎉🎉');
        console.log('Check Nishant\'s device NOW!');
      } else {
        console.log('\n⚠️  Push notification failed to send');
        console.log('   Check server logs for errors');
      }
    } else {
      console.log('❌ pushResult is null');
      console.log('   This means FCM service returned early or errored');
    }

    await mongoose.connection.close();
    console.log('\n✅ Test complete');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

testDirectNotification();
