/**
 * Notification Scheduler Cron Job
 * Automatically publishes scheduled notifications at the scheduled time
 *
 * Runs every minute to check for scheduled posts that need to be published
 */

const cron = require('node-cron');
const Notification = require('../models/Notification');
const { sendPushToAllUsers } = require('../services/fcmService');
const { buildPushData } = require('../utils/notificationHelpers');

/**
 * Process scheduled notifications
 * Checks for notifications with status=SCHEDULED and scheduledAt <= now
 */
async function processScheduledNotifications() {
  try {
    const now = new Date();

    // Find all scheduled notifications that are due
    const dueNotifications = await Notification.find({
      status: 'SCHEDULED',
      scheduledAt: { $lte: now },
      isDeleted: false
    });

    if (dueNotifications.length === 0) {
      return;
    }

    console.log(`[Notification Cron] Found ${dueNotifications.length} scheduled notification(s) to publish`);

    // Process each notification
    for (const notification of dueNotifications) {
      try {
        // Update status to PUBLISHED
        notification.status = 'PUBLISHED';
        notification.publishedAt = new Date();

        // Send push notifications if enabled
        if (notification.sendPush || notification.sendPushOnly) {
          const pushData = buildPushData(notification);

          const result = await sendPushToAllUsers({
            title: notification.title,
            body: notification.body,
            data: pushData
          });

          // Update push stats
          notification.pushStats = {
            sent: result.sent || 0,
            failed: result.failed || 0,
            sentAt: new Date()
          };

          console.log(`[Notification Cron] Push sent for ${notification.notificationId}: ${result.sent} sent, ${result.failed} failed`);
        }

        await notification.save();

        console.log(`[Notification Cron] ✅ Published scheduled notification: ${notification.notificationId}`);

      } catch (error) {
        console.error(`[Notification Cron] ❌ Error publishing notification ${notification.notificationId}:`, error);
        // Continue with other notifications even if one fails
      }
    }

  } catch (error) {
    console.error('[Notification Cron] Error processing scheduled notifications:', error);
  }
}

/**
 * Start the cron job
 * Runs every minute: '* * * * *'
 * Format: minute hour day month weekday
 */
function startNotificationCron() {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    await processScheduledNotifications();
  });

  console.log('✅ Notification scheduler cron job started (runs every minute)');
}

module.exports = {
  startNotificationCron,
  processScheduledNotifications
};
