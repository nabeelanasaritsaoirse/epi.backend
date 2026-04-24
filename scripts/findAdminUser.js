/**
 * Find Admin User Script
 * Searches for the admin user in the database
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const User = require('../models/User');

    // Search in multiple ways
    console.log('\n📋 Searching for admin user...\n');

    // 1. By email
    console.log('1. Search by email: admin@epi.com');
    const byEmail = await User.findOne({ email: 'admin@epi.com' });
    console.log('   Result:', byEmail ? `Found: ${byEmail._id}` : 'NOT FOUND');

    // 2. By role
    console.log('\n2. Search by role: super_admin');
    const superAdmins = await User.find({ role: 'super_admin' }).select('_id name email');
    console.log(`   Found ${superAdmins.length} super_admin(s):`);
    superAdmins.forEach(admin => {
      console.log(`   - ${admin.name} (${admin.email}) - ID: ${admin._id}`);
    });

    // 3. By role: admin
    console.log('\n3. Search by role: admin');
    const admins = await User.find({ role: 'admin' }).select('_id name email');
    console.log(`   Found ${admins.length} admin(s):`);
    admins.forEach(admin => {
      console.log(`   - ${admin.name} (${admin.email}) - ID: ${admin._id}`);
    });

    // 4. By specific ID from login response
    console.log('\n4. Search by ID from login: 692e83467188193968d5b272');
    const byId = await User.findById('692e83467188193968d5b272');
    if (byId) {
      console.log('   ✅ Found user!');
      console.log('   Details:', {
        _id: byId._id,
        name: byId.name,
        email: byId.email,
        role: byId.role,
        linkedUserId: byId.linkedUserId || 'NOT SET',
        referralCode: byId.referralCode || 'NOT SET',
        referredBy: byId.referredBy || 'NOT SET'
      });

      // Check if this user has referrals
      const referralCount = await User.countDocuments({ referredBy: byId._id });
      console.log(`   Direct referrals (L1): ${referralCount}`);

      if (referralCount > 0) {
        const referrals = await User.find({ referredBy: byId._id }).select('name email').limit(5);
        console.log('   First 5 referrals:');
        referrals.forEach(ref => console.log(`     - ${ref.name} (${ref.email})`));
      }
    } else {
      console.log('   ❌ NOT FOUND');
    }

    // 5. Search all users with admin in email
    console.log('\n5. Search emails containing "admin"');
    const adminEmails = await User.find({ email: /admin/i }).select('_id name email role');
    console.log(`   Found ${adminEmails.length} user(s):`);
    adminEmails.forEach(user => {
      console.log(`   - ${user.name} (${user.email}) - Role: ${user.role} - ID: ${user._id}`);
    });

    // 6. Count total users by role
    console.log('\n6. User count by role:');
    const roleCounts = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    roleCounts.forEach(role => {
      console.log(`   - ${role._id || 'undefined'}: ${role.count}`);
    });

    // 7. Find users with referral chains
    console.log('\n7. Users with most referrals:');
    const topReferrers = await User.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'referredBy',
          as: 'referrals'
        }
      },
      {
        $addFields: {
          referralCount: { $size: '$referrals' }
        }
      },
      {
        $match: { referralCount: { $gt: 0 } }
      },
      {
        $sort: { referralCount: -1 }
      },
      {
        $limit: 5
      },
      {
        $project: {
          name: 1,
          email: 1,
          role: 1,
          referralCount: 1
        }
      }
    ]);

    if (topReferrers.length > 0) {
      console.log(`   Found ${topReferrers.length} user(s) with referrals:`);
      topReferrers.forEach(user => {
        console.log(`   - ${user.name} (${user.email}) - ${user.referralCount} referrals - ID: ${user._id}`);
      });
    } else {
      console.log('   No users with referrals found');
    }

    console.log('\n✅ Search complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

main().catch(console.error);
