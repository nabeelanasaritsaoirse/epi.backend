require('dotenv').config();
const axios = require('axios');

const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

async function checkUser(baseUrl, serverName, email) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 Checking ${serverName}: ${baseUrl}`);
    console.log('='.repeat(60));

    // Login as admin
    const loginRes = await axios.post(`${baseUrl}/auth/admin-login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    const token = loginRes.data.data.accessToken;
    console.log('✅ Admin login successful');

    // Get all users
    const usersRes = await axios.get(`${baseUrl}/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    // Find user by email
    const user = usersRes.data.find(u =>
      u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!user) {
      console.log(`\n❌ User NOT FOUND: ${email}`);
      console.log(`   This user does not exist on ${serverName}`);
      return null;
    }

    // User found - display details
    console.log(`\n✅ User FOUND: ${email}`);
    console.log(`\nBasic Info:`);
    console.log(`   ID: ${user._id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Phone: ${user.phoneNumber || 'N/A'}`);
    console.log(`   Firebase UID: ${user.firebaseUid || 'N/A'}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Active: ${user.isActive}`);
    console.log(`   Created: ${user.createdAt}`);

    // Check deletion request
    if (user.deletionRequest) {
      console.log(`\n⚠️  DELETION REQUEST EXISTS:`);
      console.log(`   Status: ${user.deletionRequest.status}`);
      console.log(`   Requested At: ${user.deletionRequest.requestedAt || 'N/A'}`);
      console.log(`   Reason: ${user.deletionRequest.reason || 'N/A'}`);
      console.log(`   Cancelled At: ${user.deletionRequest.cancelledAt || 'N/A'}`);

      if (user.deletionRequest.status === 'pending') {
        console.log(`\n⛔⛔⛔ THIS IS THE PROBLEM! ⛔⛔⛔`);
        console.log(`   User has PENDING deletion request`);
        console.log(`   Login is BLOCKED by this check (routes/auth.js line 153-159)`);
        console.log(`   Error code: ACCOUNT_DELETION_PENDING`);
      } else if (user.deletionRequest.status === 'cancelled') {
        console.log(`\n✅ Deletion was cancelled - login should work`);
      } else if (user.deletionRequest.status === 'completed') {
        console.log(`\n⚠️  Deletion marked as completed but user still exists`);
      }
    } else {
      console.log(`\n✅ No deletion request - login should work fine`);
    }

    return user;

  } catch (error) {
    console.log(`\n❌ ERROR on ${serverName}:`);
    console.log(`   ${error.response?.data?.message || error.message}`);
    if (error.response?.status === 401) {
      console.log(`   ⚠️  Authentication failed - check admin credentials`);
    }
    return null;
  }
}

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.log('Usage: node scripts/checkUserOnBothServers.js <email>');
    console.log('Example: node scripts/checkUserOnBothServers.js playboyrd2001@gmail.com');
    process.exit(1);
  }

  console.log(`\n🔎 Searching for user: ${email}`);
  console.log(`   on PRODUCTION and DEV servers\n`);

  // Check both servers
  const prodUser = await checkUser('https://api.epielio.com/api', 'PRODUCTION', email);
  const devUser = await checkUser('http://13.127.15.87:8080/api', 'DEV', email);

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));

  if (prodUser) {
    console.log(`✅ PRODUCTION: User exists`);
    if (prodUser.deletionRequest?.status === 'pending') {
      console.log(`   ⛔ Login BLOCKED - Deletion pending`);
    } else {
      console.log(`   ✅ Login should work`);
    }
  } else {
    console.log(`❌ PRODUCTION: User not found`);
  }

  if (devUser) {
    console.log(`✅ DEV: User exists`);
    if (devUser.deletionRequest?.status === 'pending') {
      console.log(`   ⛔ Login BLOCKED - Deletion pending`);
    } else {
      console.log(`   ✅ Login should work`);
    }
  } else {
    console.log(`❌ DEV: User not found`);
  }

  console.log('');
}

main();
