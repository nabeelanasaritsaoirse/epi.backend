require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const usersToUpdate = [
  { name: 'Kalandarmohomad', email: 'kalandarmohomad@gmail.com', phone: '+91 88615 02102' },
  { name: 'Sunil Kumar', email: 'sunil593527@gmail.com', phone: '+91 77381 65654' },
  { name: 'Syed Aftab', email: 'syedaftab536@gmail.com', phone: '+91 92067 56533' },
  { name: 'Vishal', email: 'vishaldesk93@gmail.com', phone: '+91 99008 42898' },
  { name: 'Rachappaji', email: 'rachunrachu650@gamil.com', phone: '+91 95386 19278' },
  { name: 'Imran Ali', email: 'imrannadaf003@gmail.com', phone: '+91 96869 74103' },
  { name: 'Prakyath D P', email: 'dpprakyath08@gmail.com', phone: '8431847996' }
];

async function setReferralLimits() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    console.log('\n=== Setting Referral Limits to 500 ===\n');

    for (const userData of usersToUpdate) {
      console.log(`\nSearching for: ${userData.name} (${userData.email})`);

      // Try to find by email first
      let user = await User.findOne({ email: userData.email });

      // If not found by email, try by phone (normalize phone number)
      if (!user && userData.phone) {
        const normalizedPhone = userData.phone.replace(/\s+/g, '');
        user = await User.findOne({ phoneNumber: normalizedPhone });

        if (!user) {
          // Try without country code
          const phoneWithoutCode = normalizedPhone.replace('+91', '');
          user = await User.findOne({ phoneNumber: phoneWithoutCode });
        }
      }

      if (user) {
        const oldLimit = user.referralLimit || 0;
        user.referralLimit = 500;
        await user.save();

        console.log(`✓ UPDATED: ${user.name} (${user.email})`);
        console.log(`  User ID: ${user._id}`);
        console.log(`  Old Limit: ${oldLimit}`);
        console.log(`  New Limit: ${user.referralLimit}`);
        console.log(`  Phone: ${user.phoneNumber}`);
      } else {
        console.log(`✗ NOT FOUND: ${userData.name} (${userData.email})`);
        console.log(`  Phone searched: ${userData.phone}`);
      }
    }

    console.log('\n=== Verification ===\n');
    console.log('Checking all updated users...\n');

    for (const userData of usersToUpdate) {
      const user = await User.findOne({ email: userData.email });
      if (user) {
        console.log(`${user.name}: Limit = ${user.referralLimit}`);
      }
    }

    console.log('\n=== Checking Admin User ===\n');
    const adminUser = await User.findOne({ email: 'admin@epi.com' });
    if (adminUser) {
      console.log(`Admin User: ${adminUser.name}`);
      console.log(`Admin ID: ${adminUser._id}`);
      console.log(`Admin Referral Limit: ${adminUser.referralLimit || 0}`);
      console.log(`Admin Role: ${adminUser.role}`);
    } else {
      console.log('Admin user not found!');
    }

    await mongoose.connection.close();
    console.log('\n✓ Done! Database connection closed.');
  } catch (error) {
    console.error('Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

setReferralLimits();
