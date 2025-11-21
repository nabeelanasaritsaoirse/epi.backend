/**
 * User Notification Routes
 * All notification endpoints for regular users
 */

const express = require('express');
const router = express.Router();
const { verifyToken, verifyFirebaseToken } = require('../middlewares/auth');
const rateLimit = require('express-rate-limit');
const notificationController = require('../controllers/notificationController');
const {
  validateGetFeed,
  validateNotificationId,
  validateAddComment,
  validateDeleteComment,
  validateFCMToken,
  validateUpdatePreferences,
  validatePagination
} = require('../validators/notificationValidator');

// Rate limiters
const likeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 likes per hour
  message: {
    success: false,
    message: 'Too many like requests. Please try again later.'
  }
});

const commentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 comments per hour
  message: {
    success: false,
    message: 'Too many comment requests. Please try again later.'
  }
});

// All routes require authentication (support both JWT and Firebase tokens)
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token required'
    });
  }

  // Try JWT first, then Firebase token
  verifyToken(req, res, (err) => {
    if (err || !req.user) {
      verifyFirebaseToken(req, res, next);
    } else {
      next();
    }
  });
};

/**
 * @route   GET /api/notifications
 * @desc    Get notification feed
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  validateGetFeed,
  notificationController.getNotificationFeed
);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count
 * @access  Private
 */
router.get(
  '/unread-count',
  authenticate,
  notificationController.getUnreadCount
);

/**
 * @route   POST /api/notifications/register-token
 * @desc    Register FCM token for push notifications
 * @access  Private
 */
router.post(
  '/register-token',
  authenticate,
  validateFCMToken,
  notificationController.registerToken
);

/**
 * @route   POST /api/notifications/remove-token
 * @desc    Remove FCM token (logout)
 * @access  Private
 */
router.post(
  '/remove-token',
  authenticate,
  notificationController.removeToken
);

/**
 * @route   PUT /api/notifications/preferences
 * @desc    Update notification preferences
 * @access  Private
 */
router.put(
  '/preferences',
  authenticate,
  validateUpdatePreferences,
  notificationController.updatePreferences
);

/**
 * @route   GET /api/notifications/:id
 * @desc    Get single notification with comments
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  validateNotificationId,
  notificationController.getNotificationById
);

/**
 * @route   POST /api/notifications/:id/like
 * @desc    Like or unlike notification
 * @access  Private
 */
router.post(
  '/:id/like',
  authenticate,
  likeLimiter,
  validateNotificationId,
  notificationController.likeNotification
);

/**
 * @route   POST /api/notifications/:id/mark-read
 * @desc    Mark notification as read
 * @access  Private
 */
router.post(
  '/:id/mark-read',
  authenticate,
  validateNotificationId,
  notificationController.markAsRead
);

/**
 * @route   GET /api/notifications/:id/comments
 * @desc    Get comments for notification
 * @access  Private
 */
router.get(
  '/:id/comments',
  authenticate,
  validateNotificationId,
  validatePagination,
  notificationController.getComments
);

/**
 * @route   POST /api/notifications/:id/comments
 * @desc    Add comment to notification
 * @access  Private
 */
router.post(
  '/:id/comments',
  authenticate,
  commentLimiter,
  validateAddComment,
  notificationController.addComment
);

/**
 * @route   DELETE /api/notifications/:notificationId/comments/:commentId
 * @desc    Delete own comment
 * @access  Private
 */
router.delete(
  '/:notificationId/comments/:commentId',
  authenticate,
  validateDeleteComment,
  notificationController.deleteComment
);

module.exports = router;
