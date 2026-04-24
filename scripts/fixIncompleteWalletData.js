const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'https://api.epielio.com/api';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

// Helper function to save backup
function saveBackup(data, filename) {
  const backupDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const filepath = path.join(backupDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  return filepath;
}

async function fixIncompleteWalletData() {
  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('   FIX INCOMPLETE WALLET DATA - FIND USERS WITH MISSING FIELDS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Step 1: Login as admin
    console.log('🔐 Step 1: Logging in as admin...');
    const loginResponse = await axios.post(`${API_URL}/admin-auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    if (!loginResponse.data.success) {
      console.error('❌ Login failed:', loginResponse.data.message);
      return;
    }

    const token = loginResponse.data.data.accessToken;
    console.log('✅ Login successful!\n');

    // Step 2: Fetch all users
    console.log('📥 Step 2: Fetching all users from database...');
    const usersResponse = await axios.get(`${API_URL}/users/`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const allUsers = usersResponse.data;
    console.log(`✅ Total users in database: ${allUsers.length}\n`);

    // Step 3: Analyze wallet data completeness
    console.log('🔍 Step 3: Analyzing wallet data for all users...\n');

    const requiredWalletFields = [
      'balance',
      'holdBalance',
      'referralBonus',
      'investedAmount',
      'requiredInvestment',
      'commissionEarned',
      'commissionUsedInApp'
    ];

    const issues = {
      noWallet: [],
      missingFields: [],
      missingCommissionEarned: [],
      missingCommissionUsedInApp: [],
      missingMultipleFields: [],
      complete: []
    };

    allUsers.forEach(user => {
      // Check if wallet exists
      if (!user.wallet) {
        issues.noWallet.push({
          _id: user._id,
          name: user.name,
          email: user.email,
          issue: 'No wallet object'
        });
        return;
      }

      const missingFields = [];

      // Check each required field
      requiredWalletFields.forEach(field => {
        if (user.wallet[field] === undefined || user.wallet[field] === null) {
          missingFields.push(field);
        }
      });

      if (missingFields.length > 0) {
        const userIssue = {
          _id: user._id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          createdAt: user.createdAt,
          missingFields: missingFields,
          currentWallet: user.wallet
        };

        issues.missingFields.push(userIssue);

        // Track specific missing fields
        if (missingFields.includes('commissionEarned')) {
          issues.missingCommissionEarned.push(userIssue);
        }
        if (missingFields.includes('commissionUsedInApp')) {
          issues.missingCommissionUsedInApp.push(userIssue);
        }
        if (missingFields.length > 1) {
          issues.missingMultipleFields.push(userIssue);
        }
      } else {
        issues.complete.push({
          _id: user._id,
          name: user.name,
          email: user.email
        });
      }
    });

    // Step 4: Display analysis results
    console.log('📊 WALLET DATA ANALYSIS RESULTS:\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Total Users: ${allUsers.length}`);
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`✅ Users with complete wallet data: ${issues.complete.length}`);
    console.log(`❌ Users with incomplete wallet data: ${issues.missingFields.length}`);
    console.log(`   └─ Users missing wallet object: ${issues.noWallet.length}`);
    console.log(`   └─ Users missing commissionEarned: ${issues.missingCommissionEarned.length}`);
    console.log(`   └─ Users missing commissionUsedInApp: ${issues.missingCommissionUsedInApp.length}`);
    console.log(`   └─ Users missing multiple fields: ${issues.missingMultipleFields.length}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Step 5: Show detailed breakdown
    if (issues.noWallet.length > 0) {
      console.log(`\n🚨 USERS WITHOUT WALLET OBJECT (${issues.noWallet.length}):`);
      console.log('─'.repeat(100));
      issues.noWallet.slice(0, 10).forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email})`);
        console.log(`   User ID: ${user._id}`);
      });
      if (issues.noWallet.length > 10) {
        console.log(`   ... and ${issues.noWallet.length - 10} more\n`);
      }
    }

    if (issues.missingFields.length > 0) {
      console.log(`\n⚠️  USERS WITH MISSING WALLET FIELDS (${issues.missingFields.length}):`);
      console.log('─'.repeat(100));

      // Group by missing fields
      const fieldGroups = {};
      issues.missingFields.forEach(user => {
        const key = user.missingFields.sort().join(', ');
        if (!fieldGroups[key]) {
          fieldGroups[key] = [];
        }
        fieldGroups[key].push(user);
      });

      Object.entries(fieldGroups).forEach(([fields, users]) => {
        console.log(`\nMissing: ${fields} (${users.length} users)`);
        users.slice(0, 5).forEach((user, index) => {
          console.log(`  ${index + 1}. ${user.name} (${user.email})`);
          console.log(`     User ID: ${user._id}`);
          console.log(`     Registered: ${new Date(user.createdAt).toLocaleDateString()}`);
        });
        if (users.length > 5) {
          console.log(`     ... and ${users.length - 5} more`);
        }
      });
    }

    // Step 6: Create backup
    if (issues.missingFields.length > 0 || issues.noWallet.length > 0) {
      console.log('\n\n💾 Step 4: Creating backup of users with incomplete wallet data...');
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const backupFilename = `backup-incomplete-wallet-users-${timestamp}.json`;

      const backupData = {
        timestamp: new Date().toISOString(),
        totalUsers: allUsers.length,
        usersWithIssues: issues.missingFields.length + issues.noWallet.length,
        analysis: {
          noWallet: issues.noWallet.length,
          missingCommissionEarned: issues.missingCommissionEarned.length,
          missingCommissionUsedInApp: issues.missingCommissionUsedInApp.length,
          missingMultipleFields: issues.missingMultipleFields.length
        },
        usersWithNoWallet: issues.noWallet,
        usersWithMissingFields: issues.missingFields
      };

      const backupPath = saveBackup(backupData, backupFilename);
      console.log(`✅ Backup saved to: ${backupPath}\n`);

      // Step 7: Export CSV
      console.log('📄 CSV Export of Users with Issues:\n');
      console.log('User ID,Name,Email,Phone,Registered,Missing Fields');

      [...issues.noWallet, ...issues.missingFields].forEach(user => {
        const missingFields = user.issue || user.missingFields?.join(';') || '';
        const phone = user.phoneNumber || 'N/A';
        const regDate = user.createdAt ? new Date(user.createdAt).toISOString() : 'N/A';
        console.log(`"${user._id}","${user.name}","${user.email}","${phone}","${regDate}","${missingFields}"`);
      });

      console.log('\n\n🔧 RECOMMENDATION:');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('You need to run a database migration to add missing wallet fields.');
      console.log('This will prevent the white screen issue in the mobile app.');
      console.log('\nMissing fields should be set to default values:');
      console.log('  - commissionEarned: 0');
      console.log('  - commissionUsedInApp: 0');
      console.log('  - Other wallet fields: 0');
      console.log('═══════════════════════════════════════════════════════════════\n');

      // Save summary
      const summaryFilename = `wallet-analysis-summary-${timestamp}.txt`;
      const summaryPath = path.join(__dirname, 'backups', summaryFilename);
      const summaryContent = `
WALLET DATA ANALYSIS SUMMARY
Generated: ${new Date().toISOString()}

Total Users: ${allUsers.length}
Users with Complete Wallet: ${issues.complete.length}
Users with Incomplete Wallet: ${issues.missingFields.length + issues.noWallet.length}

BREAKDOWN:
- Users without wallet object: ${issues.noWallet.length}
- Users missing commissionEarned: ${issues.missingCommissionEarned.length}
- Users missing commissionUsedInApp: ${issues.missingCommissionUsedInApp.length}
- Users missing multiple fields: ${issues.missingMultipleFields.length}

RECOMMENDATION:
Run a database migration script to add missing wallet fields with default values.
This will fix the white screen issue in the mobile app.

Backup file: ${backupFilename}
`;

      fs.writeFileSync(summaryPath, summaryContent);
      console.log(`📝 Summary saved to: ${summaryPath}\n`);

    } else {
      console.log('\n✅ All users have complete wallet data!');
      console.log('No migration needed.\n');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the analysis
fixIncompleteWalletData();
