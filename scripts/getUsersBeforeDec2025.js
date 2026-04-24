const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

async function getUsersRegisteredBeforeDate() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all users registered before December 1, 2025
    const targetDate = new Date('2025-12-01T00:00:00.000Z');

    const users = await User.find({
      createdAt: { $lt: targetDate }
    })
    .select('name email phoneNumber createdAt role authMethod')
    .sort({ createdAt: 1 }); // Sort by oldest first

    console.log(`\n📊 Total users registered before Dec 1, 2025: ${users.length}\n`);

    if (users.length > 0) {
      console.log('User List:');
      console.log('='.repeat(100));

      users.forEach((user, index) => {
        console.log(`${index + 1}. Name: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Phone: ${user.phoneNumber || 'N/A'}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Auth Method: ${user.authMethod}`);
        console.log(`   Registered: ${user.createdAt.toLocaleString()}`);
        console.log(`   User ID: ${user._id}`);
        console.log('-'.repeat(100));
      });

      // Export to CSV format
      console.log('\n\n📄 CSV Format (copy and paste to Excel):');
      console.log('Name,Email,Phone,Role,Auth Method,Registration Date,User ID');
      users.forEach(user => {
        console.log(`"${user.name}","${user.email}","${user.phoneNumber || 'N/A'}","${user.role}","${user.authMethod}","${user.createdAt.toISOString()}","${user._id}"`);
      });

      // Statistics
      console.log('\n\n📈 Statistics:');
      const roleStats = users.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {});

      console.log('Users by Role:');
      Object.entries(roleStats).forEach(([role, count]) => {
        console.log(`  - ${role}: ${count}`);
      });

      const authStats = users.reduce((acc, user) => {
        acc[user.authMethod] = (acc[user.authMethod] || 0) + 1;
        return acc;
      }, {});

      console.log('\nUsers by Auth Method:');
      Object.entries(authStats).forEach(([method, count]) => {
        console.log(`  - ${method}: ${count}`);
      });
    } else {
      console.log('No users found registered before December 1, 2025');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

// Run the script
getUsersRegisteredBeforeDate();
