/**
 * Check User FCM Token - Run this ON production server
 *
 * Usage on production:
 * cd /var/www/epi-backend
 * node check-user-fcm-token.js
 */

const mongoose = require('mongoose');

// User ID from the token
const USER_ID = '69325d650e5fae0da2739122';

async function checkUserFCMToken() {
  try {
    console.log('🔌 Connecting to MongoDB...');

    // Use environment variable or default
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/your_database';
    await mongoose.connect(MONGO_URI);

    console.log('✅ Connected to MongoDB\n');

    // Load User model
    const User = require('./models/User');

    console.log('🔍 Looking for user ID:', USER_ID);
    const user = await User.findById(USER_ID);

    if (!user) {
      console.log('❌ User not found with ID:', USER_ID);
      mongoose.connection.close();
      process.exit(1);
    }

    console.log('\n👤 User Information:');
    console.log('   Name:', user.name || 'N/A');
    console.log('   Phone:', user.phoneNumber || 'N/A');
    console.log('   Email:', user.email || 'N/A');
    console.log('   User ID:', user._id);

    console.log('\n📱 FCM Token Status:');

    if (user.deviceToken) {
      console.log('   ✅ FCM Token: PRESENT');
      console.log('   Token:', user.deviceToken);
      console.log('\n✅ Push notifications should work for this user!');
      console.log('\n🔍 Next Step: Check Firebase initialization');
      console.log('   Run: pm2 logs epi-backend --lines 100 | grep -i firebase');
    } else {
      console.log('   ❌ FCM Token: NOT REGISTERED');
      console.log('\n⚠️  This is why pushResult is null!');
      console.log('\n💡 Solution:');
      console.log('   The user needs to:');
      console.log('   1. Open the mobile app');
      console.log('   2. Allow notification permissions when prompted');
      console.log('   3. The app will automatically register the FCM token');
      console.log('   4. Then push notifications will work');
      console.log('\n📝 Technical Details:');
      console.log('   - FCM token is stored in User.deviceToken field');
      console.log('   - Token is registered when user opens app with permissions');
      console.log('   - Without token, push notifications cannot be delivered');
    }

    mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (mongoose.connection.readyState === 1) {
      mongoose.connection.close();
    }
    process.exit(1);
  }
}

checkUserFCMToken();
