const axios = require('axios');

// ========== CONFIGURATION ==========
const BASE_URL = 'http://13.127.15.87:8080';
const ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTg1ODdhMjk4MTA0ZGQ4NDY0ZDViYjQiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NzA3ODgwODQsImV4cCI6MTc3MTM5Mjg4NH0.kajqBVjtwGaTe8h2NcMH_wziUgKly3K2DUpYl2F24UM';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Helper function to print colored output
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'cyan');
  console.log('='.repeat(70) + '\n');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue');
}

// Decode JWT to see payload
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload;
  } catch (error) {
    return null;
  }
}

// ========== TEST MY TEAM USERS API ==========
async function testMyTeamUsers(accessToken) {
  logSection('Testing /api/sales/my-team/users API');

  try {
    const url = `${BASE_URL}/api/sales/my-team/users`;
    const params = { page: 1, limit: 10 };

    logInfo(`Request URL: ${url}`);
    logInfo(`Query Params: ${JSON.stringify(params)}`);
    logInfo(`Token: ${accessToken.substring(0, 50)}...`);

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'  // Prevent caching
      },
      params
    });

    logSuccess(`Status: ${response.status}`);

    if (response.data.success) {
      logSuccess('API call successful!');

      const { users, pagination, breakdown } = response.data.data;

      logInfo(`\n📊 Breakdown:`);
      console.log(`  Level 1 Users: ${breakdown.level1Users}`);
      console.log(`  Level 2 Users: ${breakdown.level2Users}`);
      console.log(`  Users with Orders: ${breakdown.usersWithOrders}`);

      logInfo(`\n📄 Pagination:`);
      console.log(`  Total: ${pagination.total}`);
      console.log(`  Page: ${pagination.page}/${pagination.totalPages}`);
      console.log(`  Limit: ${pagination.limit}`);

      if (users && users.length > 0) {
        logSuccess(`\n✅ Found ${users.length} users on this page`);

        logInfo(`\n👥 Users List (showing first 5):`);
        users.slice(0, 5).forEach((user, index) => {
          console.log(`\n  ${index + 1}. ${user.name}`);
          console.log(`     Level: L${user.level}`);
          console.log(`     Email: ${user.email || 'N/A'}`);
          console.log(`     Phone: ${user.phoneNumber || 'N/A'}`);
          console.log(`     Created: ${new Date(user.createdAt).toLocaleDateString()}`);
          if (user.referredBy) {
            console.log(`     Referred By: ${user.referredBy.name} (${user.referredBy.referralCode})`);
          }
          if (user.orderStats) {
            console.log(`     Orders: ${user.orderStats.totalOrders} (${user.orderStats.activeOrders} active)`);
            console.log(`     Total Paid: ₹${user.orderStats.totalPaid}`);
          }
        });

        return { success: true, hasData: true, data: response.data.data };
      } else {
        logWarning('\n⚠️ API returned empty array!');
        logWarning('No users found in your referral chain.');

        if (breakdown.level1Users === 0 && breakdown.level2Users === 0) {
          logError('\n❌ ROOT CAUSE: No referrals at all');
          console.log('\nThis admin user has:');
          console.log('  - 0 Level 1 referrals (direct)');
          console.log('  - 0 Level 2 referrals (indirect)');
        }

        return { success: true, hasData: false, data: response.data.data };
      }
    } else {
      logError('API returned success: false');
      console.log('\nFull Response:', JSON.stringify(response.data, null, 2));
      return { success: false, error: response.data };
    }
  } catch (error) {
    logError('API call failed!');

    if (error.response) {
      logError(`Status: ${error.response.status}`);
      logError(`Message: ${error.response.data?.message || 'Unknown error'}`);
      console.log('\nFull error response:', JSON.stringify(error.response.data, null, 2));
    } else {
      logError(`Error: ${error.message}`);
    }

    return { success: false, error: error.message };
  }
}

