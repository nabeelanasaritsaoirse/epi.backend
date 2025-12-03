/**
 * Admin Chat Routes
 * Handles all admin chat moderation endpoints
 */

const express = require('express');
const router = express.Router();

// Middleware
const { verifyToken, isAdmin } = require('../middlewares/auth');
const { verifyAdmin } = require('../middlewares/chatAuth');
const { sanitizeMessage } = require('../middlewares/messageSanitizer');

// Validators
const {
  validateAdminTakeAction,
  validateAdminBroadcast,
  validateGetConversations,
  validateGetMessages,
  validateDeleteMessage
} = require('../validators/chatValidator');

// Controllers
const adminChatController = require('../controllers/adminChatController');

// Apply admin authentication to all routes
router.use(verifyToken);
router.use(isAdmin);

/**
 * GET /api/admin/chat/conversations
 * Get all conversations (admin view)
 */
router.get(
  '/conversations',
  validateGetConversations,
  adminChatController.getAllConversations
);

/**
 * GET /api/admin/chat/conversations/:conversationId/messages
 * View conversation messages (admin view - includes deleted)
 */
router.get(
  '/conversations/:conversationId/messages',
  validateGetMessages,
  adminChatController.getConversationMessages
);

/**
 * GET /api/admin/chat/reports
 * Get all reported messages
 */
router.get(
  '/reports',
  adminChatController.getReportedMessages
);

/**
 * POST /api/admin/chat/reports/:reportId/action
 * Take action on a reported message
 */
router.post(
  '/reports/:reportId/action',
  sanitizeMessage,
  validateAdminTakeAction,
  adminChatController.takeActionOnReport
);

/**
 * DELETE /api/admin/chat/messages/:messageId
 * Delete message by admin
 */
router.delete(
  '/messages/:messageId',
  sanitizeMessage,
  validateDeleteMessage,
  adminChatController.deleteMessage
);

/**
 * POST /api/admin/chat/broadcast
 * Send broadcast message to all users
 */
router.post(
  '/broadcast',
  sanitizeMessage,
  validateAdminBroadcast,
  adminChatController.sendBroadcast
);

/**
 * GET /api/admin/chat/analytics
 * Get chat analytics and statistics
 */
router.get(
  '/analytics',
  adminChatController.getChatAnalytics
);

module.exports = router;
