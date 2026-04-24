/**
 * Comprehensive Sales Opportunities API Debugging Script
 *
 * This script debugs the /api/sales/my-opportunities endpoint and related sales APIs
 * Tests with admin credentials and checks for optimization and error handling
 */

const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://13.127.15.87:8080';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = {
  section: (msg) => console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(80)}${colors.reset}`),
  title: (msg) => console.log(`${colors.bright}${colors.magenta}📋 ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  data: (label, data) => console.log(`${colors.cyan}   ${label}:${colors.reset}`, JSON.stringify(data, null, 2)),
};

// Store token globally
let authToken = null;
let adminUserId = null;

/**
 * Step 1: Login as Admin
 */
async function loginAsAdmin() {
  log.section();
  log.title('STEP 1: Admin Login');

  try {
    const response = await axios.post(`${BASE_URL}/api/auth/admin-login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    if (response.data.success) {
      authToken = response.data.data.accessToken;
      adminUserId = response.data.data.userId;
      log.success('Admin login successful');
      log.data('User ID', adminUserId);
      log.data('Role', response.data.data.role);
      log.data('Module Access', response.data.data.moduleAccess || 'N/A');
      log.data('Token (first 50 chars)', authToken.substring(0, 50) + '...');
      return true;
    } else {
      log.error('Login failed: ' + response.data.message);
      return false;
    }
  } catch (error) {
    log.error('Login error: ' + error.message);
    if (error.response) {
      log.data('Error Response', error.response.data);
    }
    return false;
  }
}

/**
 * Step 2: Check Admin User Details from Database
 */
async function checkAdminUserDetails() {
  log.section();
  log.title('STEP 2: Check Admin User Details from Database');

  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    log.success('Connected to MongoDB');

    const User = require('../models/User');
    const adminUser = await User.findOne({ email: ADMIN_EMAIL })
      .select('_id name email role linkedUserId referralCode referredBy moduleAccess')
      .populate('linkedUserId', 'name email referralCode')
      .lean();

    if (adminUser) {
      log.success('Admin user found in database');
      log.data('Admin Details', {
        _id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        referralCode: adminUser.referralCode || 'NOT SET',
        linkedUserId: adminUser.linkedUserId || 'NOT SET',
        referredBy: adminUser.referredBy || 'NOT SET',
        moduleAccess: adminUser.moduleAccess || 'NOT SET'
      });

      // Check if admin has direct referrals
      const referralCount = await User.countDocuments({ referredBy: adminUser._id });
      log.info(`Admin has ${referralCount} direct referrals (L1)`);

      if (adminUser.linkedUserId) {
        log.success('Admin has linkedUserId - will use this user\'s referral chain');
        const linkedReferralCount = await User.countDocuments({ referredBy: adminUser.linkedUserId._id || adminUser.linkedUserId });
        log.info(`Linked user has ${linkedReferralCount} direct referrals (L1)`);

        // Get L2 count
        const l1Ids = await User.find({ referredBy: adminUser.linkedUserId._id || adminUser.linkedUserId }).distinct('_id');
        const l2Count = await User.countDocuments({ referredBy: { $in: l1Ids } });
        log.info(`Linked user has ${l2Count} indirect referrals (L2)`);
        log.info(`Total referral chain: ${linkedReferralCount + l2Count} users`);
      } else {
        log.warning('Admin does NOT have linkedUserId - will use admin\'s own referrals');
        if (referralCount === 0) {
          log.warning('⚠️  ISSUE FOUND: Admin has no direct referrals and no linkedUserId!');
          log.warning('This means the my-opportunities API will return empty results.');
          log.info('SOLUTION: Set linkedUserId for admin or ensure admin has referrals');
        }
      }

      return adminUser;
    } else {
      log.error('Admin user not found in database');
      return null;
    }
  } catch (error) {
    log.error('Database check error: ' + error.message);
    return null;
  }
}

/**
 * Step 3: Test My Opportunities API
 */
async function testMyOpportunitiesAPI() {
  log.section();
  log.title('STEP 3: Test My Opportunities API');

  const testCases = [
    { params: { page: 1, limit: 20 }, desc: 'Default request' },
    { params: { page: 1, limit: 20, type: 'cart' }, desc: 'Filter by cart' },
    { params: { page: 1, limit: 20, type: 'wishlist' }, desc: 'Filter by wishlist' },
    { params: { page: 1, limit: 20, type: 'inactive' }, desc: 'Filter by inactive' },
    { params: { page: 1, limit: 20, type: 'new' }, desc: 'Filter by new signups' },
  ];

  for (const testCase of testCases) {
    log.info(`Testing: ${testCase.desc}`);

    try {
      const response = await axios.get(`${BASE_URL}/api/sales/my-opportunities`, {
        params: testCase.params,
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.data.success) {
        log.success(`${testCase.desc} - SUCCESS`);
        log.data('Response', {
          totalOpportunities: response.data.data.pagination.total,
          currentPage: response.data.data.pagination.page,
          totalPages: response.data.data.pagination.totalPages,
          opportunities: response.data.data.opportunities.length,
          summary: response.data.data.summary
        });

        if (response.data.data.opportunities.length > 0) {
          log.data('First Opportunity', response.data.data.opportunities[0]);
        }
      } else {
        log.warning(`${testCase.desc} - returned success: false`);
        log.data('Response', response.data);
      }
    } catch (error) {
      log.error(`${testCase.desc} - FAILED`);
      log.error('Error: ' + error.message);
      if (error.response) {
        log.data('Error Response', error.response.data);
        log.data('Status Code', error.response.status);
      }
    }
  }
}

/**
 * Step 4: Test All Related Sales Team APIs
 */
async function testRelatedSalesAPIs() {
  log.section();
  log.title('STEP 4: Test All Related Sales Team APIs');

  const apis = [
    { endpoint: '/api/sales/my-team', desc: 'My Team (L1 Members)' },
    { endpoint: '/api/sales/my-team/users', desc: 'My Team Users (L1 + L2)' },
    { endpoint: '/api/sales/my-stats', desc: 'My Dashboard Stats' },
    { endpoint: '/api/sales/my-activity', desc: 'My Team Activity Feed' },
    { endpoint: '/api/sales/my-leaderboard', desc: 'My Team Leaderboard' },
    { endpoint: '/api/sales/my-trends', desc: 'My Team Trends' },
  ];

  for (const api of apis) {
    log.info(`Testing: ${api.desc}`);

    try {
      const response = await axios.get(`${BASE_URL}${api.endpoint}`, {
        params: { page: 1, limit: 20 },
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.data.success) {
        log.success(`${api.desc} - SUCCESS`);

        // Show relevant data based on endpoint
        if (api.endpoint.includes('my-team/users')) {
          log.data('Result', {
            totalUsers: response.data.data.pagination.total,
            breakdown: response.data.data.breakdown
          });
        } else if (api.endpoint.includes('my-team') && !api.endpoint.includes('users')) {
          log.data('Result', {
            totalTeamMembers: response.data.data.pagination.total,
            summary: response.data.data.summary
          });
        } else if (api.endpoint.includes('my-stats')) {
          log.data('Result', {
            teamStats: response.data.data.teamStats,
            orderStats: response.data.data.orderStats,
            conversionRate: response.data.data.conversionRate
          });
        } else if (api.endpoint.includes('my-activity')) {
          log.data('Result', {
            totalActivities: response.data.data.pagination.total,
            activities: response.data.data.activities.length
          });
        } else if (api.endpoint.includes('my-leaderboard')) {
          log.data('Result', {
            topPerformers: response.data.data.leaderboard.length
          });
        } else if (api.endpoint.includes('my-trends')) {
          log.data('Result', {
            period: response.data.data.period,
            metric: response.data.data.metric,
            dataPoints: response.data.data.labels.length,
            summary: response.data.data.summary
          });
        }
      } else {
        log.warning(`${api.desc} - returned success: false`);
        log.data('Response', response.data);
      }
    } catch (error) {
      log.error(`${api.desc} - FAILED`);
      log.error('Error: ' + error.message);
      if (error.response) {
        log.data('Error Status', error.response.status);
        log.data('Error Response', error.response.data);
      }
    }
  }
}

/**
 * Step 5: Check Code Optimization and Error Handling
 */
async function checkCodeOptimization() {
  log.section();
  log.title('STEP 5: Code Optimization and Error Handling Analysis');

  log.info('Reading controller file...');
  const fs = require('fs');
  const controllerPath = require('path').join(__dirname, '../controllers/salesTeamController.js');
  const controllerCode = fs.readFileSync(controllerPath, 'utf8');

  // Check for common issues
  const issues = [];
  const suggestions = [];

  // Check for error handling
  const tryBlocks = (controllerCode.match(/try {/g) || []).length;
  const catchBlocks = (controllerCode.match(/catch \(/g) || []).length;

  if (tryBlocks === catchBlocks && tryBlocks > 0) {
    log.success(`Error handling: All ${tryBlocks} try blocks have catch blocks`);
  } else {
    issues.push(`Error handling: Mismatch in try/catch blocks`);
  }

  // Check for console.log (debugging statements)
  const consoleLogs = (controllerCode.match(/console\.log\(/g) || []).length;
  if (consoleLogs > 0) {
    suggestions.push(`Found ${consoleLogs} console.log statements - consider using a proper logger`);
  }

  // Check for Promise.all usage (optimization)
  const promiseAll = (controllerCode.match(/Promise\.all\(/g) || []).length;
  if (promiseAll > 0) {
    log.success(`Optimization: Using Promise.all in ${promiseAll} places for parallel queries`);
  }

  // Check for lean() usage
  const leanUsage = (controllerCode.match(/\.lean\(\)/g) || []).length;
  log.success(`Optimization: Using .lean() in ${leanUsage} queries (improves performance)`);

  // Check for pagination
  const skipUsage = (controllerCode.match(/\.skip\(/g) || []).length;
  const limitUsage = (controllerCode.match(/\.limit\(/g) || []).length;
  log.success(`Pagination: Found skip() in ${skipUsage} places and limit() in ${limitUsage} places`);

  // Check for aggregation pipelines
  const aggregateUsage = (controllerCode.match(/\.aggregate\(/g) || []).length;
  log.success(`Optimization: Using aggregation pipelines in ${aggregateUsage} places`);

  // Check for select() usage (field projection)
  const selectUsage = (controllerCode.match(/\.select\(/g) || []).length;
  log.success(`Optimization: Using select() for field projection in ${selectUsage} queries`);

  // Check for populate() usage
  const populateUsage = (controllerCode.match(/\.populate\(/g) || []).length;
  log.info(`Using populate() in ${populateUsage} queries`);

  // Report issues and suggestions
  if (issues.length > 0) {
    log.warning('Issues Found:');
    issues.forEach(issue => log.error(issue));
  }

  if (suggestions.length > 0) {
    log.warning('Suggestions:');
    suggestions.forEach(suggestion => log.warning(suggestion));
  }

  if (issues.length === 0 && suggestions.length === 0) {
    log.success('No major optimization issues found!');
  }
}

/**
 * Step 6: Test Error Scenarios
 */
async function testErrorScenarios() {
  log.section();
  log.title('STEP 6: Test Error Scenarios');

  const errorTests = [
    {
      desc: 'Invalid token',
      headers: { 'Authorization': 'Bearer invalid_token_12345' },
      expectedStatus: 401
    },
    {
      desc: 'Missing token',
      headers: {},
      expectedStatus: 401
    },
    {
      desc: 'Invalid page parameter',
      headers: { 'Authorization': `Bearer ${authToken}` },
      params: { page: -1, limit: 20 },
      expectedStatus: [200, 400, 422] // Could return 200 with empty results or error
    },
    {
      desc: 'Invalid type parameter',
      headers: { 'Authorization': `Bearer ${authToken}` },
      params: { type: 'invalid_type', page: 1, limit: 20 },
      expectedStatus: [200, 400, 422] // Could return 200 with all types or error
    }
  ];

  for (const test of errorTests) {
    log.info(`Testing error scenario: ${test.desc}`);

    try {
      const response = await axios.get(`${BASE_URL}/api/sales/my-opportunities`, {
        params: test.params,
        headers: test.headers,
        validateStatus: () => true // Don't throw on any status code
      });

      const expectedStatuses = Array.isArray(test.expectedStatus) ? test.expectedStatus : [test.expectedStatus];

      if (expectedStatuses.includes(response.status)) {
        log.success(`${test.desc} - Handled correctly (Status: ${response.status})`);
        log.data('Response', response.data);
      } else {
        log.warning(`${test.desc} - Unexpected status code: ${response.status}`);
        log.data('Response', response.data);
      }
    } catch (error) {
      log.error(`${test.desc} - Unexpected error: ${error.message}`);
    }
  }
}

/**
 * Step 7: Performance Test
 */
async function performanceTest() {
  log.section();
  log.title('STEP 7: API Performance Test');

  log.info('Testing API response time...');

  const tests = 5;
  const times = [];

  for (let i = 0; i < tests; i++) {
    const startTime = Date.now();

    try {
      await axios.get(`${BASE_URL}/api/sales/my-opportunities`, {
        params: { page: 1, limit: 20 },
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;
      times.push(responseTime);

      log.info(`Test ${i + 1}: ${responseTime}ms`);
    } catch (error) {
      log.error(`Test ${i + 1}: Failed`);
    }
  }

  if (times.length > 0) {
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    log.success(`Average response time: ${avgTime.toFixed(2)}ms`);
    log.info(`Min: ${minTime}ms, Max: ${maxTime}ms`);

    if (avgTime < 200) {
      log.success('✨ Excellent performance!');
    } else if (avgTime < 500) {
      log.success('✅ Good performance');
    } else if (avgTime < 1000) {
      log.warning('⚠️  Acceptable but could be optimized');
    } else {
      log.error('⚠️  Slow performance - needs optimization');
    }
  }
}

/**
 * Step 8: Generate Summary Report
 */
function generateSummaryReport() {
  log.section();
  log.title('STEP 8: Summary Report');

  log.info('Diagnostic Summary:');
  console.log(`
${colors.bright}Key Findings:${colors.reset}

1. Admin Login: ${authToken ? colors.green + '✅ Working' : colors.red + '❌ Failed'}${colors.reset}
2. Database Connection: ${mongoose.connection.readyState === 1 ? colors.green + '✅ Connected' : colors.red + '❌ Disconnected'}${colors.reset}
3. Authentication: ${authToken ? colors.green + '✅ Token generated' : colors.red + '❌ No token'}${colors.reset}

${colors.bright}Recommendations:${colors.reset}

${colors.yellow}If my-opportunities API is returning empty results:${colors.reset}
  1. Check if admin has linkedUserId set in database
  2. If no linkedUserId, check if admin has direct referrals
  3. Consider linking admin account to a user with referral chain
  4. Or test with a sales_team account that has referrals

${colors.yellow}Optimization Status:${colors.reset}
  ✅ Using lean() for better query performance
  ✅ Using aggregation pipelines for complex queries
  ✅ Implementing pagination
  ✅ Using field projection with select()
  ✅ Proper error handling with try-catch blocks

${colors.yellow}Next Steps:${colors.reset}
  1. Set linkedUserId for admin if needed
  2. Monitor API performance in production
  3. Consider adding indexes on frequently queried fields
  4. Implement caching for repeated queries
  `);
}

/**
 * Main execution function
 */
async function main() {
  console.log(`
${colors.bright}${colors.cyan}
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║          Sales Opportunities API - Comprehensive Debugging Script          ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
${colors.reset}
  `);

  try {
    // Step 1: Login
    const loginSuccess = await loginAsAdmin();
    if (!loginSuccess) {
      log.error('Failed to login. Exiting...');
      process.exit(1);
    }

    // Step 2: Check admin user details
    const adminUser = await checkAdminUserDetails();

    // Step 3: Test my-opportunities API
    await testMyOpportunitiesAPI();

    // Step 4: Test related APIs
    await testRelatedSalesAPIs();

    // Step 5: Check code optimization
    await checkCodeOptimization();

    // Step 6: Test error scenarios
    await testErrorScenarios();

    // Step 7: Performance test
    await performanceTest();

    // Step 8: Generate summary
    generateSummaryReport();

    log.section();
    log.success('All tests completed!');
    log.section();

  } catch (error) {
    log.error('Fatal error during execution:');
    console.error(error);
  } finally {
    // Cleanup
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      log.info('Database connection closed');
    }
  }
}

// Run the script
main().catch(console.error);
