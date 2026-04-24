/**
 * Find Shubhashri User in Database
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
  try {
    console.log('🔍 Searching for Shubhashri user in database...\n');

    // Connect to production/live database
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/your_database';
    console.log('📡 Connecting to:', MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'));

    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const User = require('../models/User');

    // Search by exact email
    console.log('1️⃣ Searching by exact email: shubhashri.it.saoirse@gmail.com');
    let user = await User.findOne({ email: 'shubhashri.it.saoirse@gmail.com' });

    if (user) {
      console.log('✅ Found user!');
      console.log('   Details:', {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        linkedUserId: user.linkedUserId || 'NOT SET',
        hasPassword: !!user.password,
        referralCode: user.referralCode || 'NOT SET'
      });
    } else {
      console.log('❌ Not found\n');

      // Search with variations
      console.log('2️⃣ Searching for "shubhashri" in email...');
      const users = await User.find({ email: /shubhashri/i }).select('_id name email role');

      if (users.length > 0) {
        console.log(`✅ Found ${users.length} user(s) with "shubhashri":`);
        users.forEach(u => {
          console.log(`   - ${u.name} (${u.email}) - Role: ${u.role}`);
        });
      } else {
        console.log('❌ Not found\n');

        // Search all admins
        console.log('3️⃣ Listing all admin users:');
        const admins = await User.find({
          role: { $in: ['admin', 'super_admin', 'sales_team'] }
        }).select('_id name email role linkedUserId');

        if (admins.length > 0) {
          console.log(`✅ Found ${admins.length} admin user(s):\n`);
          for (const admin of admins) {
            console.log(`   📧 ${admin.email}`);
            console.log(`   👤 Name: ${admin.name}`);
            console.log(`   📋 Role: ${admin.role}`);
            console.log(`   🔗 LinkedUserId: ${admin.linkedUserId || 'NOT SET'}`);
            console.log(`   🆔 ID: ${admin._id}\n`);
          }
        } else {
          console.log('❌ No admin users found in database');
        }
      }
    }

    console.log('✅ Search complete!');

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

main();
