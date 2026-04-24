const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'https://api.epielio.com/api';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

function saveReport(data, filename) {
  const backupDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const filepath = path.join(backupDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  return filepath;
}

async function findWalletDataAnomalies() {
  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('   FIND WALLET DATA ANOMALIES - DETECT PROBLEMATIC DATA');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Login
    console.log('🔐 Logging in as admin...');
    const loginResponse = await axios.post(`${API_URL}/admin-auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    const token = loginResponse.data.data.accessToken;
    console.log('✅ Login successful!\n');

    // Fetch users
    console.log('📥 Fetching all users...');
    const usersResponse = await axios.get(`${API_URL}/users/`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const allUsers = usersResponse.data;
    console.log(`✅ Total users: ${allUsers.length}\n`);

    console.log('🔍 Analyzing wallet data for anomalies...\n');

    const anomalies = {
      nullBalance: [],
      negativeBalance: [],
      nullCommissionFields: [],
      inconsistentData: [],
      missingTransactions: [],
      NaNValues: [],
      extremeValues: [],
      clean: []
    };

    allUsers.forEach(user => {
      const issues = [];
      const wallet = user.wallet || {};

      // Check for null/undefined balance
      if (wallet.balance === null || wallet.balance === undefined) {
        anomalies.nullBalance.push({
          userId: user._id,
          name: user.name,
          email: user.email,
          wallet: wallet
        });
        issues.push('null_balance');
      }

      // Check for negative balance
      if (wallet.balance < 0) {
        anomalies.negativeBalance.push({
          userId: user._id,
          name: user.name,
          email: user.email,
          balance: wallet.balance
        });
        issues.push('negative_balance');
      }

      // Check for null commission fields
      if (wallet.commissionEarned === null || wallet.commissionEarned === undefined ||
          wallet.commissionUsedInApp === null || wallet.commissionUsedInApp === undefined) {
        anomalies.nullCommissionFields.push({
          userId: user._id,
          name: user.name,
          email: user.email,
          commissionEarned: wallet.commissionEarned,
          commissionUsedInApp: wallet.commissionUsedInApp
        });
        issues.push('null_commission');
      }

      // Check for NaN values
      const numericFields = ['balance', 'holdBalance', 'referralBonus', 'investedAmount',
                            'requiredInvestment', 'commissionEarned', 'commissionUsedInApp'];
      numericFields.forEach(field => {
        if (wallet[field] !== undefined && wallet[field] !== null && isNaN(wallet[field])) {
          anomalies.NaNValues.push({
            userId: user._id,
            name: user.name,
            email: user.email,
            field: field,
            value: wallet[field]
          });
          issues.push(`nan_${field}`);
        }
      });

      // Check for extreme values (possible corruption)
      if (wallet.balance > 1000000) { // More than 1 million
        anomalies.extremeValues.push({
          userId: user._id,
          name: user.name,
          email: user.email,
          field: 'balance',
          value: wallet.balance
        });
        issues.push('extreme_balance');
      }

      // Check for inconsistent data
      if (wallet.commissionEarned > 0 && wallet.commissionUsedInApp > wallet.commissionEarned) {
        anomalies.inconsistentData.push({
          userId: user._id,
          name: user.name,
          email: user.email,
          issue: 'commissionUsedInApp > commissionEarned',
          commissionEarned: wallet.commissionEarned,
          commissionUsedInApp: wallet.commissionUsedInApp
        });
        issues.push('inconsistent_commission');
      }

      // Check totalBalance vs other fields
      if (user.totalBalance !== undefined && user.totalBalance !== null) {
        // totalBalance should match wallet.balance (approximately)
        const diff = Math.abs(user.totalBalance - (wallet.balance || 0));
        if (diff > 1) { // Allow 1 rupee difference for rounding
          anomalies.inconsistentData.push({
            userId: user._id,
            name: user.name,
            email: user.email,
            issue: 'totalBalance mismatch',
            totalBalance: user.totalBalance,
            walletBalance: wallet.balance,
            difference: diff
          });
          issues.push('balance_mismatch');
        }
      }

      if (issues.length === 0) {
        anomalies.clean.push(user._id);
      }
    });

    // Display results
    console.log('📊 ANOMALY DETECTION RESULTS:\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Total Users Analyzed: ${allUsers.length}`);
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`✅ Clean wallet data: ${anomalies.clean.length}`);
    console.log(`❌ Users with anomalies: ${allUsers.length - anomalies.clean.length}`);
    console.log('');
    console.log('ANOMALY BREAKDOWN:');
    console.log(`  - Null balance: ${anomalies.nullBalance.length}`);
    console.log(`  - Negative balance: ${anomalies.negativeBalance.length}`);
    console.log(`  - Null commission fields: ${anomalies.nullCommissionFields.length}`);
    console.log(`  - NaN values: ${anomalies.NaNValues.length}`);
    console.log(`  - Extreme values (>1M): ${anomalies.extremeValues.length}`);
    console.log(`  - Inconsistent data: ${anomalies.inconsistentData.length}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Show detailed issues
    if (anomalies.nullBalance.length > 0) {
      console.log(`\n🚨 USERS WITH NULL BALANCE (${anomalies.nullBalance.length}):`);
      console.log('─'.repeat(100));
      anomalies.nullBalance.slice(0, 10).forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email})`);
        console.log(`   User ID: ${user.userId}`);
        console.log(`   Wallet: ${JSON.stringify(user.wallet)}`);
      });
      if (anomalies.nullBalance.length > 10) {
        console.log(`   ... and ${anomalies.nullBalance.length - 10} more`);
      }
    }

    if (anomalies.negativeBalance.length > 0) {
      console.log(`\n⚠️  USERS WITH NEGATIVE BALANCE (${anomalies.negativeBalance.length}):`);
      console.log('─'.repeat(100));
      anomalies.negativeBalance.slice(0, 10).forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email})`);
        console.log(`   Balance: ₹${user.balance}`);
      });
    }

    if (anomalies.nullCommissionFields.length > 0) {
      console.log(`\n⚠️  USERS WITH NULL COMMISSION FIELDS (${anomalies.nullCommissionFields.length}):`);
      console.log('─'.repeat(100));
      anomalies.nullCommissionFields.slice(0, 10).forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email})`);
        console.log(`   commissionEarned: ${user.commissionEarned}`);
        console.log(`   commissionUsedInApp: ${user.commissionUsedInApp}`);
      });
    }

    if (anomalies.NaNValues.length > 0) {
      console.log(`\n🚨 USERS WITH NaN VALUES (${anomalies.NaNValues.length}):`);
      console.log('─'.repeat(100));
      anomalies.NaNValues.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email})`);
        console.log(`   Field: ${user.field}, Value: ${user.value}`);
      });
    }

    if (anomalies.inconsistentData.length > 0) {
      console.log(`\n⚠️  USERS WITH INCONSISTENT DATA (${anomalies.inconsistentData.length}):`);
      console.log('─'.repeat(100));
      anomalies.inconsistentData.slice(0, 10).forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email})`);
        console.log(`   Issue: ${user.issue}`);
        if (user.commissionEarned !== undefined) {
          console.log(`   Earned: ${user.commissionEarned}, Used: ${user.commissionUsedInApp}`);
        }
        if (user.difference !== undefined) {
          console.log(`   Total: ${user.totalBalance}, Wallet: ${user.walletBalance}, Diff: ${user.difference}`);
        }
      });
    }

    // Save report
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const reportPath = saveReport({
      timestamp: new Date().toISOString(),
      totalUsers: allUsers.length,
      cleanUsers: anomalies.clean.length,
      usersWithAnomalies: allUsers.length - anomalies.clean.length,
      anomalies: {
        nullBalance: anomalies.nullBalance,
        negativeBalance: anomalies.negativeBalance,
        nullCommissionFields: anomalies.nullCommissionFields,
        NaNValues: anomalies.NaNValues,
        extremeValues: anomalies.extremeValues,
        inconsistentData: anomalies.inconsistentData
      }
    }, `wallet-anomalies-report-${timestamp}.json`);

    console.log(`\n\n📄 Detailed report saved to: ${reportPath}\n`);

    // Recommendations
    console.log('💡 RECOMMENDATIONS:\n');
    if (anomalies.nullBalance.length > 0 || anomalies.nullCommissionFields.length > 0) {
      console.log('🔧 Create a migration script to set null values to 0');
    }
    if (anomalies.NaNValues.length > 0) {
      console.log('🚨 CRITICAL: Fix NaN values immediately - these will cause app crashes!');
    }
    if (anomalies.inconsistentData.length > 0) {
      console.log('⚠️  Review inconsistent data and run wallet recalculation');
    }
    if (allUsers.length === anomalies.clean.length) {
      console.log('✅ No anomalies found! The white screen issue might be:');
      console.log('   - Frontend parsing issue');
      console.log('   - Network timeout');
      console.log('   - App version incompatibility');
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

findWalletDataAnomalies();
