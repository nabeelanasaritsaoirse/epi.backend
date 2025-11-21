/**
 * Notification System Service
 * Core service for creating and managing notifications
 * Provides reusable trigger function for system notifications throughout the app
 */

const Notification = require('../models/Notification');
const User = require('../models/User');
const Product = require('../models/Product');
const { generateNotificationId, buildPushData } = require('../utils/notificationHelpers');
const { sendPushNotification, sendSystemNotification, sendPushToAllUsers } = require('./fcmService');

/**
 * Universal function to trigger notifications from anywhere in the codebase
 * This is the PRIMARY function you should use to send notifications
 *
 * @example
 * // Order confirmation
 * await triggerNotification({
 *   type: 'ORDER_CONFIRMATION',
 *   userId: order.userId,
 *   title: 'Order Confirmed! 🎉',
 *   body: `Your order #${order.orderNumber} has been confirmed`,
 *   sendPush: true,
 *   sendInApp: true,
 *   metadata: { orderId: order._id }
 * });
 *
 * @example
 * // Payment success
 * await triggerNotification({
 *   type: 'PAYMENT_SUCCESS',
 *   userId: payment.userId,
 *   title: 'Payment Received',
 *   body: `₹${payment.amount} received successfully`,
 *   sendPush: true,
 *   sendInApp: true,
 *   metadata: { paymentId: payment._id, amount: payment.amount }
 * });
 *
 * @param {Object} params - Notification parameters
 * @param {string} params.type - System notification type (ORDER_CONFIRMATION, PAYMENT_SUCCESS, etc.)
 * @param {string|Array<string>} params.userId - Target user ID(s)
 * @param {string} params.title - Notification title
 * @param {string} params.body - Notification body/message
 * @param {boolean} [params.sendPush=false] - Send push notification
 * @param {boolean} [params.sendInApp=true] - Add to in-app notification feed
 * @param {Object} [params.metadata={}] - Additional metadata (orderId, paymentId, etc.)
 * @returns {Promise<Object>} Result with success status
 */
async function triggerNotification({
  type,
  userId,
  title,
  body,
  sendPush = false,
  sendInApp = true,
  metadata = {}
}) {
  try {
    // Validate required parameters
    if (!type || !userId || !title || !body) {
      throw new Error('Missing required parameters: type, userId, title, body');
    }

    // Convert userId to array if needed
    const userIds = Array.isArray(userId) ? userId : [userId];

    // Create notification record if sendInApp is enabled
    if (sendInApp) {
      for (const uid of userIds) {
        const notificationId = generateNotificationId();

        await Notification.create({
          notificationId,
          type: 'SYSTEM_NOTIFICATION',
          systemType: type,
          title,
          body,
          targetType: 'SPECIFIC_USER',
          targetUserId: uid,
          sendInApp: true,
          sendPush: sendPush,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          metadata,
          commentsEnabled: false,
          likesEnabled: false
        });

        console.log(`[Notification] Created in-app notification ${notificationId} for user ${uid}`);
      }
    }

    // Send push notification if enabled
    if (sendPush) {
      const pushData = {
        type,
        ...metadata
      };

      // Convert ObjectIds to strings for push data
      Object.keys(pushData).forEach(key => {
        if (pushData[key] && typeof pushData[key] === 'object' && pushData[key]._id) {
          pushData[key] = pushData[key].toString();
        }
      });

      const pushResult = await sendPushNotification(userIds, {
        title,
        body,
        data: pushData
      });

      console.log(`[Notification] Push sent: ${pushResult.sent}, failed: ${pushResult.failed}`);
    }

    return {
      success: true,
      inAppCreated: sendInApp,
      pushSent: sendPush
    };

  } catch (error) {
    console.error('[Notification] Error triggering notification:', error);
    throw error;
  }
}

/**
 * Create admin post (draft mode)
 * @param {Object} adminId - Admin user ID
 * @param {Object} postData - Post data
 * @returns {Promise<Object>} Created notification
 */
async function createAdminPost(adminId, postData) {
  try {
    const {
      postType,
      title,
      body,
      productId,
      sendInApp = true,
      sendPush = false,
      sendPushOnly = false,
      commentsEnabled = true,
      likesEnabled = true
    } = postData;

    // Validate product if PRODUCT_SHARE
    let sharedProduct = null;
    if (postType === 'PRODUCT_SHARE') {
      if (!productId) {
        throw new Error('Product ID is required for PRODUCT_SHARE type');
      }

      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      sharedProduct = {
        productId: product._id,
        productName: product.name,
        productImage: product.images?.[0] || '',
        productPrice: product.price,
        productUrl: `/products/${product._id}`
      };
    }

    const notificationId = generateNotificationId();

    const notification = await Notification.create({
      notificationId,
      type: 'ADMIN_POST',
      postType,
      title,
      body,
      sharedProduct,
      targetType: 'ALL_USERS',
      sendInApp,
      sendPush,
      sendPushOnly,
      commentsEnabled,
      likesEnabled,
      status: 'DRAFT',
      createdBy: adminId
    });

    console.log(`[Notification] Admin post created: ${notificationId}`);

    return notification;

  } catch (error) {
    console.error('[Notification] Error creating admin post:', error);
    throw error;
  }
}

