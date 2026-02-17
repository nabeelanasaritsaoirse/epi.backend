/**
 * Account Deletion Cron Job
 *
 * Processes approved deletion requests whose 30-day grace period has passed.
 * Runs daily at midnight IST (18:30 UTC).
 */

const cron = require('node-cron');
const User = require('../models/User');
const { hardDeleteUserAccount } = require('../services/accountDeletionService');

// Midnight IST = 18:30 UTC
const CRON_SCHEDULE = '30 18 * * *';

/**
 * Find and process all approved deletion requests past their scheduled date.
 */
async function processScheduledDeletions() {
  try {
    const now = new Date();

    const usersToDelete = await User.find({
      'deletionRequest.status': 'approved',
      'deletionRequest.scheduledDeletionDate': { $lte: now }
    }).select('_id email deletionRequest');

    if (usersToDelete.length === 0) {
      return;
    }

    console.log(`[AccountDeletion Cron] Found ${usersToDelete.length} account(s) scheduled for deletion`);

    for (const user of usersToDelete) {
      try {
        console.log(`[AccountDeletion Cron] Deleting account: ${user.email} (${user._id})`);
        const result = await hardDeleteUserAccount(user._id);
        console.log(`[AccountDeletion Cron] Successfully deleted: ${user.email}`, result);
      } catch (error) {
        console.error(`[AccountDeletion Cron] Failed to delete user ${user._id} (${user.email}):`, error);
      }
    }
  } catch (error) {
    console.error('[AccountDeletion Cron] Critical error:', error);
  }
}

/**
 * Start the account deletion cron job.
 */
function startAccountDeletionCron() {
  cron.schedule(CRON_SCHEDULE, async () => {
    console.log('[AccountDeletion Cron] Running scheduled deletion check...');
    await processScheduledDeletions();
  });

  console.log('[AccountDeletion Cron] Started (runs daily at midnight IST)');
}

module.exports = {
  startAccountDeletionCron,
  processScheduledDeletions
};
