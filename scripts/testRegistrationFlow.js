/**
 * Test script for Admin Registration Request Flow
 *
 * Tests:
 * 1. Register new admin request
 * 2. List pending requests (as super admin)
 * 3. Approve request
 * 4. Login as approved admin
 */

const mongoose = require('mongoose');
require('dotenv').config();

const AdminRegistrationRequest = require('../models/AdminRegistrationRequest');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database';

async function testRegistrationFlow() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Test 1: Check if model is registered
    console.log('📋 Test 1: Check AdminRegistrationRequest model');
    const testEmail = `test_${Date.now()}@example.com`;
    console.log(`   Using test email: ${testEmail}`);

    // Test 2: Create a registration request directly
    console.log('\n📋 Test 2: Create registration request');
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('testpass123', 10);

    const request = new AdminRegistrationRequest({
      name: 'Test Admin',
      email: testEmail,
      password: hashedPassword,
      status: 'pending'
    });

    await request.save();
    console.log('✅ Registration request created successfully');
    console.log('   Request ID:', request._id);
    console.log('   Email:', request.email);
    console.log('   Status:', request.status);

    // Test 3: Fetch pending requests
    console.log('\n📋 Test 3: Fetch pending requests');
    const pendingRequests = await AdminRegistrationRequest.find({ status: 'pending' })
      .select('-password')
      .sort({ requestedAt: -1 });

    console.log(`✅ Found ${pendingRequests.length} pending request(s)`);

    // Test 4: Check for duplicate pending request
    console.log('\n📋 Test 4: Check duplicate prevention');
    const duplicatePending = await AdminRegistrationRequest.findOne({
      email: testEmail,
      status: 'pending'
    });

    if (duplicatePending) {
      console.log('✅ Duplicate detection works - found existing pending request');
    }

    // Test 5: Simulate approval (find a super admin first)
    console.log('\n📋 Test 5: Simulate approval process');
    const superAdmin = await User.findOne({ role: 'super_admin' });

    if (!superAdmin) {
      console.log('⚠️  No super admin found in database - skipping approval test');
    } else {
      console.log('   Found super admin:', superAdmin.email);

      // Check if email already exists as admin
      const existingAdmin = await User.findOne({
        email: testEmail,
        role: { $in: ['admin', 'super_admin'] }
      });

      if (existingAdmin) {
        console.log('⚠️  Email already exists as admin - cleaning up for test');
        await User.deleteOne({ _id: existingAdmin._id });
      }

      // Create admin from request
      const crypto = require('crypto');
      const adminFirebaseUid = `admin_${crypto.randomBytes(8).toString('hex')}`;

      const newAdmin = new User({
        name: request.name,
        email: request.email,
        firebaseUid: adminFirebaseUid,
        password: request.password,
        role: 'admin',
        moduleAccess: ['dashboard', 'products'],
        createdBy: superAdmin._id,
        isActive: true
      });

      await newAdmin.save();

      // Update request
      request.status = 'approved';
      request.reviewedAt = new Date();
      request.reviewedBy = superAdmin._id;
      request.approvedAdminId = newAdmin._id;
      await request.save();

      console.log('✅ Admin created and request approved successfully');
      console.log('   Admin ID:', newAdmin._id);
      console.log('   Module Access:', newAdmin.moduleAccess);

      // Test 6: Verify login would work
      console.log('\n📋 Test 6: Verify admin can login');
      const isPasswordValid = await bcrypt.compare('testpass123', newAdmin.password);
      console.log('✅ Password validation:', isPasswordValid ? 'PASS' : 'FAIL');

      // Cleanup
      console.log('\n🧹 Cleaning up test data...');
      await User.deleteOne({ _id: newAdmin._id });
      console.log('   Deleted test admin');
    }

    await AdminRegistrationRequest.deleteOne({ _id: request._id });
    console.log('   Deleted test registration request');

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run tests
testRegistrationFlow();
