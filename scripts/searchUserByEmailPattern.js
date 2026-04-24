require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const PRODUCTION_DB = process.env.MONGO_URI || 'your-production-mongodb-uri';

async function searchUser() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(PRODUCTION_DB);
    console.log('Connected to database\n');

    // Try exact email first
    console.log('=== Exact Email Search ===');
    let user = await User.findOne({
      email: { $regex: '^shubhashri410@gmail\\.com$', $options: 'i' }
    }).lean();

    if (user) {
      console.log('✅ User found with exact email!');
      console.log('User ID:', user._id);
      console.log('Name:', user.name);
      console.log('Email:', user.email);
      console.log('Phone:', user.phone);
      console.log('Autopay Enabled:', user.autopay?.enabled ? '✅ YES' : '❌ NO');
      if (user.autopay) {
        console.log('\nAutopay Details:', JSON.stringify(user.autopay, null, 2));
      }
    } else {
      console.log('User not found with exact email.\n');
    }

    // Search for similar emails
    const searchPatterns = [
      'shubhashri410',
      'shubhashri',
      'shubha',
      '410'
    ];

    for (const pattern of searchPatterns) {
      console.log(`\n=== Searching for: "${pattern}" ===`);
      const users = await User.find({
        $or: [
          { email: new RegExp(pattern, 'i') },
          { name: new RegExp(pattern, 'i') },
          { phone: new RegExp(pattern, 'i') }
        ]
      }).select('_id name email phone autopay.enabled').limit(10).lean();

      if (users.length > 0) {
        console.log(`Found ${users.length} user(s):\n`);
        users.forEach((user, index) => {
          console.log(`${index + 1}. User ID: ${user._id}`);
          console.log(`   Name: ${user.name}`);
          console.log(`   Email: ${user.email}`);
          console.log(`   Phone: ${user.phone || 'N/A'}`);
          console.log(`   Autopay Enabled: ${user.autopay?.enabled ? '✅ YES' : '❌ NO'}`);
          console.log('');
        });
      } else {
        console.log('No users found');
      }
    }

  } catch (error) {
    console.error('Error searching users:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

searchUser();
