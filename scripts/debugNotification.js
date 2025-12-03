/**
 * Debug Notification Script
 * - Checks if a notification exists
 * - Validates ID format
 * - Creates test notifications
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');

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

// Validate MongoDB ObjectId format
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Check if notification exists
async function debugNotification(notificationId) {
  console.log('='.repeat(60));
  console.log('🔍 DEBUGGING NOTIFICATION');
  console.log('='.repeat(60));

  console.log(`\n📋 Notification ID: ${notificationId}`);

  // Step 1: Validate ID format
  console.log('\n1️⃣ Validating ID format...');
  if (!isValidObjectId(notificationId)) {
    console.log('❌ INVALID ObjectId format!');
    console.log(`   The ID "${notificationId}" is not a valid MongoDB ObjectId`);
    console.log('   Valid format: 24 character hexadecimal string (e.g., "507f1f77bcf86cd799439011")');
    return false;
  }
  console.log('✅ ID format is valid');

  // Step 2: Check if notification exists (without filters)
  console.log('\n2️⃣ Checking if notification exists (no filters)...');
  const notificationRaw = await Notification.findById(notificationId);

  if (!notificationRaw) {
    console.log('❌ Notification NOT FOUND in database');
    console.log('   This notification does not exist.');
    return false;
  }

  console.log('✅ Notification EXISTS in database');

  // Step 3: Show notification details
  console.log('\n3️⃣ Notification Details:');
  console.log('   ID:', notificationRaw._id);
  console.log('   Title:', notificationRaw.title);
  console.log('   Type:', notificationRaw.type);
  console.log('   Status:', notificationRaw.status);
  console.log('   Is Deleted:', notificationRaw.isDeleted);
  console.log('   Published At:', notificationRaw.publishedAt || 'Not published');
  console.log('   Created At:', notificationRaw.createdAt);

  if (notificationRaw.type === 'SYSTEM_NOTIFICATION') {
    console.log('   System Type:', notificationRaw.systemType);
    console.log('   Target User ID:', notificationRaw.targetUserId);
  } else {
    console.log('   Post Type:', notificationRaw.postType);
    console.log('   Likes:', notificationRaw.likeCount);
    console.log('   Comments:', notificationRaw.commentCount);
    console.log('   Views:', notificationRaw.viewCount);
  }

  // Step 4: Check why it might fail the endpoint query
  console.log('\n4️⃣ Checking endpoint requirements...');
  console.log('   The /mark-read endpoint requires:');
  console.log('   - isDeleted: false');
  console.log('   - status: PUBLISHED');

  const issues = [];
  if (notificationRaw.isDeleted) {
    issues.push('❌ Notification is DELETED (isDeleted: true)');
  } else {
    console.log('   ✅ Not deleted');
  }

  if (notificationRaw.status !== 'PUBLISHED') {
    issues.push(`❌ Status is "${notificationRaw.status}" (must be "PUBLISHED")`);
  } else {
    console.log('   ✅ Status is PUBLISHED');
  }

  if (issues.length > 0) {
    console.log('\n⚠️  ISSUES FOUND:');
    issues.forEach(issue => console.log('   ' + issue));
    console.log('\n   This is why the endpoint returns "Notification not found"');
  } else {
    console.log('\n✅ Notification meets all endpoint requirements!');
    console.log('   The notification should be accessible via the endpoint.');
  }

  return true;
}

// Create test notifications
async function createTestNotifications() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 CREATING TEST NOTIFICATIONS');
  console.log('='.repeat(60));

  // Get a user to target (or create admin)
  let adminUser = await User.findOne({ role: 'admin' });

  if (!adminUser) {
    console.log('\n⚠️  No admin user found. Creating test admin...');
    // For testing, we'll just get any user
    adminUser = await User.findOne();
  }

  let targetUser = await User.findOne({ role: 'user' });

  if (!targetUser) {
    console.log('\n⚠️  No regular user found. Using admin as target...');
    targetUser = adminUser;
  }

  if (!adminUser || !targetUser) {
    console.log('\n❌ No users found in database. Please create at least one user first.');
    return;
  }

  console.log(`\n👤 Admin User: ${adminUser.name} (${adminUser._id})`);
  console.log(`👤 Target User: ${targetUser.name} (${targetUser._id})`);

  const testNotifications = [];

  // Test 1: ADMIN_POST - OFFER (for all users)
  console.log('\n📝 Creating Test Notification 1: ADMIN_POST - OFFER...');
  const offer = await Notification.create({
    notificationId: `OFFER_${Date.now()}`,
    type: 'ADMIN_POST',
    postType: 'OFFER',
    title: '🎉 Special Discount - 50% OFF!',
    body: 'Limited time offer! Get 50% off on all products. Use code: SAVE50',
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

  // Test 2: ADMIN_POST - POST with image
  console.log('\n📝 Creating Test Notification 2: ADMIN_POST - POST_WITH_IMAGE...');
  const post = await Notification.create({
    notificationId: `POST_${Date.now()}`,
    type: 'ADMIN_POST',
    postType: 'POST_WITH_IMAGE',
    title: '📱 Check out our new products!',
    body: 'We have just launched amazing new products. Check them out now!',
    imageUrl: 'https://via.placeholder.com/400x300',
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

  // Test 3: SYSTEM_NOTIFICATION - ORDER_CONFIRMATION (specific user)
  console.log('\n📝 Creating Test Notification 3: SYSTEM_NOTIFICATION - ORDER_CONFIRMATION...');
  const orderNotif = await Notification.create({
    notificationId: `ORDER_${Date.now()}`,
    type: 'SYSTEM_NOTIFICATION',
    systemType: 'ORDER_CONFIRMATION',
    title: '✅ Order Confirmed!',
    body: 'Your order has been confirmed and will be processed soon.',
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

  // Test 4: SYSTEM_NOTIFICATION - WALLET_CREDIT
  console.log('\n📝 Creating Test Notification 4: SYSTEM_NOTIFICATION - WALLET_CREDIT...');
  const walletNotif = await Notification.create({
    notificationId: `WALLET_${Date.now()}`,
    type: 'SYSTEM_NOTIFICATION',
    systemType: 'WALLET_CREDIT',
    title: '💰 Wallet Credited!',
    body: 'Your wallet has been credited with ₹500',
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

  // Test 5: DRAFT notification (should NOT be accessible)
  console.log('\n📝 Creating Test Notification 5: DRAFT (not accessible)...');
  const draft = await Notification.create({
    notificationId: `DRAFT_${Date.now()}`,
    type: 'ADMIN_POST',
    postType: 'POST',
    title: 'Draft Post - Not Published',
    body: 'This is a draft post that should not be accessible via the API',
    targetType: 'ALL_USERS',
    sendInApp: true,
    status: 'DRAFT',
    createdBy: adminUser._id
  });
  testNotifications.push(draft);
  console.log(`   ✅ Created: ${draft._id} (DRAFT - not accessible)`);

  console.log('\n' + '='.repeat(60));
  console.log('✅ CREATED ' + testNotifications.length + ' TEST NOTIFICATIONS');
  console.log('='.repeat(60));

  // Summary
  console.log('\n📊 SUMMARY:');
  console.log('\nPublished & Accessible (status: PUBLISHED):');
  testNotifications.filter(n => n.status === 'PUBLISHED').forEach((n, i) => {
    console.log(`   ${i + 1}. [${n.type}] ${n.title}`);
    console.log(`      ID: ${n._id}`);
    console.log(`      Test mark-read: POST /api/notifications/${n._id}/mark-read`);
  });

  console.log('\nNot Accessible (status: DRAFT):');
  testNotifications.filter(n => n.status !== 'PUBLISHED').forEach((n, i) => {
    console.log(`   ${i + 1}. [${n.type}] ${n.title}`);
    console.log(`      ID: ${n._id}`);
    console.log(`      Reason: Status is "${n.status}"`);
  });

  return testNotifications;
}

// Get all notifications summary
async function getAllNotificationsSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 ALL NOTIFICATIONS SUMMARY');
  console.log('='.repeat(60));

  const totalCount = await Notification.countDocuments();
  const publishedCount = await Notification.countDocuments({ status: 'PUBLISHED', isDeleted: false });
  const draftCount = await Notification.countDocuments({ status: 'DRAFT' });
  const deletedCount = await Notification.countDocuments({ isDeleted: true });

  console.log(`\nTotal Notifications: ${totalCount}`);
  console.log(`Published (accessible): ${publishedCount}`);
  console.log(`Drafts: ${draftCount}`);
  console.log(`Deleted: ${deletedCount}`);

  const recentPublished = await Notification.find({
    status: 'PUBLISHED',
    isDeleted: false
  })
  .sort({ createdAt: -1 })
  .limit(5)
  .select('_id title type status createdAt');

  if (recentPublished.length > 0) {
    console.log('\n📋 Recent Published Notifications:');
    recentPublished.forEach((n, i) => {
      console.log(`   ${i + 1}. ${n.title}`);
      console.log(`      ID: ${n._id}`);
      console.log(`      Type: ${n.type}`);
      console.log(`      Created: ${n.createdAt.toLocaleString()}`);
    });
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const notificationId = args[1];

  await connectDB();

  try {
    if (command === 'debug' && notificationId) {
      // Debug specific notification
      await debugNotification(notificationId);
    } else if (command === 'create-test') {
      // Create test notifications
      await createTestNotifications();
    } else if (command === 'summary') {
      // Show all notifications summary
      await getAllNotificationsSummary();
    } else if (command === 'all') {
      // Do everything
      if (notificationId) {
        await debugNotification(notificationId);
      }
      await getAllNotificationsSummary();
      await createTestNotifications();
    } else {
      // Show usage
      console.log('Usage:');
      console.log('  node scripts/debugNotification.js debug <notificationId>    - Debug specific notification');
      console.log('  node scripts/debugNotification.js create-test               - Create test notifications');
      console.log('  node scripts/debugNotification.js summary                   - Show all notifications');
      console.log('  node scripts/debugNotification.js all [notificationId]      - Run all commands');
      console.log('\nExample:');
      console.log('  node scripts/debugNotification.js debug 6915ec4633a5fa82f08e5533');
      console.log('  node scripts/debugNotification.js create-test');
      console.log('  node scripts/debugNotification.js all 6915ec4633a5fa82f08e5533');
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