/**
 * Publish admin post
 * @param {string} notificationId - Notification ID
 * @returns {Promise<Object>} Result with push stats
 */
async function publishAdminPost(notificationId) {
  try {
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.status === 'PUBLISHED') {
      throw new Error('Notification is already published');
    }

    // Update status
    notification.status = 'PUBLISHED';
    notification.publishedAt = new Date();

    // Send push notifications if enabled
    let pushStats = { sent: 0, failed: 0 };

    if (notification.sendPush || notification.sendPushOnly) {
      const pushData = buildPushData(notification);

      const result = await sendPushToAllUsers({
        title: notification.title,
        body: notification.body,
        data: pushData
      });

      pushStats = {
        sent: result.sent || 0,
        failed: result.failed || 0
      };

      notification.pushStats = {
        sent: pushStats.sent,
        failed: pushStats.failed,
        sentAt: new Date()
      };
    }

    await notification.save();

    console.log(`[Notification] Published: ${notification.notificationId}`);

    return {
      success: true,
      notificationId: notification.notificationId,
      pushSent: notification.sendPush || notification.sendPushOnly,
      ...pushStats
    };

  } catch (error) {
    console.error('[Notification] Error publishing post:', error);
    throw error;
  }
}

/**
 * Schedule admin post for future publishing
 * @param {string} notificationId - Notification ID
 * @param {Date} scheduledAt - Schedule date/time
 * @returns {Promise<Object>} Updated notification
 */
async function scheduleAdminPost(notificationId, scheduledAt) {
  try {
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.status === 'PUBLISHED') {
      throw new Error('Cannot schedule an already published notification');
    }

    // Validate future date
    const now = new Date();
    const scheduleDate = new Date(scheduledAt);

    if (scheduleDate <= now) {
      throw new Error('Scheduled date must be in the future');
    }

    // Must be at least 5 minutes in future
    const diffMinutes = (scheduleDate - now) / 1000 / 60;
    if (diffMinutes < 5) {
      throw new Error('Scheduled date must be at least 5 minutes in the future');
    }

    notification.status = 'SCHEDULED';
    notification.scheduledAt = scheduleDate;

    await notification.save();

    console.log(`[Notification] Scheduled: ${notification.notificationId} for ${scheduleDate}`);

    return notification;

  } catch (error) {
    console.error('[Notification] Error scheduling post:', error);
    throw error;
  }
}

/**
 * Update admin post
 * @param {string} notificationId - Notification ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated notification
 */
async function updateAdminPost(notificationId, updates) {
  try {
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      throw new Error('Notification not found');
    }

    // Allowed fields to update
    const allowedFields = [
      'title',
      'body',
      'commentsEnabled',
      'likesEnabled',
      'imageUrl'
    ];

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        notification[field] = updates[field];
      }
    });

    await notification.save();

    console.log(`[Notification] Updated: ${notification.notificationId}`);

    return notification;

  } catch (error) {
    console.error('[Notification] Error updating post:', error);
    throw error;
  }
}

/**
 * Delete notification (soft delete)
 * @param {string} notificationId - Notification ID
 * @param {string} deletedBy - User ID who deleted
 * @returns {Promise<boolean>} Success status
 */
async function deleteNotification(notificationId, deletedBy) {
  try {
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      throw new Error('Notification not found');
    }

    notification.isDeleted = true;
    notification.deletedAt = new Date();
    notification.deletedBy = deletedBy;
    notification.status = 'DELETED';

    await notification.save();

    console.log(`[Notification] Deleted: ${notification.notificationId}`);

    return true;

  } catch (error) {
    console.error('[Notification] Error deleting notification:', error);
    throw error;
  }
}

/**
 * Get notification feed for user
 * @param {string} userId - User ID
 * @param {Object} options - Query options (page, limit, type)
 * @returns {Promise<Object>} Notifications with pagination
 */
async function getUserNotificationFeed(userId, options = {}) {
  try {
    const { page = 1, limit = 20, type } = options;
    const skip = (page - 1) * limit;

    const query = {
      isDeleted: false,
      status: 'PUBLISHED',
      $or: [
        { targetType: 'ALL_USERS' },
        { targetType: 'SPECIFIC_USER', targetUserId: userId }
      ]
    };

    if (type) {
      query.type = type;
    }

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name profilePicture')
        .lean(),
      Notification.countDocuments(query)
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + notifications.length < total
      }
    };

  } catch (error) {
    console.error('[Notification] Error getting feed:', error);
    throw error;
  }
}

module.exports = {
  triggerNotification,
  createAdminPost,
  publishAdminPost,
  scheduleAdminPost,
  updateAdminPost,
  deleteNotification,
  getUserNotificationFeed
};
