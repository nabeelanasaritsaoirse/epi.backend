/**
 * Firebase Cloud Messaging (FCM) Service
 * Handles push notification delivery to mobile devices
 * FIXED: Compatible with firebase-admin@13.6.0 (removed sendMulticast)
 */

const { admin } = require('../config/firebase');
const User = require('../models/User');

// Check if Firebase is initialized
const firebaseInitialized = admin.apps.length > 0;

/**
 * Send push notification to a single device token
 * @param {string} token - FCM device token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data
 * @returns {Promise<Object>} Result
 */
async function sendToSingleDevice(token, title, body, data = {}) {
  try {
    const message = {
      token, // Single token for send()
      notification: {
        title,
        body: body.substring(0, 100)
      },
      data: {
        ...data,
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        timestamp: Date.now().toString()
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'default'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await admin.messaging().send(message);
    return { success: true, response };

  } catch (error) {
    // Handle invalid token errors
    if (
      error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered'
    ) {
      // Remove invalid token
      await User.updateOne(
        { deviceToken: token },
        { $unset: { deviceToken: 1 } }
      ).catch(err => console.error('[FCM] Error removing token:', err));
      
      return { success: false, invalidToken: true };
    }
    
    console.error('[FCM] Error sending to device:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send push notification to specific user(s)
 * @param {string|Array<string>} userIds - Single user ID or array of user IDs
 * @param {Object} payload - Notification payload
 * @param {string} payload.title - Notification title
 * @param {string} payload.body - Notification body
 * @param {Object} payload.data - Additional data to send with notification
 * @returns {Promise<Object>} Result with success status and counts
 */
async function sendPushNotification(userIds, { title, body, data = {} }) {
  if (!firebaseInitialized) {
    console.warn('[FCM] Firebase not initialized, skipping push notification');
    return {
      success: false,
      reason: 'FCM_NOT_INITIALIZED',
      sent: 0,
      failed: 0
    };
  }

  try {
    // Convert to array if single userId
    const targetUserIds = Array.isArray(userIds) ? userIds : [userIds];

    if (targetUserIds.length === 0) {
      return { success: true, sent: 0, failed: 0 };
    }

    // Get users with valid FCM tokens
    const users = await User.find({
      _id: { $in: targetUserIds },
      deviceToken: { $exists: true, $ne: null, $ne: '' }
    }).select('deviceToken email name notificationPreferences');

    console.log(`[FCM] Found ${users.length} user(s) with deviceToken for userIds:`, targetUserIds);

    if (users.length === 0) {
      console.log('[FCM] No users with valid FCM tokens found');
      return {
        success: true,
        sent: 0,
        failed: 0,
        message: 'No users with valid FCM tokens'
      };
    }

    // Filter users based on notification preferences
    const eligibleUsers = users.filter(u => {
      const pushEnabled = u.notificationPreferences?.pushEnabled;
      return pushEnabled !== false;
    });

    if (eligibleUsers.length === 0) {
      console.log('[FCM] All users have push notifications disabled');
      return {
        success: true,
        sent: 0,
        failed: 0,
        message: 'All users have push notifications disabled'
      };
    }

    const tokens = eligibleUsers.map(u => u.deviceToken).filter(Boolean);

    console.log(`[FCM] Attempting to send push notification to ${tokens.length} device(s)`);

    if (tokens.length === 0) {
      return { success: true, sent: 0, failed: 0 };
    }

    // CRITICAL FIX: Send to each device individually using send() instead of sendMulticast()
    const results = await Promise.allSettled(
      tokens.map(token => sendToSingleDevice(token, title, body, data))
    );

    // Count successes and failures
    let successCount = 0;
    let failureCount = 0;

    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value.success) {
        successCount++;
      } else {
        failureCount++;
      }
    });

    console.log(`[FCM] Push sent: ${successCount}, failed: ${failureCount}`);

    return {
      success: true,
      sent: successCount,
      failed: failureCount,
      totalTargeted: tokens.length
    };

  } catch (error) {
    console.error('[FCM] Error sending push notification:', error);
    return {
      success: false,
      sent: 0,
      failed: 0,
      error: error.message
    };
  }
}

/**
 * Send push notification to all users (batch process for admin broadcasts)
 * @param {Object} payload - Notification payload
 * @param {string} payload.title - Notification title
 * @param {string} payload.body - Notification body
 * @param {Object} payload.data - Additional data
 * @returns {Promise<Object>} Result with success status and counts
 */
async function sendPushToAllUsers({ title, body, data = {} }) {
  if (!firebaseInitialized) {
    console.warn('[FCM] Firebase not initialized, skipping broadcast');
    return {
      success: false,
      reason: 'FCM_NOT_INITIALIZED',
      sent: 0,
      failed: 0
    };
  }

  try {
    const batchSize = 500;
    let skip = 0;
    let totalSent = 0;
    let totalFailed = 0;

    while (true) {
      // Get users with FCM tokens in batches
      const users = await User.find({
        deviceToken: { $exists: true, $ne: null, $ne: '' },
        'notificationPreferences.pushEnabled': { $ne: false }
      })
      .select('deviceToken')
      .limit(batchSize)
      .skip(skip);

      if (users.length === 0) break;

      const tokens = users.map(u => u.deviceToken).filter(Boolean);

      if (tokens.length > 0) {
        // CRITICAL FIX: Send individually instead of multicast
        const results = await Promise.allSettled(
          tokens.map(token => sendToSingleDevice(token, title, body, data))
        );

        // Count results
        results.forEach(result => {
          if (result.status === 'fulfilled' && result.value.success) {
            totalSent++;
          } else {
            totalFailed++;
          }
        });

        console.log(`[FCM Broadcast] Batch: Sent ${totalSent}, Failed ${totalFailed}`);
      }

      skip += batchSize;

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`[FCM Broadcast] Total: Sent ${totalSent}, Failed ${totalFailed}`);

    return {
      success: true,
      sent: totalSent,
      failed: totalFailed
    };

  } catch (error) {
    console.error('[FCM] Error sending broadcast:', error);
    return {
      success: false,
      sent: 0,
      failed: 0,
      error: error.message
    };
  }
}

/**
 * Send push notification based on system notification type
 * @param {string} userId - Target user ID
 * @param {string} systemType - System notification type
 * @param {Object} payload - Notification payload
 * @returns {Promise<Object>} Result
 */
async function sendSystemNotification(userId, systemType, { title, body, data = {} }) {
  try {
    // Check user's notification preferences for this type
    const user = await User.findById(userId).select('deviceToken notificationPreferences');

    if (!user || !user.deviceToken) {
      return { success: false, reason: 'NO_FCM_TOKEN' };
    }

    // Check type-specific preferences
    let shouldSend = user.notificationPreferences?.pushEnabled !== false;

    if (systemType.startsWith('ORDER_')) {
      shouldSend = shouldSend && (user.notificationPreferences?.orderUpdates !== false);
    } else if (systemType.startsWith('PAYMENT_')) {
      shouldSend = shouldSend && (user.notificationPreferences?.paymentAlerts !== false);
    } else if (systemType.startsWith('WALLET_') || systemType.startsWith('COMMISSION_')) {
      shouldSend = shouldSend && (user.notificationPreferences?.paymentAlerts !== false);
    }

    if (!shouldSend) {
      return { success: false, reason: 'USER_PREFERENCE_DISABLED' };
    }

    // Send the notification
    return await sendPushNotification(userId, { title, body, data });

  } catch (error) {
    console.error('[FCM] Error sending system notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Validate and register FCM token for a user
 * @param {string} userId - User ID
 * @param {string} fcmToken - FCM token from mobile device
 * @returns {Promise<boolean>} Success status
 */
async function registerFCMToken(userId, fcmToken) {
  try {
    if (!fcmToken || typeof fcmToken !== 'string') {
      throw new Error('Invalid FCM token format');
    }

    // Update user's FCM token
    await User.findByIdAndUpdate(
      userId,
      { deviceToken: fcmToken },
      { new: true }
    );

    console.log(`[FCM] Token registered for user ${userId}`);
    return true;

  } catch (error) {
    console.error('[FCM] Error registering token:', error);
    throw error;
  }
}

/**
 * Remove FCM token for a user (on logout)
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
async function removeFCMToken(userId) {
  try {
    await User.findByIdAndUpdate(
      userId,
      { $unset: { deviceToken: 1 } }
    );

    console.log(`[FCM] Token removed for user ${userId}`);
    return true;

  } catch (error) {
    console.error('[FCM] Error removing token:', error);
    throw error;
  }
}

module.exports = {
  sendPushNotification,
  sendPushToAllUsers,
  sendSystemNotification,
  registerFCMToken,
  removeFCMToken
};