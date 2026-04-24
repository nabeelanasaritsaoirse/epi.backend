require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function verifyAutopay() {
  try {
    console.log('=== Verifying Autopay in Database ===\n');

    const userId = '6953ba1dad6010200641a51a'; // Deep user
    const userId2 = '692fef3d366f134d450f324a'; // Shubhashri user

    console.log('Connecting to database...');
    console.log('MongoDB URI:', process.env.MONGO_URI ? 'Found' : 'Not found');

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to database\n');

    // Check Deep user
    console.log('=== Checking Deep user (6953ba1dad6010200641a51a) ===');
    const deepUser = await User.findById(userId).select('name email autopaySettings autopay');

    if (deepUser) {
      console.log('✅ User found:', deepUser.name, '(' + deepUser.email + ')');
      console.log('\nautopaySettings:');
      console.log(JSON.stringify(deepUser.autopaySettings, null, 2));
      console.log('\nautopay (legacy):');
      console.log(JSON.stringify(deepUser.autopay, null, 2));
    } else {
      console.log('❌ User not found');
    }

    console.log('\n');

    // Check Shubhashri user
    console.log('=== Checking Shubhashri user (692fef3d366f134d450f324a) ===');
    const shubhaUser = await User.findById(userId2).select('name email autopaySettings autopay');

    if (shubhaUser) {
      console.log('✅ User found:', shubhaUser.name, '(' + shubhaUser.email + ')');
      console.log('\nautopaySettings:');
      console.log(JSON.stringify(shubhaUser.autopaySettings, null, 2));
      console.log('\nautopay (legacy):');
      console.log(JSON.stringify(shubhaUser.autopay, null, 2));
    } else {
      console.log('❌ User not found');
    }

    console.log('\n');

    // Count all users with autopay enabled
    console.log('=== Checking all users with autopay enabled ===');
    const usersWithAutopay = await User.find({
      'autopaySettings.enabled': true
    }).select('name email autopaySettings.enabled');

    console.log(`Found ${usersWithAutopay.length} users with autopay enabled:`);
    usersWithAutopay.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.name} (${user.email})`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Verification completed');

  } catch (error) {
    console.error('Error:', error.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  }
}

verifyAutopay();
