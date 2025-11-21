/**
 * Chat Controller
 * Handles all user-facing chat endpoints
 */

const conversationService = require('../services/conversationService');
const chatService = require('../services/chatService');
const notificationService = require('../services/notificationService');

/**
 * @route   GET /api/chat/conversations
 * @desc    Get user's conversation list
 * @access  Private
 */
async function getConversations(req, res) {
  try {
    const userId = req.user._id || req.user.uid;
    const { page = 1, limit = 20, type } = req.query;

    const result = await conversationService.getUserConversations(
      userId,
      type,
      { page: parseInt(page), limit: parseInt(limit) }
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in getConversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations',
      error: error.message
    });
  }
}

/**
 * @route   GET /api/chat/conversations/:conversationId/messages
 * @desc    Get messages from a conversation
 * @access  Private
 */
async function getMessages(req, res) {
  try {
    const userId = req.user._id || req.user.uid;
    const { conversationId } = req.params;
    const { page = 1, limit = 20, beforeMessageId } = req.query;

    const result = await chatService.getConversationMessages(
      conversationId,
      userId,
      { page: parseInt(page), limit: parseInt(limit), beforeMessageId }
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in getMessages:', error);
    const statusCode = error.message === 'Conversation not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch messages',
      error: error.message
    });
  }
}

/**
 * @route   POST /api/chat/conversations/:conversationId/messages
 * @desc    Send a message in a conversation
 * @access  Private
 */
async function sendMessage(req, res) {
  try {
    const userId = req.user._id || req.user.uid;
    const { conversationId } = req.params;
    const { messageType, text, productId, orderId, replyToMessageId } = req.body;

    const message = await chatService.sendMessage(
      conversationId,
      userId,
      { messageType, text, productId, orderId, replyToMessageId }
    );

    // Send notifications to recipients
    const conversation = req.conversation;
    let recipients = [];
    if (conversation.type === 'INDIVIDUAL') {
      recipients = conversation.participants.filter(
        p => p._id.toString() !== userId.toString()
      );
    } else if (conversation.type === 'GROUP_BROADCAST') {
      recipients = conversation.groupMembers.filter(
        m => m.toString() !== userId.toString()
      );
    }

    if (recipients.length > 0) {
      await notificationService.sendNewMessageNotification(recipients, {
        senderName: message.senderName,
        messageType: message.messageType,
        text: message.text
      });
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        messageId: message.messageId,
        conversationId,
        senderId: message.senderId,
        messageType: message.messageType,
        text: message.text,
        deliveryStatus: message.deliveryStatus,
        createdAt: message.createdAt
      }
    });
  } catch (error) {
    console.error('Error in sendMessage:', error);
    const statusCode = error.message.includes('not found') ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to send message',
      error: error.message
    });
  }
}

/**
 * @route   POST /api/chat/conversations/individual
 * @desc    Create or get individual conversation
 * @access  Private
 */
async function createIndividualConversation(req, res) {
  try {
    const userId = req.user._id || req.user.uid;
    const { withUserId } = req.body;

    const result = await conversationService.createIndividualConversation(userId, withUserId);

    res.status(result.isNewConversation ? 201 : 200).json({
      success: true,
      data: {
        conversationId: result.conversation.conversationId,
        type: result.conversation.type,
        participants: result.conversation.participants,
        isNewConversation: result.isNewConversation
      }
    });
  } catch (error) {
    console.error('Error in createIndividualConversation:', error);
    const statusCode = error.message.includes('No referral relationship') ? 403 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to create conversation',
      error: error.message
    });
  }
}

/**
 * @route   POST /api/chat/conversations/group-broadcast
 * @desc    Create group broadcast conversation
 * @access  Private
 */
async function createGroupBroadcast(req, res) {
  try {
    const userId = req.user._id || req.user.uid;
    const { groupName, memberIds } = req.body;

    const conversation = await conversationService.createGroupBroadcast(
      userId,
      memberIds,
      groupName
    );

    res.status(201).json({
      success: true,
      data: {
        conversationId: conversation.conversationId,
        type: conversation.type,
        groupName: conversation.groupName,
        memberCount: conversation.groupMembers.length,
        members: conversation.groupMembers.map(m => ({
          userId: m._id,
          name: m.name,
          avatar: m.profilePicture || ''
        }))
      }
    });
  } catch (error) {
    console.error('Error in createGroupBroadcast:', error);
    const statusCode = error.message.includes('Maximum') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to create group broadcast',
      error: error.message
    });
  }
}

