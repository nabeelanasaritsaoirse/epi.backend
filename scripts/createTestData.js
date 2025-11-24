/**
 * Create Test Data Script
 * - Creates test users
 * - Creates test notifications
 */

require('dotenv').config();
const mongoose = require('mongoose');
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

// Create test users
async function createTestUsers() {
  console.log('='.repeat(60));
  console.log('👥 CREATING TEST USERS');
  console.log('='.repeat(60));

  // Check if users already exist
  const existingAdmin = await User.findOne({ email: 'admin@test.com' });
  const existingUser = await User.findOne({ email: 'user@test.com' });

  let adminUser, regularUser;

  if (!existingAdmin) {
    console.log('\n📝 Creating Admin User...');
    adminUser = await User.create({
      name: 'Test Admin',
      email: 'admin@test.com',
      firebaseUid: `admin_${Date.now()}`,
      role: 'admin',
      authMethod: 'email',
      isActive: true
    });
    console.log(`   ✅ Created: ${adminUser.name} (${adminUser._id})`);
  } else {
    adminUser = existingAdmin;
    console.log(`\n✅ Admin user already exists: ${adminUser.name} (${adminUser._id})`);
  }

  if (!existingUser) {
    console.log('\n📝 Creating Regular User...');
    regularUser = await User.create({
      name: 'Test User',
      email: 'user@test.com',
      firebaseUid: `user_${Date.now()}`,
      role: 'user',
      authMethod: 'email',
      isActive: true
    });
    console.log(`   ✅ Created: ${regularUser.name} (${regularUser._id})`);
  } else {
    regularUser = existingUser;
    console.log(`\n✅ Regular user already exists: ${regularUser.name} (${regularUser._id})`);
  }

  return { adminUser, regularUser };
}

