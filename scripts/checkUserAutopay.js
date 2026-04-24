require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const PRODUCTION_DB = process.env.MONGO_URI || 'your-production-mongodb-uri';

async function checkUserAutopay() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(PRODUCTION_DB);
    console.log('Connected to database\n');

    const userEmail = 'shubhashri410@gmail.com';

    console.log(`Searching for user: ${userEmail}`);
    const user = await User.findOne({ email: userEmail }).lean();

    if (!user) {
      console.log('❌ User not found with this email');
      return;
    }

    console.log('\n=== User Details ===');
    console.log('User ID:', user._id);
    console.log('Name:', user.name);
    console.log('Email:', user.email);
    console.log('Phone:', user.phone);

    console.log('\n=== Autopay Status ===');

    if (user.autopay) {
      console.log('✅ Autopay is ENABLED');
      console.log('\nAutopay Configuration:');
      console.log('  - Enabled:', user.autopay.enabled || false);
      console.log('  - UPI ID:', user.autopay.upiId || 'Not set');
      console.log('  - Bank Account:', user.autopay.bankAccount || 'Not set');
      console.log('  - IFSC Code:', user.autopay.ifscCode || 'Not set');
      console.log('  - Account Holder:', user.autopay.accountHolderName || 'Not set');
      console.log('  - Created At:', user.autopay.createdAt || 'N/A');
      console.log('  - Updated At:', user.autopay.updatedAt || 'N/A');

      if (user.autopay.enabled) {
        console.log('\n✅ Autopay is ACTIVE and configured');
      } else {
        console.log('\n⚠️  Autopay object exists but is NOT enabled');
      }
    } else {
      console.log('❌ Autopay is NOT ENABLED (no autopay configuration found)');
    }

    console.log('\n=== Additional User Info ===');
    console.log('Wallet Balance:', user.wallet?.balance || 0);
    console.log('KYC Status:', user.kycStatus || 'Not verified');
    console.log('Account Status:', user.status || 'N/A');
    console.log('Created At:', user.createdAt);

  } catch (error) {
    console.error('Error checking user autopay:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

checkUserAutopay();
