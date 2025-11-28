/**
 * Chat Routes
 * Handles all user-facing chat endpoints
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Middleware
const { verifyFirebaseToken } = require('../middlewares/auth');
const {
  verifyChatAccess,
  verifyChatEnabled,
  verifyNotBlocked
} = require('../middlewares/chatAuth');
const {
  sanitizeMessage,
  validateMessageLength,
  removeDangerousContent
} = require('../middlewares/messageSanitizer');

// Validators
const {
  validateSendMessage,
  validateEditMessage,
  validateDeleteMessage,
  validateMarkAsRead,
  validateCreateIndividualConversation,
  validateCreateGroupBroadcast,
  validateReportMessage,
  validateGetConversations,
  validateGetMessages,
  validatePoll,
  validateSearchMessages,
  validateGetMyReferrals
} = require('../validators/chatValidator');

// Controllers
const chatController = require('../controllers/chatController');

// Rate limiting configurations
const messageRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50, // 50 messages per minute per user
  message: {
    success: false,
    message: 'Too many messages sent. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Rate limit per user if authenticated, otherwise skip (will use default IP-based)
    if (req.user) {
      req.rateLimit = { key: (req.user._id || req.user.uid).toString() };
    }
    return false;
  }
});

const conversationRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 conversation creations per 5 minutes
  message: {
    success: false,
    message: 'Too many conversation creation attempts. Please try again later.'
  },
  skip: (req) => {
    if (req.user) {
      req.rateLimit = { key: (req.user._id || req.user.uid).toString() };
    }
    return false;
  }
});

const reportRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // 10 reports per 10 minutes
  message: {
    success: false,
    message: 'Too many report submissions. Please try again later.'
  },
  skip: (req) => {
    if (req.user) {
      req.rateLimit = { key: (req.user._id || req.user.uid).toString() };
    }
    return false;
  }
});

const pollRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 polls per minute (every 3 seconds)
  message: {
    success: false,
    message: 'Polling too frequently. Please slow down.'
  },
  skip: (req) => {
    if (req.user) {
      req.rateLimit = { key: (req.user._id || req.user.uid).toString() };
    }
    return false;
  }
});

/**
 * GET /api/chat/conversations
 * Get user's conversation list with pagination
 */
router.get(
  '/conversations',
  verifyFirebaseToken,
  verifyChatEnabled,
  validateGetConversations,
  chatController.getConversations
);

/**
 * GET /api/chat/conversations/:conversationId/messages
 * Get messages from a conversation
 */
router.get(
  '/conversations/:conversationId/messages',
  verifyFirebaseToken,
  verifyChatEnabled,
  verifyChatAccess,
  validateGetMessages,
  chatController.getMessages
);

/**
 * POST /api/chat/conversations/:conversationId/messages
 * Send a message in a conversation
 */
router.post(
  '/conversations/:conversationId/messages',
  verifyFirebaseToken,
  verifyChatEnabled,
  verifyChatAccess,
  verifyNotBlocked,
  messageRateLimit,
  removeDangerousContent,
  sanitizeMessage,
  validateMessageLength,
  validateSendMessage,
  chatController.sendMessage
);

/**
 * POST /api/chat/conversations/individual
 * Create or get individual conversation with a referral
 */
router.post(
  '/conversations/individual',
  verifyFirebaseToken,
  verifyChatEnabled,
  conversationRateLimit,
  validateCreateIndividualConversation,
  chatController.createIndividualConversation
);

/**
 * POST /api/chat/conversations/group-broadcast
 * Create group broadcast for all referrals
 */
router.post(
  '/conversations/group-broadcast',
  verifyFirebaseToken,
  verifyChatEnabled,
  conversationRateLimit,
  sanitizeMessage,
  validateCreateGroupBroadcast,
  chatController.createGroupBroadcast
);

/**
 * POST /api/chat/conversations/:conversationId/mark-read
 * Mark messages as read in a conversation
 */
router.post(
  '/conversations/:conversationId/mark-read',
  verifyFirebaseToken,
  verifyChatAccess,
  validateMarkAsRead,
  chatController.markAsRead
);

/**
 * PATCH /api/chat/messages/:messageId
 * Edit a message (only own messages, within 15 min, text only)
 */
router.patch(
  '/messages/:messageId',
  verifyFirebaseToken,
  verifyChatEnabled,
  removeDangerousContent,
  sanitizeMessage,
  validateMessageLength,
  validateEditMessage,
  chatController.editMessage
);

/**
 * DELETE /api/chat/messages/:messageId
 * Delete a message (soft delete, only own messages)
 */
router.delete(
  '/messages/:messageId',
  verifyFirebaseToken,
  verifyChatEnabled,
  validateDeleteMessage,
  chatController.deleteMessage
);

/**
 * POST /api/chat/messages/:messageId/report
 * Report a message for spam/abuse
 */
router.post(
  '/messages/:messageId/report',
  verifyFirebaseToken,
  reportRateLimit,
  sanitizeMessage,
  validateReportMessage,
  chatController.reportMessage
);

/**
 * GET /api/chat/my-referrals
 * Get list of user's referrals for chatting
 */
router.get(
  '/my-referrals',
  verifyFirebaseToken,
  validateGetMyReferrals,
  chatController.getMyReferrals
);

/**
 * GET /api/chat/poll
 * Poll for new messages (called every 5-10 seconds by client)
 */
router.get(
  '/poll',
  verifyFirebaseToken,
  pollRateLimit,
  validatePoll,
  chatController.pollMessages
);

/**
 * GET /api/chat/search
 * Search messages across conversations
 */
router.get(
  '/search',
  verifyFirebaseToken,
  verifyChatEnabled,
  validateSearchMessages,
  chatController.searchMessages
);

module.exports = router;