// ========== TEST MY OPPORTUNITIES API ==========
async function testMyOpportunities(accessToken) {
  logSection('Testing /api/sales/my-opportunities API');

  try {
    const url = `${BASE_URL}/api/sales/my-opportunities`;
    const params = { page: 1, limit: 20 };

    logInfo(`Request URL: ${url}`);
    logInfo(`Query Params: ${JSON.stringify(params)}`);

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      params
    });

    logSuccess(`Status: ${response.status}`);

    if (response.data.success) {
      logSuccess('API call successful!');

      const { opportunities, pagination, summary } = response.data.data;

      logInfo(`\n📊 Summary:`);
      console.log(`  With Cart: ${summary.withCart}`);
      console.log(`  With Wishlist: ${summary.withWishlist}`);
      console.log(`  Inactive Users: ${summary.inactive}`);
      console.log(`  New Signups: ${summary.newSignups}`);

      logInfo(`\n📄 Pagination:`);
      console.log(`  Total: ${pagination.total}`);
      console.log(`  Page: ${pagination.page}/${pagination.totalPages}`);

      if (opportunities && opportunities.length > 0) {
        logSuccess(`\n✅ Found ${opportunities.length} opportunities`);

        logInfo(`\n🎯 Opportunities List (showing first 5):`);
        opportunities.slice(0, 5).forEach((opp, index) => {
          console.log(`\n  ${index + 1}. ${opp.name}`);
          console.log(`     Type: ${opp.type}`);
          console.log(`     Level: L${opp.level}`);
          console.log(`     Email: ${opp.email || 'N/A'}`);
          console.log(`     Phone: ${opp.phoneNumber || 'N/A'}`);
          if (opp.details) {
            console.log(`     Details:`, JSON.stringify(opp.details, null, 6));
          }
        });

        return { success: true, hasData: true, data: response.data.data };
      } else {
        logWarning('\n⚠️ No opportunities found!');
        return { success: true, hasData: false, data: response.data.data };
      }
    } else {
      logError('API returned success: false');
      console.log('\nFull Response:', JSON.stringify(response.data, null, 2));
      return { success: false, error: response.data };
    }
  } catch (error) {
    logError('API call failed!');

    if (error.response) {
      logError(`Status: ${error.response.status}`);
      logError(`Message: ${error.response.data?.message || 'Unknown error'}`);
      console.log('\nFull error response:', JSON.stringify(error.response.data, null, 2));
    } else {
      logError(`Error: ${error.message}`);
    }

    return { success: false, error: error.message };
  }
}

// ========== TEST MY TEAM API ==========
async function testMyTeam(accessToken) {
  logSection('Testing /api/sales/my-team API');

  try {
    const url = `${BASE_URL}/api/sales/my-team`;
    const params = { page: 1, limit: 10 };

    logInfo(`Request URL: ${url}`);

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      params
    });

    logSuccess(`Status: ${response.status}`);

    if (response.data.success) {
      logSuccess('API call successful!');

      const { teamMembers, pagination, summary } = response.data.data;

      logInfo(`\n📊 Summary:`);
      console.log(`  Total L1: ${summary.totalL1}`);
      console.log(`  Total L2: ${summary.totalL2}`);
      console.log(`  Active Members: ${summary.activeMembers}`);

      logInfo(`\n📄 Pagination:`);
      console.log(`  Total: ${pagination.total}`);
      console.log(`  Page: ${pagination.page}/${pagination.totalPages}`);

      if (teamMembers && teamMembers.length > 0) {
        logSuccess(`\n✅ Found ${teamMembers.length} team members`);

        logInfo(`\n👥 Team Members (showing first 3):`);
        teamMembers.slice(0, 3).forEach((member, index) => {
          console.log(`\n  ${index + 1}. ${member.name}`);
          console.log(`     Email: ${member.email}`);
          console.log(`     Referral Code: ${member.referralCode}`);
          console.log(`     L2 Count: ${member.stats.level2Count}`);
          console.log(`     Total Orders: ${member.stats.totalOrders}`);
          console.log(`     Active Orders: ${member.stats.activeOrders}`);
          console.log(`     Order Value: ₹${member.stats.totalOrderValue}`);
        });

        return { success: true, hasData: true, data: response.data.data };
      } else {
        logWarning('\n⚠️ No team members found!');
        return { success: true, hasData: false, data: response.data.data };
      }
    } else {
      logError('API returned success: false');
      console.log('\nFull Response:', JSON.stringify(response.data, null, 2));
      return { success: false, error: response.data };
    }
  } catch (error) {
    logError('API call failed!');

    if (error.response) {
      logError(`Status: ${error.response.status}`);
      logError(`Message: ${error.response.data?.message || 'Unknown error'}`);
      console.log('\nFull error response:', JSON.stringify(error.response.data, null, 2));
    } else {
      logError(`Error: ${error.message}`);
    }

    return { success: false, error: error.message };
  }
}