// Create test notifications
async function createTestNotifications(adminUser, targetUser) {
  console.log('\n' + '='.repeat(60));
  console.log('📬 CREATING TEST NOTIFICATIONS');
  console.log('='.repeat(60));

  const testNotifications = [];

  // Test 1: ADMIN_POST - OFFER
  console.log('\n📝 Creating Test 1: ADMIN_POST - OFFER (All Users)...');
  const offer = await Notification.create({
    notificationId: `OFFER_${Date.now()}`,
    type: 'ADMIN_POST',
    postType: 'OFFER',
    title: '🎉 Special Discount - 50% OFF!',
    body: 'Limited time offer! Get 50% off on all products. Use code: SAVE50. Hurry up, offer valid till this weekend!',
    targetType: 'ALL_USERS',
    sendInApp: true,
    sendPush: false,
    commentsEnabled: true,
    likesEnabled: true,
    status: 'PUBLISHED',
    publishedAt: new Date(),
    createdBy: adminUser._id
  });
  testNotifications.push(offer);
  console.log(`   ✅ Created: ${offer._id}`);
  console.log(`   Test URL: POST /api/notifications/${offer._id}/mark-read`);

  // Test 2: ADMIN_POST - POST with image
  console.log('\n📝 Creating Test 2: ADMIN_POST - POST_WITH_IMAGE...');
  const post = await Notification.create({
    notificationId: `POST_${Date.now()}`,
    type: 'ADMIN_POST',
    postType: 'POST_WITH_IMAGE',
    title: '📱 New Product Launch!',
    body: 'We are excited to announce our new product line. Check out the amazing features and exclusive designs!',
    imageUrl: 'https://via.placeholder.com/800x600/4CAF50/ffffff?text=New+Products',
    targetType: 'ALL_USERS',
    sendInApp: true,
    sendPush: true,
    commentsEnabled: true,
    likesEnabled: true,
    status: 'PUBLISHED',
    publishedAt: new Date(),
    createdBy: adminUser._id
  });
  testNotifications.push(post);
  console.log(`   ✅ Created: ${post._id}`);
  console.log(`   Test URL: POST /api/notifications/${post._id}/mark-read`);

  // Test 3: SYSTEM_NOTIFICATION - ORDER_CONFIRMATION
  console.log('\n📝 Creating Test 3: SYSTEM_NOTIFICATION - ORDER_CONFIRMATION...');
  const orderNotif = await Notification.create({
    notificationId: `ORDER_${Date.now()}`,
    type: 'SYSTEM_NOTIFICATION',
    systemType: 'ORDER_CONFIRMATION',
    title: '✅ Order Confirmed!',
    body: 'Your order #ORD12345 has been confirmed and will be processed soon. Track your order in the Orders section.',
    targetType: 'SPECIFIC_USER',
    targetUserId: targetUser._id,
    sendInApp: true,
    sendPush: true,
    status: 'PUBLISHED',
    publishedAt: new Date(),
    metadata: {
      orderId: new mongoose.Types.ObjectId(),
      amount: 1499
    }
  });
  testNotifications.push(orderNotif);
  console.log(`   ✅ Created: ${orderNotif._id}`);
  console.log(`   Test URL: POST /api/notifications/${orderNotif._id}/mark-read`);

  // Test 4: SYSTEM_NOTIFICATION - WALLET_CREDIT
  console.log('\n📝 Creating Test 4: SYSTEM_NOTIFICATION - WALLET_CREDIT...');
  const walletNotif = await Notification.create({
    notificationId: `WALLET_${Date.now()}`,
    type: 'SYSTEM_NOTIFICATION',
    systemType: 'WALLET_CREDIT',
    title: '💰 Wallet Credited!',
    body: 'Your wallet has been credited with ₹500. Available balance: ₹500',
    targetType: 'SPECIFIC_USER',
    targetUserId: targetUser._id,
    sendInApp: true,
    sendPush: true,
    status: 'PUBLISHED',
    publishedAt: new Date(),
    metadata: {
      amount: 500,
      transactionId: `TXN_${Date.now()}`
    }
  });
  testNotifications.push(walletNotif);
  console.log(`   ✅ Created: ${walletNotif._id}`);
  console.log(`   Test URL: POST /api/notifications/${walletNotif._id}/mark-read`);

  // Test 5: SYSTEM_NOTIFICATION - COMMISSION_EARNED
  console.log('\n📝 Creating Test 5: SYSTEM_NOTIFICATION - COMMISSION_EARNED...');
  const commissionNotif = await Notification.create({
    notificationId: `COMMISSION_${Date.now()}`,
    type: 'SYSTEM_NOTIFICATION',
    systemType: 'COMMISSION_EARNED',
    title: '🎯 Commission Earned!',
    body: 'Congratulations! You earned ₹250 commission from your referral purchase.',
    targetType: 'SPECIFIC_USER',
    targetUserId: targetUser._id,
    sendInApp: true,
    sendPush: true,
    status: 'PUBLISHED',
    publishedAt: new Date(),
    metadata: {
      amount: 250,
      referralUserId: new mongoose.Types.ObjectId()
    }
  });
  testNotifications.push(commissionNotif);
  console.log(`   ✅ Created: ${commissionNotif._id}`);
  console.log(`   Test URL: POST /api/notifications/${commissionNotif._id}/mark-read`);

  // Test 6: DRAFT notification (should NOT be accessible)
  console.log('\n📝 Creating Test 6: DRAFT (Not Published - Should Fail)...');
  const draft = await Notification.create({
    notificationId: `DRAFT_${Date.now()}`,
    type: 'ADMIN_POST',
    postType: 'POST',
    title: '📝 Draft Post - Not Published',
    body: 'This is a draft post that should not be accessible via the API endpoints.',
    targetType: 'ALL_USERS',
    sendInApp: true,
    status: 'DRAFT',
    createdBy: adminUser._id
  });
  testNotifications.push(draft);
  console.log(`   ✅ Created: ${draft._id}`);
  console.log(`   Test URL: POST /api/notifications/${draft._id}/mark-read`);
  console.log(`   ⚠️  Expected: "Notification not found" (status is DRAFT)`);

  // Test 7: DELETED notification (should NOT be accessible)
  console.log('\n📝 Creating Test 7: DELETED (Should Fail)...');
  const deleted = await Notification.create({
    notificationId: `DELETED_${Date.now()}`,
    type: 'ADMIN_POST',
    postType: 'OFFER',
    title: '🗑️ Deleted Offer',
    body: 'This notification has been deleted and should not be accessible.',
    targetType: 'ALL_USERS',
    sendInApp: true,
    status: 'PUBLISHED',
    publishedAt: new Date(),
    isDeleted: true,
    deletedAt: new Date(),
    createdBy: adminUser._id
  });
  testNotifications.push(deleted);
  console.log(`   ✅ Created: ${deleted._id}`);
  console.log(`   Test URL: POST /api/notifications/${deleted._id}/mark-read`);
  console.log(`   ⚠️  Expected: "Notification not found" (isDeleted: true)`);

  console.log('\n' + '='.repeat(60));
  console.log(`✅ CREATED ${testNotifications.length} TEST NOTIFICATIONS`);
  console.log('='.repeat(60));

  return testNotifications;
}

