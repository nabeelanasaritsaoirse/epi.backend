const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'https://api.epielio.com/api';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

// Configuration
const BATCH_SIZE = 10; // Process 10 users at a time
const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay between batches

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

async function bulkClearFalsePendingDeletions() {
  let token;

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('   BULK CLEAR FALSE PENDING DELETION STATUSES');
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

    token = loginResponse.data.data.accessToken;
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

    // Step 3: Identify users with false pending status
    console.log('🔍 Step 3: Identifying users with false pending deletion status...');

    const usersWithPendingDeletion = allUsers.filter(user => {
      return user.deletionRequest && user.deletionRequest.status === 'pending';
    });

    const usersWithFalsePending = usersWithPendingDeletion.filter(user => {
      return !user.deletionRequest.requestedAt || user.deletionRequest.requestedAt === null;
    });

    const usersWithRealRequests = usersWithPendingDeletion.filter(user => {
      return user.deletionRequest.requestedAt && user.deletionRequest.requestedAt !== null;
    });

    console.log(`\n📊 Analysis:`);
    console.log(`   Total users with pending deletion: ${usersWithPendingDeletion.length}`);
    console.log(`   └─ Users with FALSE pending (no requestedAt): ${usersWithFalsePending.length}`);
    console.log(`   └─ Users with REAL deletion requests: ${usersWithRealRequests.length}\n`);

    if (usersWithFalsePending.length === 0) {
      console.log('✅ No users found with false pending status. Nothing to fix!');
      return;
    }

    // Step 4: Create backup
    console.log('💾 Step 4: Creating backup...');
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const backupFilename = `backup-false-pending-deletions-${timestamp}.json`;

    const backupData = {
      timestamp: new Date().toISOString(),
      totalUsers: usersWithFalsePending.length,
      users: usersWithFalsePending.map(user => ({
        _id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        createdAt: user.createdAt,
        deletionRequest: user.deletionRequest
      }))
    };

    const backupPath = saveBackup(backupData, backupFilename);
    console.log(`✅ Backup saved to: ${backupPath}\n`);

    // Step 5: Ask for confirmation
    console.log('⚠️  READY TO PROCEED:');
    console.log(`   This will clear pending deletion status for ${usersWithFalsePending.length} users`);
    console.log(`   Real deletion requests (${usersWithRealRequests.length} users) will NOT be affected`);
    console.log(`   Backup saved at: ${backupPath}\n`);

    console.log('🚀 Step 5: Starting bulk update...\n');

    // Step 6: Process in batches
    const results = {
      successful: [],
      failed: [],
      skipped: []
    };

    const totalBatches = Math.ceil(usersWithFalsePending.length / BATCH_SIZE);

    for (let i = 0; i < usersWithFalsePending.length; i += BATCH_SIZE) {
      const batch = usersWithFalsePending.slice(i, i + BATCH_SIZE);
      const currentBatch = Math.floor(i / BATCH_SIZE) + 1;
      const progress = ((i / usersWithFalsePending.length) * 100).toFixed(1);

      console.log(`📦 Batch ${currentBatch}/${totalBatches} (${progress}% complete) - Processing ${batch.length} users...`);

      // Process batch in parallel
      const batchPromises = batch.map(async (user) => {
        try {
          const response = await axios.post(
            `${API_URL}/users/admin/${user._id}/cancel-deletion`,
            {},
            {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          );

          if (response.data.success) {
            results.successful.push({
              userId: user._id,
              name: user.name,
              email: user.email
            });
            return { success: true, userId: user._id, name: user.name };
          } else {
            results.failed.push({
              userId: user._id,
              name: user.name,
              email: user.email,
              error: response.data.message
            });
            return { success: false, userId: user._id, error: response.data.message };
          }
        } catch (error) {
          const errorMsg = error.response?.data?.message || error.message;
          results.failed.push({
            userId: user._id,
            name: user.name,
            email: user.email,
            error: errorMsg
          });
          return { success: false, userId: user._id, error: errorMsg };
        }
      });

      await Promise.all(batchPromises);

      // Show batch results
      const batchSuccess = results.successful.length;
      const batchFailed = results.failed.length;
      console.log(`   ✅ Success: ${batchSuccess} | ❌ Failed: ${batchFailed}`);

      // Delay before next batch (except for last batch)
      if (i + BATCH_SIZE < usersWithFalsePending.length) {
        await delay(DELAY_BETWEEN_BATCHES);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('   BULK UPDATE COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Step 7: Final statistics
    console.log('📊 Final Results:');
    console.log(`   ✅ Successfully cleared: ${results.successful.length} users`);
    console.log(`   ❌ Failed: ${results.failed.length} users`);
    console.log(`   ⏭️  Skipped: ${results.skipped.length} users\n`);

    if (results.failed.length > 0) {
      console.log('❌ Failed Users:');
      results.failed.forEach((fail, index) => {
        console.log(`   ${index + 1}. ${fail.name} (${fail.email})`);
        console.log(`      User ID: ${fail.userId}`);
        console.log(`      Error: ${fail.error}\n`);
      });
    }

    // Save results log
    const resultsFilename = `results-clear-pending-${timestamp}.json`;
    const resultsPath = saveBackup({
      timestamp: new Date().toISOString(),
      summary: {
        totalProcessed: usersWithFalsePending.length,
        successful: results.successful.length,
        failed: results.failed.length,
        skipped: results.skipped.length
      },
      realDeletionRequestsKept: usersWithRealRequests.length,
      successful: results.successful,
      failed: results.failed,
      skipped: results.skipped
    }, resultsFilename);

    console.log(`📄 Results log saved to: ${resultsPath}\n`);

    // Verify the changes
    console.log('🔍 Verification: Checking updated database state...');
    const verifyResponse = await axios.get(`${API_URL}/users/`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const updatedUsers = verifyResponse.data;
    const stillPending = updatedUsers.filter(user => {
      return user.deletionRequest && user.deletionRequest.status === 'pending';
    });

    console.log(`\n✅ Verification Results:`);
    console.log(`   Users still with pending deletion: ${stillPending.length}`);
    console.log(`   (These should only be the ${usersWithRealRequests.length} users with real deletion requests)\n`);

    if (stillPending.length === usersWithRealRequests.length) {
      console.log('🎉 SUCCESS! All false pending statuses have been cleared!');
      console.log('   Only legitimate deletion requests remain.\n');
    } else if (stillPending.length < usersWithRealRequests.length) {
      console.log('⚠️  Warning: Some real deletion requests may have been affected.');
      console.log('   Please check the results log for details.\n');
    } else {
      console.log('⚠️  Warning: Some users still have false pending status.');
      console.log(`   Expected: ${usersWithRealRequests.length}, Found: ${stillPending.length}`);
      console.log('   Check the failed list above for details.\n');
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('   OPERATION COMPLETED');
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ CRITICAL ERROR:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run the function
console.log('\n🚀 Starting bulk clear false pending deletions...\n');
bulkClearFalsePendingDeletions();
