const axios = require('axios');

// ========== CONFIGURATION ==========
const BASE_URL = 'http://13.127.15.87:8080';
const ADMIN_EMAIL = 'shubhashri.it.saoirse@gmail.com';
const ADMIN_PASSWORD = 'Shubha@123';

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
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
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

// ========== ADMIN LOGIN ==========
async function adminLogin() {
  logSection('STEP 1: Admin Login');

  try {
    logInfo(`Attempting admin login with email: ${ADMIN_EMAIL}`);

    const response = await axios.post(`${BASE_URL}/api/auth/admin-login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    if (response.data.success) {
      logSuccess('Admin login successful!');
      logInfo(`User ID: ${response.data.data.userId}`);
      logInfo(`Name: ${response.data.data.name}`);
      logInfo(`Role: ${response.data.data.role}`);
      logInfo(`Is Super Admin: ${response.data.data.isSuperAdmin}`);

      if (response.data.data.accessToken) {
        logSuccess('Access token received');
        return {
          accessToken: response.data.data.accessToken,
          refreshToken: response.data.data.refreshToken,
          userId: response.data.data.userId,
          role: response.data.data.role
        };
      } else {
        logError('No access token in response!');
        console.log('Response data:', JSON.stringify(response.data, null, 2));
        return null;
      }
    } else {
      logError('Login failed!');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    logError('Admin Login Failed!');

    if (error.response) {
      logError(`Status: ${error.response.status}`);
      logError(`Message: ${error.response.data?.message || 'Unknown error'}`);
      console.log('\nFull error response:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      logError('No response received from server');
      logError('Please check if the server is running at ' + BASE_URL);
    } else {
      logError(`Error: ${error.message}`);
    }

    return null;
  }
}

// ========== TEST MY OPPORTUNITIES API ==========
async function testMyOpportunities(accessToken, page = 1, limit = 20, type = null) {
  logSection(`STEP 2: Testing My Opportunities API (page=${page}, limit=${limit}${type ? `, type=${type}` : ''})`);

  try {
    const url = `${BASE_URL}/api/sales/my-opportunities`;
    const params = { page, limit };
    if (type) params.type = type;

    logInfo(`Making request to: ${url}`);
    logInfo(`Query params: ${JSON.stringify(params)}`);

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      params
    });

    if (response.data.success) {
      logSuccess('My Opportunities API call successful!');

      const { opportunities, pagination, summary } = response.data.data;

      logInfo(`\nPagination Info:`);
      console.log(`  Total opportunities: ${pagination.total}`);
      console.log(`  Current page: ${pagination.page}`);
      console.log(`  Limit: ${pagination.limit}`);
      console.log(`  Total pages: ${pagination.totalPages}`);

      logInfo(`\nSummary:`);
      console.log(`  With Cart: ${summary.withCart}`);
      console.log(`  With Wishlist: ${summary.withWishlist}`);
      console.log(`  Inactive Users: ${summary.inactive}`);
      console.log(`  New Signups: ${summary.newSignups}`);

      if (opportunities && opportunities.length > 0) {
        logSuccess(`Found ${opportunities.length} opportunities on this page`);

        logInfo(`\nFirst 5 opportunities:`);
        opportunities.slice(0, 5).forEach((opp, index) => {
          console.log(`\n  ${index + 1}. ${opp.name || 'No name'}`);
          console.log(`     Type: ${opp.type}`);
          console.log(`     Level: L${opp.level}`);
          console.log(`     Email: ${opp.email || 'N/A'}`);
          console.log(`     Phone: ${opp.phoneNumber || 'N/A'}`);
          if (opp.details) {
            console.log(`     Details:`, JSON.stringify(opp.details, null, 6));
          }
        });

        return { success: true, data: response.data.data };
      } else {
        logWarning('No opportunities found!');
        logWarning('This could mean:');
        console.log('  - The logged-in user has no referrals (L1 or L2)');
        console.log('  - None of the referrals have cart items, wishlist items, or are inactive/new');
        console.log('  - The user might need a linkedUserId to connect to a regular user account');

        return { success: true, data: response.data.data, isEmpty: true };
      }
    } else {
      logError('API returned success: false');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      return { success: false, error: response.data };
    }
  } catch (error) {
    logError('My Opportunities API Failed!');

    if (error.response) {
      logError(`Status: ${error.response.status}`);
      logError(`Message: ${error.response.data?.message || 'Unknown error'}`);

      if (error.response.status === 401) {
        logWarning('Authentication failed! Token might be invalid or expired.');
      } else if (error.response.status === 403) {
        logWarning('Access denied! User might not have sales team permissions.');
        logWarning('Check that the user has role: sales_team, admin with sales module, or super_admin');
      }

      console.log('\nFull error response:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      logError('No response received from server');
    } else {
      logError(`Error: ${error.message}`);
    }

    return { success: false, error: error.message };
  }
}

// ========== TEST MY STATS API ==========
async function testMyStats(accessToken) {
  logSection('STEP 3: Testing My Stats API');

  try {
    const url = `${BASE_URL}/api/sales/my-stats`;

    logInfo(`Making request to: ${url}`);

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success) {
      logSuccess('My Stats API call successful!');

      const { user, teamStats, orderStats, revenueStats, commissionStats, conversionRate } = response.data.data;

      logInfo(`\nUser Info:`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Referral Code: ${user.referralCode}`);
      console.log(`  Referral Limit: ${user.referralLimit}`);
      console.log(`  Remaining Referrals: ${user.remainingReferrals}`);

      logInfo(`\nTeam Stats:`);
      console.log(`  Total L1 Members: ${teamStats.totalL1Members}`);
      console.log(`  Total L2 Users: ${teamStats.totalL2Users}`);
      console.log(`  Total Team Size: ${teamStats.totalTeamSize}`);
      console.log(`  Active Members: ${teamStats.activeMembers}`);
      console.log(`  New This Period: ${teamStats.newThisPeriod}`);

      logInfo(`\nOrder Stats:`);
      console.log(`  Total Orders: ${orderStats.totalOrders}`);
      console.log(`  Active Orders: ${orderStats.activeOrders}`);
      console.log(`  Completed Orders: ${orderStats.completedOrders}`);
      console.log(`  Total Order Value: ₹${orderStats.totalOrderValue}`);

      logInfo(`\nRevenue Stats:`);
      console.log(`  Total Paid Amount: ₹${revenueStats.totalPaidAmount}`);
      console.log(`  Pending Amount: ₹${revenueStats.pendingAmount}`);

      logInfo(`\nCommission Stats:`);
      console.log(`  Total Earned: ₹${commissionStats.totalEarned}`);
      console.log(`  From L1: ₹${commissionStats.fromL1}`);
      console.log(`  From L2: ₹${commissionStats.fromL2}`);

      logInfo(`\nConversion Rate: ${conversionRate}%`);

      return { success: true, data: response.data.data };
    } else {
      logError('API returned success: false');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      return { success: false, error: response.data };
    }
  } catch (error) {
    logError('My Stats API Failed!');

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
  logSection('STEP 4: Testing My Team API');

  try {
    const url = `${BASE_URL}/api/sales/my-team`;

    logInfo(`Making request to: ${url}`);

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      params: { page: 1, limit: 10 }
    });

    if (response.data.success) {
      logSuccess('My Team API call successful!');

      const { teamMembers, pagination, summary } = response.data.data;

      logInfo(`\nSummary:`);
      console.log(`  Total L1: ${summary.totalL1}`);
      console.log(`  Total L2: ${summary.totalL2}`);
      console.log(`  Active Members: ${summary.activeMembers}`);

      logInfo(`\nPagination:`);
      console.log(`  Total: ${pagination.total}`);
      console.log(`  Page: ${pagination.page}/${pagination.totalPages}`);

      if (teamMembers && teamMembers.length > 0) {
        logSuccess(`Found ${teamMembers.length} team members`);

        logInfo(`\nFirst 3 team members:`);
        teamMembers.slice(0, 3).forEach((member, index) => {
          console.log(`\n  ${index + 1}. ${member.name}`);
          console.log(`     Email: ${member.email}`);
          console.log(`     Referral Code: ${member.referralCode}`);
          console.log(`     L2 Count: ${member.stats.level2Count}`);
          console.log(`     Total Orders: ${member.stats.totalOrders}`);
          console.log(`     Active Orders: ${member.stats.activeOrders}`);
        });
      } else {
        logWarning('No team members found!');
        logWarning('The logged-in user has no L1 referrals.');
      }

      return { success: true, data: response.data.data };
    } else {
      logError('API returned success: false');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      return { success: false, error: response.data };
    }
  } catch (error) {
    logError('My Team API Failed!');

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

// ========== MAIN EXECUTION ==========
async function main() {
  try {
    log('\n' + '█'.repeat(60), 'magenta');
    log('       SALES OPPORTUNITIES API TEST SCRIPT', 'magenta');
    log('█'.repeat(60) + '\n', 'magenta');

    logInfo(`Testing against: ${BASE_URL}`);
    logInfo(`Admin Email: ${ADMIN_EMAIL}`);
    console.log('');

    // Step 1: Admin Login
    const loginResult = await adminLogin();

    if (!loginResult) {
      logError('\n❌ Cannot proceed without valid login. Exiting...');
      process.exit(1);
    }

    const { accessToken } = loginResult;

    // Step 2: Test My Opportunities API
    const opportunitiesResult = await testMyOpportunities(accessToken, 1, 20);

    // Step 3: Test My Stats API
    const statsResult = await testMyStats(accessToken);

    // Step 4: Test My Team API
    const teamResult = await testMyTeam(accessToken);

    // ========== SUMMARY ==========
    logSection('FINAL SUMMARY');

    const allTests = [
      { name: 'Admin Login', result: loginResult },
      { name: 'My Opportunities API', result: opportunitiesResult },
      { name: 'My Stats API', result: statsResult },
      { name: 'My Team API', result: teamResult }
    ];

    console.log('');
    allTests.forEach(test => {
      if (test.result && test.result.success) {
        logSuccess(`${test.name}: PASSED`);
      } else {
        logError(`${test.name}: FAILED`);
      }
    });

    console.log('\n');

    // Check if opportunities are empty
    if (opportunitiesResult.success && opportunitiesResult.isEmpty) {
      logSection('DIAGNOSIS: Why No Opportunities?');

      logInfo('Checking the reasons...\n');

      if (statsResult.success && statsResult.data) {
        const teamSize = statsResult.data.teamStats.totalTeamSize;

        if (teamSize === 0) {
          logWarning('ROOT CAUSE: No referrals in the chain');
          console.log('\nThe logged-in user has:');
          console.log('  - 0 L1 members (direct referrals)');
          console.log('  - 0 L2 users (indirect referrals)');
          console.log('\nSOLUTION:');
          console.log('  1. Check if this admin user has a "linkedUserId" field');
          console.log('  2. If yes, it should link to a regular user account with referrals');
          console.log('  3. If no, this admin needs referrals to see opportunities');
        } else {
          logWarning('Team exists but no opportunities found');
          console.log(`\nThe user has ${teamSize} team members but:`);
          console.log('  - None have items in cart (without orders)');
          console.log('  - None have items in wishlist (without orders)');
          console.log('  - None are inactive for 30+ days');
          console.log('  - None are new signups in last 7 days without orders');
          console.log('\nThis is normal if all team members are either:');
          console.log('  - Already have orders (converted)');
          console.log('  - Active users without cart/wishlist');
        }
      }
    }

    logSection('TEST COMPLETED');
    log('Thank you for using the test script!', 'green');

  } catch (error) {
    logError('\n\n❌ UNEXPECTED ERROR IN MAIN EXECUTION');
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main();
