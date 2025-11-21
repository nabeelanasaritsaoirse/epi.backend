/**
 * Admin Chat Controller
 * Handles all admin chat moderation endpoints
 */

const moderationService = require('../services/moderationService');

/**
 * @route   GET /api/admin/chat/conversations
 * @desc    Get all conversations (admin view)
 * @access  Admin
 */
async function getAllConversations(req, res) {
  try {
    const { search, type, page = 1, limit = 20 } = req.query;

    const result = await moderationService.getAllConversationsAdmin({
      search,
      type,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in getAllConversations (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations',
      error: error.message
    });
  }
}

/**
 * @route   GET /api/admin/chat/conversations/:conversationId/messages
 * @desc    View conversation messages (admin view - includes deleted)
 * @access  Admin
 */
async function getConversationMessages(req, res) {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const result = await moderationService.getConversationMessagesAdmin(
      conversationId,
      { page: parseInt(page), limit: parseInt(limit) }
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in getConversationMessages (admin):', error);
    const statusCode = error.message === 'Conversation not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch messages',
      error: error.message
    });
  }
}

/**
 * @route   GET /api/admin/chat/reports
 * @desc    Get reported messages
 * @access  Admin
 */
async function getReportedMessages(req, res) {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const result = await moderationService.getReportedMessages({
      status,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in getReportedMessages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reported messages',
      error: error.message
    });
  }
}

/**
 * @route   POST /api/admin/chat/reports/:reportId/action
 * @desc    Take action on a report
 * @access  Admin
 */
async function takeActionOnReport(req, res) {
  try {
    const adminId = req.user._id || req.user.uid;
    const { reportId } = req.params;
    const { action, adminNotes, deleteMessage = false } = req.body;

    const report = await moderationService.takeActionOnReport(
      reportId,
      adminId,
      action,
      adminNotes,
      deleteMessage
    );

    res.status(200).json({
      success: true,
      message: 'Action taken successfully',
      data: {
        reportId: report.reportId,
        status: report.status,
        action: report.adminAction
      }
    });
  } catch (error) {
    console.error('Error in takeActionOnReport:', error);
    const statusCode = error.message === 'Report not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to take action on report',
      error: error.message
    });
  }
}

/**
 * @route   DELETE /api/admin/chat/messages/:messageId
 * @desc    Delete message by admin
 * @access  Admin
 */
async function deleteMessage(req, res) {
  try {
    const adminId = req.user._id || req.user.uid;
    const { messageId } = req.params;
    const { reason } = req.body;

    await moderationService.deleteMessageByAdmin(messageId, adminId, reason);

    res.status(200).json({
      success: true,
      message: 'Message deleted by admin'
    });
  } catch (error) {
    console.error('Error in deleteMessage (admin):', error);
    const statusCode = error.message === 'Message not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to delete message',
      error: error.message
    });
  }
}

/**
 * @route   POST /api/admin/chat/broadcast
 * @desc    Send broadcast to all users
 * @access  Admin
 */
async function sendBroadcast(req, res) {
  try {
    const adminId = req.user._id || req.user.uid;
    const { messageType, text, productId, targetUsers, specificUserIds } = req.body;

    const result = await moderationService.sendAdminBroadcast(
      adminId,
      { messageType, text, productId },
      targetUsers,
      specificUserIds
    );

    res.status(200).json({
      success: true,
      message: 'Broadcast sent successfully',
      data: result
    });
  } catch (error) {
    console.error('Error in sendBroadcast:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send broadcast',
      error: error.message
    });
  }
}

/**
 * @route   GET /api/admin/chat/analytics
 * @desc    Get chat analytics
 * @access  Admin
 */
async function getChatAnalytics(req, res) {
  try {
    const { startDate, endDate } = req.query;

    const analytics = await moderationService.getChatAnalytics(startDate, endDate);

    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error in getChatAnalytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
}

module.exports = {
  getAllConversations,
  getConversationMessages,
  getReportedMessages,
  takeActionOnReport,
  deleteMessage,
  sendBroadcast,
  getChatAnalytics
};
