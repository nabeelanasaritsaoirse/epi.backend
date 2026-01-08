/**
 * Notification Helper Functions
 * Utility functions for notification management
 */

const xss = require('xss');
const NotificationLike = require('../models/NotificationLike');

/**
 * Generate unique notification ID
 * Format: NOTIF-YYYYMMDD-XXXXXXXXXX (timestamp + random)
 * @returns {string} Unique notification ID
 */
function generateNotificationId() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  // Use timestamp (milliseconds) + random for uniqueness
  const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
  const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random

  return `NOTIF-${year}${month}${day}-${timestamp}${random}`;
}

/**
 * Generate unique comment ID
 * Format: CMT-YYYYMMDD-XXXXXXXXXX (timestamp + random)
 * @returns {string} Unique comment ID
 */
function generateCommentId() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  // Use timestamp (milliseconds) + random for uniqueness
  const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
  const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random

  return `CMT-${year}${month}${day}-${timestamp}${random}`;
}

/**
 * Sanitize comment text to prevent XSS attacks
 * @param {string} text - Comment text
 * @returns {string} Sanitized text
 */
function sanitizeCommentText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Remove HTML tags and sanitize
  const sanitized = xss(text, {
    whiteList: {}, // No HTML allowed
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style']
  });

  // Trim whitespace
  return sanitized.trim();
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength = 100) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength) + '...';
}

/**
 * Check if user has liked a notification
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if user has liked
 */
async function checkUserLiked(notificationId, userId) {
  try {
    const like = await NotificationLike.findOne({
      notificationId,
      userId
    });

    return !!like;
  } catch (error) {
    console.error('Error checking user like:', error);
    return false;
  }
}

/**
 * Format notification for feed display
 * @param {Object} notification - Notification document
 * @param {string} currentUserId - Current user ID (optional)
 * @returns {Promise<Object>} Formatted notification
 */
async function formatNotificationForFeed(notification, currentUserId = null) {
  try {
    const formatted = {
      notificationId: notification.notificationId,
      _id: notification._id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      imageUrl: notification.imageUrl,
      publishedAt: notification.publishedAt,
      createdAt: notification.createdAt
    };

    // Add admin post specific fields
    if (notification.type === 'ADMIN_POST') {
      formatted.postType = notification.postType;
      formatted.likeCount = notification.likeCount || 0;
      formatted.commentCount = notification.commentCount || 0;
      formatted.viewCount = notification.viewCount || 0;
      formatted.commentsEnabled = notification.commentsEnabled;
      formatted.likesEnabled = notification.likesEnabled;

      // Check if current user has liked
      if (currentUserId) {
        formatted.isLikedByMe = await checkUserLiked(notification._id, currentUserId);
      }

      // Add shared product info if applicable
      if (notification.postType === 'PRODUCT_SHARE' && notification.sharedProduct) {
        formatted.sharedProduct = notification.sharedProduct;
      }

      // Add creator info
      if (notification.createdBy) {
        formatted.createdBy = {
          _id: notification.createdBy._id,
          name: notification.createdBy.name,
          avatar: notification.createdBy.profilePicture
        };
      }
    }

    // Add system notification specific fields
    if (notification.type === 'SYSTEM_NOTIFICATION') {
      formatted.systemType = notification.systemType;

      // Add metadata if present
      if (notification.metadata) {
        formatted.metadata = notification.metadata;
      }
    }

    return formatted;
  } catch (error) {
    console.error('Error formatting notification:', error);
    return notification;
  }
}

/**
 * Calculate engagement rate for a notification
 * @param {Object} notification - Notification document
 * @returns {number} Engagement rate percentage
 */
function calculateEngagementRate(notification) {
  if (!notification.viewCount || notification.viewCount === 0) {
    return 0;
  }

  const interactions = (notification.likeCount || 0) + (notification.commentCount || 0);
  const rate = (interactions / notification.viewCount) * 100;

  return Math.round(rate * 100) / 100; // Round to 2 decimal places
}

/**
 * Validate notification image
 * @param {Object} file - Multer file object
 * @returns {Object} Validation result
 */
function validateNotificationImage(file) {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Check file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return { valid: false, error: 'File size exceeds 5MB limit' };
  }

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.mimetype)) {
    return {
      valid: false,
      error: 'Invalid file type. Only JPG, PNG, and WebP are allowed'
    };
  }

  return { valid: true };
}

/**
 * Format time difference for display (e.g., "2 hours ago")
 * @param {Date} date - Date to format
 * @returns {string} Formatted time difference
 */
function formatTimeAgo(date) {
  const now = new Date();
  const diffMs = now - new Date(date);
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else {
    return new Date(date).toLocaleDateString();
  }
}

/**
 * Build notification data for push
 * @param {Object} notification - Notification document
 * @returns {Object} Push notification data
 */
function buildPushData(notification) {
  const data = {
    notificationId: notification._id.toString(),
    type: notification.type,
    navigateTo: `/notifications/${notification._id}`
  };

  if (notification.type === 'ADMIN_POST') {
    data.postType = notification.postType;
  }

  if (notification.type === 'SYSTEM_NOTIFICATION') {
    data.systemType = notification.systemType;

    if (notification.metadata?.orderId) {
      const orderIdString = notification.metadata.orderId.toString();
      data.orderId = orderIdString;
      data.navigateTo = `/orders/${orderIdString}`;
    }
  }

  return data;
}

/**
 * Check if date is in the future
 * @param {Date} date - Date to check
 * @param {number} minMinutes - Minimum minutes in future (default: 5)
 * @returns {boolean} True if date is in future
 */
function isFutureDate(date, minMinutes = 5) {
  const now = new Date();
  const targetDate = new Date(date);
  const diffMs = targetDate - now;
  const diffMins = Math.floor(diffMs / 1000 / 60);

  return diffMins >= minMinutes;
}

module.exports = {
  generateNotificationId,
  generateCommentId,
  sanitizeCommentText,
  truncateText,
  checkUserLiked,
  formatNotificationForFeed,
  calculateEngagementRate,
  validateNotificationImage,
  formatTimeAgo,
  buildPushData,
  isFutureDate
};
