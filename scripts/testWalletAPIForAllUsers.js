const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'https://api.epielio.com/api';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

// Test a smaller sample to avoid overwhelming the server
const SAMPLE_SIZE = 50; // Test 50 random users
const DELAY_BETWEEN_REQUESTS = 200; // 200ms delay

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function saveReport(data, filename) {
  const backupDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const filepath = path.join(backupDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  return filepath;
}

async function testWalletAPIForAllUsers() {
  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('   TEST WALLET API FOR USERS - FIND FAILING REQUESTS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Step 1: Login as admin
    console.log('🔐 Step 1: Logging in as admin...');
    const loginResponse = await axios.post(`${API_URL}/admin-auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    const adminToken = loginResponse.data.data.accessToken;
    console.log('✅ Admin login successful!\n');

    // Step 2: Fetch all users
    console.log('📥 Step 2: Fetching all users...');
    const usersResponse = await axios.get(`${API_URL}/users/`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    const allUsers = usersResponse.data;
    console.log(`✅ Total users: ${allUsers.length}\n`);

    // Step 3: Select sample of users (random + recent)
    console.log(`🎲 Step 3: Selecting ${SAMPLE_SIZE} users to test...`);

    // Get recent users (last 25)
    const recentUsers = allUsers
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, Math.floor(SAMPLE_SIZE / 2));

    // Get random users (25)
    const shuffled = [...allUsers].sort(() => 0.5 - Math.random());
    const randomUsers = shuffled.slice(0, Math.floor(SAMPLE_SIZE / 2));

    const testUsers = [...new Set([...recentUsers, ...randomUsers])].slice(0, SAMPLE_SIZE);

    console.log(`✅ Selected ${testUsers.length} users (${recentUsers.length} recent + ${randomUsers.length} random)\n`);

    // Step 4: Test wallet API for each user
    console.log('🧪 Step 4: Testing wallet API for each user...\n');

    const results = {
      successful: [],
      failed: [],
      suspicious: []
    };

    for (let i = 0; i < testUsers.length; i++) {
      const user = testUsers[i];
      const progress = ((i / testUsers.length) * 100).toFixed(1);

      process.stdout.write(`\r📊 Progress: ${progress}% (${i + 1}/${testUsers.length}) - Testing ${user.name.slice(0, 20)}...`);

      try {
        // First, try to login as this user (simulate real user experience)
        // For testing, we'll directly call the wallet API with admin token
        // In production, we'd need user's actual token

        const walletResponse = await axios.get(`${API_URL}/wallet/`, {
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'X-Test-User-Id': user._id // If your API supports this
          }
        });

        // Check response structure
        const wallet = walletResponse.data;

        const hasAllFields = wallet.walletBalance !== undefined &&
                            wallet.commissionEarned !== undefined &&
                            wallet.commissionUsedInApp !== undefined &&
                            wallet.commissionWithdrawable !== undefined;

        if (walletResponse.status === 200 && hasAllFields) {
          results.successful.push({
            userId: user._id,
            name: user.name,
            email: user.email,
            wallet: {
              balance: wallet.walletBalance,
              commissionEarned: wallet.commissionEarned,
              commissionUsedInApp: wallet.commissionUsedInApp,
              commissionWithdrawable: wallet.commissionWithdrawable
            }
          });
        } else {
          results.suspicious.push({
            userId: user._id,
            name: user.name,
            email: user.email,
            reason: 'Missing fields in response',
            response: wallet
          });
        }

      } catch (error) {
        const errorMsg = error.response?.data?.message || error.message;
        const statusCode = error.response?.status;

        results.failed.push({
          userId: user._id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          createdAt: user.createdAt,
          error: errorMsg,
          statusCode: statusCode,
          errorStack: error.response?.data
        });
      }

      await delay(DELAY_BETWEEN_REQUESTS);
    }

    console.log('\n\n═══════════════════════════════════════════════════════════════');
    console.log('   TEST RESULTS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('📊 Summary:');
    console.log(`   ✅ Successful: ${results.successful.length}/${testUsers.length}`);
    console.log(`   ❌ Failed: ${results.failed.length}/${testUsers.length}`);
    console.log(`   ⚠️  Suspicious: ${results.suspicious.length}/${testUsers.length}\n`);

    if (results.failed.length > 0) {
      console.log('❌ FAILED WALLET API CALLS:');
      console.log('─'.repeat(100));
      results.failed.forEach((fail, index) => {
        console.log(`\n${index + 1}. ${fail.name} (${fail.email})`);
        console.log(`   User ID: ${fail.userId}`);
        console.log(`   Phone: ${fail.phoneNumber || 'N/A'}`);
        console.log(`   Registered: ${new Date(fail.createdAt).toLocaleDateString()}`);
        console.log(`   Error: ${fail.error}`);
        console.log(`   Status Code: ${fail.statusCode}`);
      });
      console.log('\n');
    }

    if (results.suspicious.length > 0) {
      console.log('\n⚠️  SUSPICIOUS RESPONSES (missing fields):');
      console.log('─'.repeat(100));
      results.suspicious.forEach((sus, index) => {
        console.log(`\n${index + 1}. ${sus.name} (${sus.email})`);
        console.log(`   Reason: ${sus.reason}`);
        console.log(`   Response keys: ${Object.keys(sus.response).join(', ')}`);
      });
      console.log('\n');
    }

    // Save detailed report
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const reportFilename = `wallet-api-test-report-${timestamp}.json`;
    const reportPath = saveReport({
      timestamp: new Date().toISOString(),
      testSample: testUsers.length,
      totalUsers: allUsers.length,
      summary: {
        successful: results.successful.length,
        failed: results.failed.length,
        suspicious: results.suspicious.length,
        successRate: `${((results.successful.length / testUsers.length) * 100).toFixed(2)}%`
      },
      failedUsers: results.failed,
      suspiciousUsers: results.suspicious,
      successfulSample: results.successful.slice(0, 5) // First 5 successful
    }, reportFilename);

    console.log(`\n📄 Detailed report saved to: ${reportPath}\n`);

    if (results.failed.length === 0 && results.suspicious.length === 0) {
      console.log('🎉 All tested users passed!');
      console.log('The white screen issue might be:');
      console.log('  1. Network-related (users with poor internet)');
      console.log('  2. App version mismatch (old app version)');
      console.log('  3. Device-specific (certain Android/iOS versions)');
      console.log('  4. Happening only for specific user actions\n');
    } else {
      console.log('⚠️  Found issues with wallet API!');
      console.log(`   ${results.failed.length} users have failing wallet API calls`);
      console.log(`   ${results.suspicious.length} users have suspicious responses\n`);
    }

    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testWalletAPIForAllUsers();
