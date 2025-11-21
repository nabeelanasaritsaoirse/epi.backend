/**
 * Chat Authentication Middleware
 * Verifies user can access conversations and perform chat actions
 */

const Conversation = require('../models/Conversation');
const { isUserInConversation } = require('../services/conversationService');

/**
 * Verify user can access a conversation
 * Used on routes that require conversation access
 */
async function verifyChatAccess(req, res, next) {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id || req.user.uid;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: 'Conversation ID is required'
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Get conversation
    const conversation = await Conversation.findOne({ conversationId })
      .populate('participants')
      .populate('groupMembers');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Check if user is a participant
    const isParticipant = isUserInConversation(conversation, userId);

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this conversation'
      });
    }

    // Add conversation to request for use in controller
    req.conversation = conversation;
    next();
  } catch (error) {
    console.error('Error in verifyChatAccess:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying chat access',
      error: error.message
    });
  }
}

/**
 * Verify user is admin
 * Used on admin chat routes
 */
function verifyAdmin(req, res, next) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    next();
  } catch (error) {
    console.error('Error in verifyAdmin:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying admin access',
      error: error.message
    });
  }
}

/**
 * Check if user's chat is enabled
 * Used to verify user can send/receive messages
 */
async function verifyChatEnabled(req, res, next) {
  try {
    const User = require('../models/User');
    const userId = req.user._id || req.user.uid;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if chat is enabled for user
    if (user.chatSettings && user.chatSettings.allowMessages === false) {
      return res.status(403).json({
        success: false,
        message: 'Chat is disabled for your account'
      });
    }

    next();
  } catch (error) {
    console.error('Error in verifyChatEnabled:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying chat status',
      error: error.message
    });
  }
}

/**
 * Check if user is blocked by recipient
 * Used before sending messages
 */
async function verifyNotBlocked(req, res, next) {
  try {
    const { isUserBlocked } = require('../utils/chatHelpers');
    const userId = req.user._id || req.user.uid;
    const conversation = req.conversation;

    if (!conversation) {
      return next(); // Skip if no conversation in request
    }

    // For individual chats, check if blocked
    if (conversation.type === 'INDIVIDUAL') {
      const otherUserId = conversation.participants.find(
        p => p._id.toString() !== userId.toString()
      );

      if (otherUserId) {
        const blocked = await isUserBlocked(userId.toString(), otherUserId._id.toString());
        if (blocked) {
          return res.status(403).json({
            success: false,
            message: 'You are blocked by this user'
          });
        }
      }
    }

    next();
  } catch (error) {
    console.error('Error in verifyNotBlocked:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying block status',
      error: error.message
    });
  }
}

module.exports = {
  verifyChatAccess,
  verifyAdmin,
  verifyChatEnabled,
  verifyNotBlocked
};