// Print summary
function printSummary(adminUser, regularUser, notifications) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST DATA SUMMARY');
  console.log('='.repeat(60));

  console.log('\n👥 Users:');
  console.log(`   Admin: ${adminUser.name} (${adminUser._id})`);
  console.log(`   User: ${regularUser.name} (${regularUser._id})`);

  console.log('\n📬 Accessible Notifications (Published & Not Deleted):');
  notifications
    .filter(n => n.status === 'PUBLISHED' && !n.isDeleted)
    .forEach((n, i) => {
      console.log(`\n   ${i + 1}. ${n.title}`);
      console.log(`      ID: ${n._id}`);
      console.log(`      Type: ${n.type}`);
      if (n.type === 'SYSTEM_NOTIFICATION') {
        console.log(`      System Type: ${n.systemType}`);
        console.log(`      Target: ${n.targetType === 'ALL_USERS' ? 'All Users' : 'Specific User'}`);
      } else {
        console.log(`      Post Type: ${n.postType}`);
      }
      console.log(`      Test: POST /api/notifications/${n._id}/mark-read`);
    });

  console.log('\n\n🚫 Not Accessible Notifications (Draft or Deleted):');
  notifications
    .filter(n => n.status !== 'PUBLISHED' || n.isDeleted)
    .forEach((n, i) => {
      console.log(`\n   ${i + 1}. ${n.title}`);
      console.log(`      ID: ${n._id}`);
      console.log(`      Reason: ${n.isDeleted ? 'DELETED' : `Status: ${n.status}`}`);
      console.log(`      Test: POST /api/notifications/${n._id}/mark-read`);
      console.log(`      Expected: "Notification not found"`);
    });

  console.log('\n' + '='.repeat(60));
  console.log('🧪 TESTING INSTRUCTIONS');
  console.log('='.repeat(60));
  console.log('\n1. Use any HTTP client (Postman, Thunder Client, curl)');
  console.log('2. Set the Authorization header with a valid token');
  console.log('3. Send POST requests to the URLs listed above');
  console.log('4. Published notifications should return success');
  console.log('5. Draft/Deleted notifications should return "Notification not found"');

  console.log('\n💡 Example curl command:');
  const firstPublished = notifications.find(n => n.status === 'PUBLISHED' && !n.isDeleted);
  if (firstPublished) {
    console.log(`\ncurl -X POST http://localhost:3000/api/notifications/${firstPublished._id}/mark-read \\`);
    console.log(`  -H "Authorization: Bearer YOUR_TOKEN_HERE"`);
  }
}

// Main function
async function main() {
  await connectDB();

  try {
    // Create test users
    const { adminUser, regularUser } = await createTestUsers();

    // Create test notifications
    const notifications = await createTestNotifications(adminUser, regularUser);

    // Print summary
    printSummary(adminUser, regularUser, notifications);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n\n👋 Database connection closed');
  }
}

// Run the script
main();
