/**
 * Get Shubha's User ID from email
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function getUserId() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/your_database';

    // Try to connect - use production connection string if available
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const email = 'shubhashri.it.saoirse@gmail.com';
    const user = await User.findOne({ email }).select('_id name email deviceToken');

    if (!user) {
      console.log(`❌ User not found with email: ${email}`);
      process.exit(1);
    }

    console.log('✅ User found!');
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   User ID: ${user._id}`);
    console.log(`   Has Device Token: ${user.deviceToken ? 'Yes ✅' : 'No ❌'}`);

    if (user.deviceToken) {
      console.log(`   Device Token: ${user.deviceToken.substring(0, 50)}...`);
    }

    console.log(`\n📋 Copy this User ID for the script:`);
    console.log(`   ${user._id}`);

    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

getUserId();
