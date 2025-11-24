/**
 * Test Mark-Read Endpoint
 * Tests the /api/notifications/:id/mark-read endpoint with different scenarios
 */

require('dotenv').config();
const mongoose = require('mongoose');
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

// Simulate the markAsRead function
async function testMarkAsRead(notificationId, scenario) {
  console.log('='.repeat(60));
  console.log(`📝 Testing: ${scenario}`);
  console.log('='.repeat(60));
  console.log(`Notification ID: ${notificationId}\n`);

  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      console.log('❌ RESULT: 400 - Invalid notification ID format\n');
      return {
        status: 400,
        success: false,
        message: 'Invalid notification ID format'
      };
    }

    // First, check if notification exists at all
    const notificationRaw = await Notification.findById(notificationId);

    if (!notificationRaw) {
      console.log('❌ RESULT: 404 - Notification not found');
      console.log('   Details: This notification does not exist in the database\n');
      return {
        status: 404,
        success: false,
        message: 'Notification not found',
        details: 'This notification does not exist in the database'
      };
    }

    // Check if notification is deleted
    if (notificationRaw.isDeleted) {
      console.log('❌ RESULT: 404 - Notification not found');
      console.log('   Details: This notification has been deleted\n');
      return {
        status: 404,
        success: false,
        message: 'Notification not found',
        details: 'This notification has been deleted'
      };
    }

    // Check if notification is published
    if (notificationRaw.status !== 'PUBLISHED') {
      console.log('❌ RESULT: 404 - Notification not found');
      console.log(`   Details: This notification is not published yet (current status: ${notificationRaw.status})\n`);
      return {
        status: 404,
        success: false,
        message: 'Notification not found',
        details: `This notification is not published yet (current status: ${notificationRaw.status})`
      };
    }

    // Increment view count
    notificationRaw.viewCount += 1;
    await notificationRaw.save();

    console.log('✅ RESULT: 200 - Success!');
    console.log(`   Message: Notification marked as read`);
    console.log(`   View Count: ${notificationRaw.viewCount}\n`);
    return {
      status: 200,
      success: true,
      message: 'Notification marked as read',
      data: {
        viewCount: notificationRaw.viewCount
      }
    };

  } catch (error) {
    console.log('❌ RESULT: 500 - Server Error');
    console.log(`   Error: ${error.message}\n`);
    return {
      status: 500,
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    };
  }
}

// Main function
async function main() {
  await connectDB();

  try {
    // Get test notifications
    const publishedNotif = await Notification.findOne({ status: 'PUBLISHED', isDeleted: false });
    const draftNotif = await Notification.findOne({ status: 'DRAFT' });
    const deletedNotif = await Notification.findOne({ isDeleted: true });

    console.log('🧪 TESTING MARK-READ ENDPOINT');
    console.log('='.repeat(60));
    console.log('');

    const results = [];

    // Test 1: Valid published notification
    if (publishedNotif) {
      const result = await testMarkAsRead(publishedNotif._id.toString(), 'Valid Published Notification (Should Succeed)');
      results.push({ scenario: 'Published Notification', result });
    }

    // Test 2: Invalid ObjectId format
    const result2 = await testMarkAsRead('invalid-id-format', 'Invalid ObjectId Format (Should Fail)');
    results.push({ scenario: 'Invalid ID Format', result: result2 });

    // Test 3: Non-existent notification
    const result3 = await testMarkAsRead('6915ec4633a5fa82f08e5533', 'Non-existent Notification (Should Fail)');
    results.push({ scenario: 'Non-existent Notification', result: result3 });

    // Test 4: Draft notification
    if (draftNotif) {
      const result4 = await testMarkAsRead(draftNotif._id.toString(), 'Draft Notification (Should Fail)');
      results.push({ scenario: 'Draft Notification', result: result4 });
    }

    // Test 5: Deleted notification
    if (deletedNotif) {
      const result5 = await testMarkAsRead(deletedNotif._id.toString(), 'Deleted Notification (Should Fail)');
      results.push({ scenario: 'Deleted Notification', result: result5 });
    }

    // Summary
    console.log('='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log('');

    results.forEach((test, i) => {
      const icon = test.result.success ? '✅' : '❌';
      console.log(`${i + 1}. ${icon} ${test.scenario}`);
      console.log(`   Status: ${test.result.status}`);
      console.log(`   Message: ${test.result.message}`);
      if (test.result.details) {
        console.log(`   Details: ${test.result.details}`);
      }
      console.log('');
    });

    const successCount = results.filter(r => r.result.success).length;
    const failCount = results.filter(r => !r.result.success).length;

    console.log(`Total Tests: ${results.length}`);
    console.log(`✅ Passed: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log('');

    if (publishedNotif) {
      console.log('💡 Example API Request:');
      console.log(`   curl -X POST http://localhost:3000/api/notifications/${publishedNotif._id}/mark-read \\`);
      console.log(`        -H "Authorization: Bearer YOUR_TOKEN_HERE"`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
  }
}

// Run the script
main();
