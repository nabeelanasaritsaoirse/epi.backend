/**
 * Admin Notification Routes
 * Admin-only endpoints for managing notifications
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middlewares/auth');
const rateLimit = require('express-rate-limit');
const adminNotificationController = require('../controllers/adminNotificationController');
const {
  validateCreateNotification,
  validateScheduleNotification,
  validateUpdateNotification,
  validateNotificationId,
  validateAdminDeleteComment,
  validateUpdateSettings,
  validateGetAdminNotifications
} = require('../validators/notificationValidator');

// Rate limiter for image uploads
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 uploads per hour
  message: {
    success: false,
    message: 'Too many upload requests. Please try again later.'
  }
});

// All routes require admin authentication
router.use(verifyToken);
router.use(isAdmin);

/**
 * @route   POST /api/admin/notifications/create
 * @desc    Create new notification (draft)
 * @access  Admin
 */
router.post(
  '/create',
  validateCreateNotification,
  adminNotificationController.createNotification
);

/**
 * @route   GET /api/admin/notifications
 * @desc    Get all notifications with filters
 * @access  Admin
 */
router.get(
  '/',
  validateGetAdminNotifications,
  adminNotificationController.getAllNotifications
);

/**
 * @route   GET /api/admin/notifications/analytics
 * @desc    Get notification analytics
 * @access  Admin
 */
router.get(
  '/analytics',
  adminNotificationController.getAnalytics
);

/**
 * @route   PUT /api/admin/notifications/:id/upload-image
 * @desc    Upload image to notification
 * @access  Admin
 */
router.put(
  '/:id/upload-image',
  uploadLimiter,
  adminNotificationController.uploadImage
);

/**
 * @route   POST /api/admin/notifications/:id/publish
 * @desc    Publish notification immediately
 * @access  Admin
 */
router.post(
  '/:id/publish',
  validateNotificationId,
  adminNotificationController.publishNotification
);

/**
 * @route   POST /api/admin/notifications/:id/schedule
 * @desc    Schedule notification for future
 * @access  Admin
 */
router.post(
  '/:id/schedule',
  validateScheduleNotification,
  adminNotificationController.scheduleNotification
);

/**
 * @route   PATCH /api/admin/notifications/:id
 * @desc    Update notification
 * @access  Admin
 */
router.patch(
  '/:id',
  validateUpdateNotification,
  adminNotificationController.updateNotification
);

/**
 * @route   DELETE /api/admin/notifications/:id
 * @desc    Delete notification (soft delete)
 * @access  Admin
 */
router.delete(
  '/:id',
  validateNotificationId,
  adminNotificationController.deleteNotification
);

/**
 * @route   PATCH /api/admin/notifications/:id/settings
 * @desc    Update notification settings (comments/likes toggle)
 * @access  Admin
 */
router.patch(
  '/:id/settings',
  validateUpdateSettings,
  adminNotificationController.updateSettings
);

/**
 * @route   DELETE /api/admin/notifications/:notificationId/comments/:commentId
 * @desc    Delete comment (admin moderation)
 * @access  Admin
 */
router.delete(
  '/:notificationId/comments/:commentId',
  validateAdminDeleteComment,
  adminNotificationController.deleteComment
);

/**
 * @route   POST /api/admin/notifications/send-to-user
 * @desc    Send push notification to specific user
 * @access  Admin
 */
router.post(
  '/send-to-user',
  adminNotificationController.sendToUser
);

module.exports = router;
