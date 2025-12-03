/**
 * Moderation Service
 * Handles admin moderation and chat analytics
 */

const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const MessageReport = require('../models/MessageReport');
const User = require('../models/User');
const {
  generateMessageId,
  sanitizeMessageText,
  formatConversationForList
} = require('../utils/chatHelpers');
const { updateLastMessage, incrementUnreadCount } = require('./conversationService');

/**
 * Get all conversations (admin view)
 * @param {Object} filters - { search, type, page, limit }
 * @returns {Promise<Object>} Conversations with pagination
 */
async function getAllConversationsAdmin(filters = {}) {
  const { search, type, page = 1, limit = 20 } = filters;
  const skip = (page - 1) * limit;

  // Build query
  const query = {};
  if (type) {
    query.type = type;
  }

  // Search by participant name
  if (search) {
    const users = await User.find({
      name: new RegExp(search, 'i')
    }).select('_id');

    const userIds = users.map(u => u._id);
    query.$or = [
      { participants: { $in: userIds } },
      { groupMembers: { $in: userIds } }
    ];
  }

  const total = await Conversation.countDocuments(query);

  const conversations = await Conversation.find(query)
    .populate('participants', 'name email profilePicture phoneNumber')
    .populate('groupOwnerId', 'name email profilePicture')
    .populate('groupMembers', 'name email')
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit);

  // Format with additional admin data
  const formattedConversations = await Promise.all(conversations.map(async (conv) => {
    const messageCount = await Message.countDocuments({
      conversationId: conv._id
    });

    const reportCount = await MessageReport.countDocuments({
      conversationId: conv._id,
      status: 'PENDING'
    });

    return {
      conversationId: conv.conversationId,
      type: conv.type,
      participants: conv.participants,
      groupName: conv.groupName,
      groupOwnerId: conv.groupOwnerId,
      groupMembers: conv.groupMembers,
      messageCount,
      lastMessageAt: conv.lastMessage ? conv.lastMessage.timestamp : conv.updatedAt,
      hasReports: reportCount > 0,
      reportCount,
      isActive: conv.isActive,
      createdAt: conv.createdAt
    };
  }));

  return {
    conversations: formattedConversations,
    pagination: {
      page,
      limit,
      totalConversations: total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get conversation messages (admin view - includes deleted)
 * @param {string} conversationId - Conversation ID
 * @param {Object} pagination - { page, limit }
 * @returns {Promise<Object>} Messages with metadata
 */
async function getConversationMessagesAdmin(conversationId, pagination = {}) {
  const { page = 1, limit = 50 } = pagination;
  const skip = (page - 1) * limit;

  const conversation = await Conversation.findOne({ conversationId })
    .populate('participants', 'name email profilePicture')
    .populate('groupOwnerId', 'name email')
    .populate('groupMembers', 'name email');

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const total = await Message.countDocuments({
    conversationId: conversation._id
  });

  // Get messages (including deleted ones)
  const messages = await Message.find({
    conversationId: conversation._id
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('senderId', 'name email profilePicture');

  // Format messages (show deleted ones with full info for admin)
  const formattedMessages = messages.map(msg => ({
    messageId: msg.messageId,
    conversationId: conversation.conversationId,
    senderId: msg.senderId._id,
    senderName: msg.senderId.name,
    senderEmail: msg.senderId.email,
    senderAvatar: msg.senderId.profilePicture || '',
    messageType: msg.messageType,
    text: msg.text,
    isDeleted: msg.isDeleted,
    deletedAt: msg.deletedAt,
    deletedBy: msg.deletedBy,
    deleteReason: msg.deleteReason,
    isEdited: msg.isEdited,
    editedAt: msg.editedAt,
    sharedProduct: msg.sharedProduct,
    sharedOrder: msg.sharedOrder,
    deliveryStatus: msg.deliveryStatus,
    createdAt: msg.createdAt
  })).reverse();

  return {
    conversation: {
      conversationId: conversation.conversationId,
      type: conversation.type,
      participants: conversation.participants,
      groupOwnerId: conversation.groupOwnerId,
      groupMembers: conversation.groupMembers
    },
    messages: formattedMessages,
    pagination: {
      page,
      limit,
      totalMessages: total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get all reported messages
 * @param {Object} filters - { status, page, limit }
 * @returns {Promise<Object>} Reports with pagination
 */
async function getReportedMessages(filters = {}) {
  const { status, page = 1, limit = 20 } = filters;
  const skip = (page - 1) * limit;

  const query = {};
  if (status) {
    query.status = status;
  }

  const total = await MessageReport.countDocuments(query);

  const reports = await MessageReport.find(query)
    .populate('messageId')
    .populate('reportedBy', 'name email profilePicture')
    .populate('reportedUser', 'name email profilePicture')
    .populate('reviewedBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const formattedReports = reports.map(report => ({
    reportId: report.reportId,
    message: report.messageId ? {
      messageId: report.messageId.messageId,
      text: report.messageId.text,
      messageType: report.messageId.messageType,
      senderId: report.messageId.senderId,
      senderName: report.reportedUser.name,
      isDeleted: report.messageId.isDeleted
    } : null,
    reportedBy: {
      userId: report.reportedBy._id,
      name: report.reportedBy.name,
      email: report.reportedBy.email,
      avatar: report.reportedBy.profilePicture || ''
    },
    reportedUser: {
      userId: report.reportedUser._id,
      name: report.reportedUser.name,
      email: report.reportedUser.email
    },
    reason: report.reportReason,
    description: report.reportDescription,
    status: report.status,
    adminAction: report.adminAction,
    adminNotes: report.adminNotes,
    reviewedBy: report.reviewedBy ? {
      userId: report.reviewedBy._id,
      name: report.reviewedBy.name
    } : null,
    reviewedAt: report.reviewedAt,
    createdAt: report.createdAt
  }));

  return {
    reports: formattedReports,
    pagination: {
      page,
      limit,
      totalReports: total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Take action on a report
 * @param {string} reportId - Report ID
 * @param {string} adminId - Admin user ID
 * @param {string} action - Action to take
 * @param {string} notes - Admin notes
 * @param {boolean} deleteMessage - Whether to delete the message
 * @returns {Promise<Object>} Updated report
 */
async function takeActionOnReport(reportId, adminId, action, notes, deleteMessage = false) {
  const report = await MessageReport.findOne({ reportId });
  if (!report) {
    throw new Error('Report not found');
  }

  // Update report status
  await report.markAsReviewed(adminId, action, notes);

  // If action is to delete message, delete it
  if (deleteMessage || action === 'MESSAGE_DELETED') {
    const message = await Message.findById(report.messageId);
    if (message && !message.isDeleted) {
      message.isDeleted = true;
      message.deletedAt = new Date();
      message.deletedBy = adminId;
      message.deleteReason = `Admin action: ${notes}`;
      await message.save();
    }
  }

  return report;
}

/**
 * Delete message by admin
 * @param {string} messageId - Message ID
 * @param {string} adminId - Admin user ID
 * @param {string} reason - Deletion reason
 * @returns {Promise<Object>} Deleted message
 */
async function deleteMessageByAdmin(messageId, adminId, reason) {
  const message = await Message.findOne({ messageId });
  if (!message) {
    throw new Error('Message not found');
  }

  if (message.isDeleted) {
    throw new Error('Message already deleted');
  }

  message.isDeleted = true;
  message.deletedAt = new Date();
  message.deletedBy = adminId;
  message.deleteReason = reason;
  await message.save();

  return message;
}

/**
 * Send broadcast to all users
 * @param {string} adminId - Admin user ID
 * @param {Object} messageData - Message content
 * @param {string} targetUsers - 'ALL', 'ACTIVE_ORDERS', 'SPECIFIC'
 * @param {Array<string>} specificUserIds - Specific user IDs if targetUsers is 'SPECIFIC'
 * @returns {Promise<Object>} Broadcast result
 */
async function sendAdminBroadcast(adminId, messageData, targetUsers = 'ALL', specificUserIds = []) {
  const { messageType, text, productId } = messageData;

  // Determine target users
  let recipients = [];
  if (targetUsers === 'ALL') {
    const users = await User.find({ isActive: true }).select('_id');
    recipients = users.map(u => u._id);
  } else if (targetUsers === 'ACTIVE_ORDERS') {
    const Order = require('../models/Order');
    const orders = await Order.find({
      orderStatus: { $in: ['confirmed', 'pending'] }
    }).distinct('user');
    recipients = orders;
  } else if (targetUsers === 'SPECIFIC') {
    recipients = specificUserIds;
  }

  let successCount = 0;
  let failCount = 0;

  // Create individual messages for each user (system messages)
  for (const userId of recipients) {
    try {
      const messageId = await generateMessageId();
      const user = await User.findById(userId);
      if (!user) continue;

      const newMessage = {
        messageId,
        conversationId: null, // System broadcast, no conversation
        senderId: adminId,
        senderName: 'System Admin',
        senderAvatar: '',
        messageType: messageType || 'TEXT',
        text: sanitizeMessageText(text),
        deliveryStatus: [{
          userId,
          status: 'DELIVERED',
          deliveredAt: new Date()
        }]
      };

      // Add product if sharing
      if (messageType === 'PRODUCT_SHARE' && productId) {
        const Product = require('../models/Product');
        const product = await Product.findById(productId);
        if (product) {
          newMessage.sharedProduct = {
            productId: product._id,
            productName: product.name,
            productImage: product.images && product.images.length > 0 ? product.images[0].url : '',
            productPrice: product.pricing.finalPrice || product.pricing.regularPrice,
            productUrl: `/products/${product.productId}`
          };
        }
      }

      const message = new Message(newMessage);
      await message.save();

      // Increment user's unread count
      await User.findByIdAndUpdate(userId, {
        $inc: { unreadMessageCount: 1 }
      });

      successCount++;
    } catch (error) {
      console.error(`Failed to send broadcast to user ${userId}:`, error);
      failCount++;
    }
  }

  return {
    sentTo: successCount,
    failedTo: failCount,
    totalTargeted: recipients.length
  };
}

/**
 * Get chat analytics
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>} Analytics data
 */
async function getChatAnalytics(startDate, endDate) {
  const dateFilter = {};
  if (startDate) {
    dateFilter.$gte = new Date(startDate);
  }
  if (endDate) {
    dateFilter.$lte = new Date(endDate);
  }

  // Total conversations
  const totalConversations = await Conversation.countDocuments(
    startDate || endDate ? { createdAt: dateFilter } : {}
  );

  // Active conversations (with messages in date range)
  const activeConversations = await Message.distinct('conversationId', {
    createdAt: dateFilter
  });

  // Total messages
  const totalMessages = await Message.countDocuments({
    createdAt: dateFilter
  });

  // Messages by type
  const messagesByType = await Message.aggregate([
    { $match: { createdAt: dateFilter } },
    { $group: { _id: '$messageType', count: { $sum: 1 } } }
  ]);

  const messageTypeStats = {};
  messagesByType.forEach(item => {
    messageTypeStats[item._id] = item.count;
  });

  // Report statistics
  const totalReports = await MessageReport.countDocuments({
    createdAt: dateFilter
  });

  const pendingReports = await MessageReport.countDocuments({
    createdAt: dateFilter,
    status: 'PENDING'
  });

  const actionedReports = await MessageReport.countDocuments({
    createdAt: dateFilter,
    status: { $in: ['ACTIONED', 'DISMISSED'] }
  });

  // Top active users (by message count)
  const topActiveUsers = await Message.aggregate([
    { $match: { createdAt: dateFilter, isDeleted: false } },
    { $group: { _id: '$senderId', messageCount: { $sum: 1 } } },
    { $sort: { messageCount: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        userId: '$_id',
        name: '$user.name',
        email: '$user.email',
        messageCount: 1
      }
    }
  ]);

  // Average messages per conversation
  const avgMessagesPerConversation = totalConversations > 0
    ? Math.round(totalMessages / totalConversations)
    : 0;

  return {
    totalConversations,
    totalMessages,
    activeConversations: activeConversations.length,
    averageMessagesPerConversation: avgMessagesPerConversation,
    messagesByType: {
      TEXT: messageTypeStats.TEXT || 0,
      PRODUCT_SHARE: messageTypeStats.PRODUCT_SHARE || 0,
      ORDER_SHARE: messageTypeStats.ORDER_SHARE || 0,
      SYSTEM: messageTypeStats.SYSTEM || 0
    },
    reportStats: {
      totalReports,
      pendingReports,
      actionedReports
    },
    topActiveUsers
  };
}

module.exports = {
  getAllConversationsAdmin,
  getConversationMessagesAdmin,
  getReportedMessages,
  takeActionOnReport,
  deleteMessageByAdmin,
  sendAdminBroadcast,
  getChatAnalytics
};
