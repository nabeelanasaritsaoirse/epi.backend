/**
 * Notification Validators
 * Input validation for notification endpoints using express-validator
 */

const { body, param, query } = require('express-validator');

/**
 * Validate create notification request
 */
const validateCreateNotification = [
  body('postType')
    .isIn(['OFFER', 'POST', 'POST_WITH_IMAGE', 'PRODUCT_SHARE'])
    .withMessage('Invalid post type'),

  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title must not exceed 200 characters'),

  body('body')
    .trim()
    .notEmpty()
    .withMessage('Body is required')
    .isLength({ max: 5000 })
    .withMessage('Body must not exceed 5000 characters'),

  body('productId')
    .optional()
    .isMongoId()
    .withMessage('Invalid product ID'),

  body('sendInApp')
    .optional()
    .isBoolean()
    .withMessage('sendInApp must be boolean'),

  body('sendPush')
    .optional()
    .isBoolean()
    .withMessage('sendPush must be boolean'),

  body('sendPushOnly')
    .optional()
    .isBoolean()
    .withMessage('sendPushOnly must be boolean'),

  body('commentsEnabled')
    .optional()
    .isBoolean()
    .withMessage('commentsEnabled must be boolean'),

  body('likesEnabled')
    .optional()
    .isBoolean()
    .withMessage('likesEnabled must be boolean')
];

/**
 * Validate schedule notification request
 */
const validateScheduleNotification = [
  param('id')
    .isMongoId()
    .withMessage('Invalid notification ID'),

  body('scheduledAt')
    .notEmpty()
    .withMessage('Scheduled date is required')
    .isISO8601()
    .withMessage('Invalid date format. Use ISO 8601 format')
    .custom((value) => {
      const scheduleDate = new Date(value);
      const now = new Date();
      const diffMinutes = (scheduleDate - now) / 1000 / 60;

      if (diffMinutes < 5) {
        throw new Error('Scheduled date must be at least 5 minutes in the future');
      }

      return true;
    })
];

/**
 * Validate update notification request
 */
const validateUpdateNotification = [
  param('id')
    .isMongoId()
    .withMessage('Invalid notification ID'),

  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),

  body('body')
    .optional()
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Body must be between 1 and 5000 characters'),

  body('commentsEnabled')
    .optional()
    .isBoolean()
    .withMessage('commentsEnabled must be boolean'),

  body('likesEnabled')
    .optional()
    .isBoolean()
    .withMessage('likesEnabled must be boolean')
];

/**
 * Validate add comment request
 */
const validateAddComment = [
  param('id')
    .isMongoId()
    .withMessage('Invalid notification ID'),

  body('text')
    .trim()
    .notEmpty()
    .withMessage('Comment text is required')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment must be between 1 and 1000 characters')
    .custom((value) => {
      // Check for URLs in comment
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      if (urlRegex.test(value)) {
        throw new Error('URLs are not allowed in comments');
      }
      return true;
    })
];

/**
 * Validate delete comment request
 */
const validateDeleteComment = [
  param('notificationId')
    .isMongoId()
    .withMessage('Invalid notification ID'),

  param('commentId')
    .isMongoId()
    .withMessage('Invalid comment ID')
];

/**
 * Validate admin delete comment request
 */
const validateAdminDeleteComment = [
  param('notificationId')
    .isMongoId()
    .withMessage('Invalid notification ID'),

  param('commentId')
    .isMongoId()
    .withMessage('Invalid comment ID'),

  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Deletion reason must not exceed 500 characters')
];

/**
 * Validate pagination query
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt()
];

/**
 * Validate get feed query
 */
const validateGetFeed = [
  ...validatePagination,

  query('type')
    .optional()
    .isIn(['ADMIN_POST', 'SYSTEM_NOTIFICATION'])
    .withMessage('Invalid type')
];

/**
 * Validate get admin notifications query
 */
const validateGetAdminNotifications = [
  ...validatePagination,

  query('status')
    .optional()
    .isIn(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'INACTIVE', 'DELETED'])
    .withMessage('Invalid status'),

  query('type')
    .optional()
    .isIn(['ADMIN_POST', 'SYSTEM_NOTIFICATION'])
    .withMessage('Invalid type'),

  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query too long')
];

/**
 * Validate notification ID parameter
 */
const validateNotificationId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid notification ID')
];

/**
 * Validate FCM token registration
 */
const validateFCMToken = [
  body('fcmToken')
    .trim()
    .notEmpty()
    .withMessage('FCM token is required')
    .isLength({ min: 10 })
    .withMessage('Invalid FCM token format')
];

/**
 * Validate update notification settings
 */
const validateUpdateSettings = [
  param('id')
    .isMongoId()
    .withMessage('Invalid notification ID'),

  body('commentsEnabled')
    .optional()
    .isBoolean()
    .withMessage('commentsEnabled must be boolean'),

  body('likesEnabled')
    .optional()
    .isBoolean()
    .withMessage('likesEnabled must be boolean')
];

/**
 * Validate notification preferences update
 */
const validateUpdatePreferences = [
  body('pushEnabled')
    .optional()
    .isBoolean()
    .withMessage('pushEnabled must be boolean'),

  body('orderUpdates')
    .optional()
    .isBoolean()
    .withMessage('orderUpdates must be boolean'),

  body('promotionalOffers')
    .optional()
    .isBoolean()
    .withMessage('promotionalOffers must be boolean'),

  body('paymentAlerts')
    .optional()
    .isBoolean()
    .withMessage('paymentAlerts must be boolean'),

  body('systemNotifications')
    .optional()
    .isBoolean()
    .withMessage('systemNotifications must be boolean')
];

/**
 * Validate trigger custom notification request
 */
const validateTriggerNotification = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),

  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 1 and 1000 characters'),

  body('sendPush')
    .optional()
    .isBoolean()
    .withMessage('sendPush must be a boolean (true/false)'),

  body('sendInApp')
    .optional()
    .isBoolean()
    .withMessage('sendInApp must be a boolean (true/false)')
];

module.exports = {
  validateCreateNotification,
  validateScheduleNotification,
  validateUpdateNotification,
  validateAddComment,
  validateDeleteComment,
  validateAdminDeleteComment,
  validatePagination,
  validateGetFeed,
  validateGetAdminNotifications,
  validateNotificationId,
  validateFCMToken,
  validateUpdateSettings,
  validateUpdatePreferences,
  validateTriggerNotification
};
