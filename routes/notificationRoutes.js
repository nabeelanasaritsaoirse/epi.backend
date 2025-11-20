const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// ============================================
// STATIC ROUTES (MUST BE BEFORE :id)
// ============================================

/**
 * GET /api/notifications/public/inapp
 * Get all active in-app notifications (public endpoint)
 */
router.get('/public/inapp', notificationController.getInAppNotifications);

/**
 * GET /api/notifications/public/system
 * Get all active system notifications (public endpoint)
 */
router.get('/public/system', notificationController.getSystemNotifications);

/**
 * GET /api/notifications/admin/all
 * Get all notifications with filters
 */
router.get('/admin/all', notificationController.getAllNotifications);

/**
 * GET /api/notifications/admin/stats
 * Get notification statistics
 */
router.get('/admin/stats', notificationController.getNotificationStats);

/**
 * GET /api/notifications/type/:type
 * Get notifications by type (inapp, system, both)
 */
router.get('/type/:type', notificationController.getNotificationsByType);

// ============================================
// CRUD OPERATIONS
// ============================================

/**
 * POST /api/notifications
 * Create a new notification (without auth - auto-generates notificationId)
 * Required: title, message
 * Optional: type, priority, link, metadata
 */
router.post('/', notificationController.createNotification);

/**
 * GET /api/notifications/:id
 * Get single notification by ID
 */
router.get('/:id', notificationController.getNotificationById);

/**
 * PUT /api/notifications/:id
 * Update notification
 */
router.put('/:id', notificationController.updateNotification);

/**
 * PATCH /api/notifications/:id/toggle
 * Toggle notification status (active/inactive)
 */
router.patch('/:id/toggle', notificationController.toggleNotificationStatus);

/**
 * POST /api/notifications/:id/read
 * Mark notification as read by user
 */
router.post('/:id/read', notificationController.markAsRead);

/**
 * POST /api/notifications/:id/restore
 * Restore soft-deleted notification
 */
router.post('/:id/restore', notificationController.restoreNotification);

/**
 * DELETE /api/notifications/:id
 * Soft delete notification
 */
router.delete('/:id', notificationController.deleteNotification);

/**
 * DELETE /api/notifications/:id/permanent
 * Permanently delete notification with image cleanup
 */
router.delete('/:id/permanent', notificationController.permanentlyDeleteNotification);

module.exports = router;