/**
 * @route   POST /api/chat/conversations/:conversationId/mark-read
 * @desc    Mark messages as read
 * @access  Private
 */
async function markAsRead(req, res) {
  try {
    const userId = req.user._id || req.user.uid;
    const { conversationId } = req.params;
    const { messageIds = [] } = req.body;

    const result = await chatService.markMessagesAsRead(conversationId, userId, messageIds);

    // Update badge count
    const User = require('../models/User');
    const user = await User.findById(userId);
    if (user) {
      await notificationService.updateUnreadBadgeCount(userId, user.unreadMessageCount);
    }

    res.status(200).json({
      success: true,
      message: 'Messages marked as read',
      data: result
    });
  } catch (error) {
    console.error('Error in markAsRead:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to mark messages as read',
      error: error.message
    });
  }
}

/**
 * @route   PATCH /api/chat/messages/:messageId
 * @desc    Edit a message
 * @access  Private
 */
async function editMessage(req, res) {
  try {
    const userId = req.user._id || req.user.uid;
    const { messageId } = req.params;
    const { text } = req.body;

    const message = await chatService.editMessage(messageId, userId, text);

    res.status(200).json({
      success: true,
      data: {
        messageId: message.messageId,
        text: message.text,
        isEdited: message.isEdited,
        editedAt: message.editedAt
      }
    });
  } catch (error) {
    console.error('Error in editMessage:', error);
    const statusCode = error.message === 'Message not found' ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to edit message',
      error: error.message
    });
  }
}

/**
 * @route   DELETE /api/chat/messages/:messageId
 * @desc    Delete a message (soft delete)
 * @access  Private
 */
async function deleteMessage(req, res) {
  try {
    const userId = req.user._id || req.user.uid;
    const { messageId } = req.params;
    const { reason } = req.body;

    await chatService.deleteMessage(messageId, userId, reason);

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteMessage:', error);
    const statusCode = error.message === 'Message not found' ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to delete message',
      error: error.message
    });
  }
}

/**
 * @route   POST /api/chat/messages/:messageId/report
 * @desc    Report a message
 * @access  Private
 */
async function reportMessage(req, res) {
  try {
    const userId = req.user._id || req.user.uid;
    const { messageId } = req.params;
    const { reason, description } = req.body;

    const report = await chatService.reportMessage(messageId, userId, reason, description);

    // Notify admin
    await notificationService.notifyAdminOfReport({
      reportId: report.reportId,
      reportReason: report.reportReason,
      reportedBy: userId
    });

    res.status(201).json({
      success: true,
      message: 'Message reported successfully',
      data: {
        reportId: report.reportId,
        status: report.status
      }
    });
  } catch (error) {
    console.error('Error in reportMessage:', error);
    const statusCode = error.message === 'Message not found' ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to report message',
      error: error.message
    });
  }
}

/**
 * @route   GET /api/chat/my-referrals
 * @desc    Get user's referrals for chat
 * @access  Private
 */
async function getMyReferrals(req, res) {
  try {
    const userId = req.user._id || req.user.uid;
    const { search } = req.query;

    const referrals = await conversationService.getMyReferralsForChat(userId, search);

    res.status(200).json({
      success: true,
      data: {
        referrals
      }
    });
  } catch (error) {
    console.error('Error in getMyReferrals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch referrals',
      error: error.message
    });
  }
}

/**
 * @route   GET /api/chat/poll
 * @desc    Poll for new messages
 * @access  Private
 */
async function pollMessages(req, res) {
  try {
    const userId = req.user._id || req.user.uid;
    const { lastPollTime, conversationId } = req.query;

    const result = await chatService.pollNewMessages(userId, lastPollTime, conversationId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in pollMessages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to poll messages',
      error: error.message
    });
  }
}

/**
 * @route   GET /api/chat/search
 * @desc    Search messages
 * @access  Private
 */
async function searchMessages(req, res) {
  try {
    const userId = req.user._id || req.user.uid;
    const { query, conversationId, messageType } = req.query;

    const results = await chatService.searchMessages(
      userId,
      query,
      { conversationId, messageType }
    );

    res.status(200).json({
      success: true,
      data: {
        results
      }
    });
  } catch (error) {
    console.error('Error in searchMessages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search messages',
      error: error.message
    });
  }
}

module.exports = {
  getConversations,
  getMessages,
  sendMessage,
  createIndividualConversation,
  createGroupBroadcast,
  markAsRead,
  editMessage,
  deleteMessage,
  reportMessage,
  getMyReferrals,
  pollMessages,
  searchMessages
};