// ========== CHECK USER IN DATABASE ==========
async function checkUserInDatabase(userId) {
  logSection('Checking User in Database');

  const User = require('../models/User');
  const mongoose = require('mongoose');

  try {
    // Connect to database
    const dbUri = process.env.MONGO_URI || 'mongodb://localhost:27017/epi';
    logInfo(`Connecting to database...`);
    await mongoose.connect(dbUri);
    logSuccess('Database connected');

    // Find user
    logInfo(`Looking up user ID: ${userId}`);
    const user = await User.findById(userId)
      .select('name email role linkedUserId referralCode referredBy referredUsers')
      .populate('linkedUserId', 'name email referralCode')
      .populate('referredBy', 'name referralCode')
      .lean();

    if (!user) {
      logError('User not found in database!');
      await mongoose.disconnect();
      return null;
    }

    logSuccess('User found!');
    console.log('\n👤 User Details:');
    console.log(`  Name: ${user.name}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Referral Code: ${user.referralCode || 'N/A'}`);

    if (user.linkedUserId) {
      logInfo(`\n🔗 Linked User ID exists!`);
      console.log(`  Linked User Name: ${user.linkedUserId.name}`);
      console.log(`  Linked User Email: ${user.linkedUserId.email}`);
      console.log(`  Linked User Referral Code: ${user.linkedUserId.referralCode}`);
      console.log('\n  ℹ️ This means the sales APIs will use the linked user account for data');
    } else {
      logWarning(`\n⚠️ No linkedUserId found!`);
      console.log('  This admin will use their own account for sales data');
    }

    if (user.referredBy) {
      logInfo(`\n👆 Referred By:`);
      console.log(`  Name: ${user.referredBy.name}`);
      console.log(`  Code: ${user.referredBy.referralCode}`);
    }

    const referredCount = user.referredUsers ? user.referredUsers.length : 0;
    logInfo(`\n👥 Direct Referrals (L1): ${referredCount}`);

    if (referredCount === 0) {
      logWarning('  This user has no direct referrals!');
      logWarning('  That\'s why /my-team/users returns empty array');
    } else {
      logSuccess(`  This user has ${referredCount} direct referrals`);
    }

    await mongoose.disconnect();
    return user;

  } catch (error) {
    logError('Database check failed!');
    logError(`Error: ${error.message}`);
    await mongoose.disconnect();
    return null;
  }
}

// ========== MAIN EXECUTION ==========
async function main() {
  try {
    log('\n' + '█'.repeat(70), 'magenta');
    log('          SALES API DEBUG WITH PROVIDED TOKEN', 'magenta');
    log('█'.repeat(70) + '\n', 'magenta');

    logInfo(`Testing against: ${BASE_URL}`);

    // Decode JWT token
    logSection('Decoding JWT Token');
    const decoded = decodeJWT(ACCESS_TOKEN);

    if (decoded) {
      logSuccess('Token decoded successfully!');
      console.log('\n🔑 Token Payload:');
      console.log(`  User ID: ${decoded.userId}`);
      console.log(`  Role: ${decoded.role}`);
      console.log(`  Issued At: ${new Date(decoded.iat * 1000).toLocaleString()}`);
      console.log(`  Expires At: ${new Date(decoded.exp * 1000).toLocaleString()}`);

      const now = Date.now() / 1000;
      if (decoded.exp < now) {
        logError('\n❌ Token is EXPIRED!');
      } else {
        logSuccess('\n✅ Token is still valid');
        const remainingHours = Math.floor((decoded.exp - now) / 3600);
        logInfo(`   Remaining: ${remainingHours} hours`);
      }
    } else {
      logError('Failed to decode token!');
    }

    // Check user in database
    if (decoded && decoded.userId) {
      await checkUserInDatabase(decoded.userId);
    }

    // Test APIs
    const teamUsersResult = await testMyTeamUsers(ACCESS_TOKEN);
    const teamResult = await testMyTeam(ACCESS_TOKEN);
    const opportunitiesResult = await testMyOpportunities(ACCESS_TOKEN);

    // ========== FINAL DIAGNOSIS ==========
    logSection('🔍 DIAGNOSIS & ROOT CAUSE ANALYSIS');

    if (teamUsersResult.success && !teamUsersResult.hasData) {
      logError('\n❌ PROBLEM IDENTIFIED: No data in my-team/users');

      console.log('\n📋 Possible Reasons:\n');

      console.log('1️⃣  This admin has no referrals');
      console.log('   - Check if this admin account has a linkedUserId');
      console.log('   - If yes, check if the linked user has referrals');
      console.log('   - If no, this admin needs direct referrals to see data\n');

      console.log('2️⃣  linkedUserId is missing or incorrect');
      console.log('   - Admin accounts for sales team should have linkedUserId');
      console.log('   - This links them to a regular user account with team data\n');

      console.log('3️⃣  The referral chain is empty');
      console.log('   - Even if the user exists, they might not have referred anyone\n');

      logInfo('\n💡 SOLUTION:');
      console.log('\nTo fix this, you need to:');
      console.log('  A. Find or create a user with referrals');
      console.log('  B. Update this admin\'s linkedUserId to point to that user');
      console.log('  C. Or, add referrals to this admin\'s own account');

      console.log('\n📝 Example MongoDB Update:');
      console.log(`
      db.users.updateOne(
        { _id: ObjectId("${decoded.userId}") },
        { $set: { linkedUserId: ObjectId("USER_WITH_REFERRALS_ID") } }
      )
      `);
    } else if (teamUsersResult.success && teamUsersResult.hasData) {
      logSuccess('\n✅ DATA IS PRESENT!');
      logSuccess('The API is working correctly and returning data.');
    }

    logSection('TEST COMPLETED');
    log('Check the detailed logs above for more information.', 'green');

  } catch (error) {
    logError('\n\n❌ UNEXPECTED ERROR IN MAIN EXECUTION');
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main();
