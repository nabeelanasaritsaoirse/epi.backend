/**
 * Chat Service
 * Handles all messaging-related business logic
 */

const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const MessageReport = require('../models/MessageReport');
const {
  generateMessageId,
  generateReportId,
  sanitizeMessageText,
  formatMessageForResponse,
  canUserSendMessage,
  truncateText
} = require('../utils/chatHelpers');
const {
  updateLastMessage,
  incrementUnreadCount,
  resetUnreadCount,
  getConversationParticipants,
  getConversationById
} = require('./conversationService');

/**
 * Send a message in a conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} senderId - Sender user ID
 * @param {Object} messageData - Message content
 * @returns {Promise<Object>} Created message
 */
async function sendMessage(conversationId, senderId, messageData) {
  const { messageType, text, productId, orderId, replyToMessageId } = messageData;

  // Verify user can send message
  const canSend = await canUserSendMessage(senderId, conversationId);
  if (!canSend.canSend) {
    throw new Error(canSend.reason);
  }

  // Get conversation
  const conversation = await Conversation.findOne({ conversationId });
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Get sender details
  const sender = await User.findById(senderId);
  if (!sender) {
    throw new Error('Sender not found');
  }

  // Build message object
  const messageId = await generateMessageId();
  const newMessage = {
    messageId,
    conversationId: conversation._id,
    senderId,
    senderName: sender.name,
    senderAvatar: sender.profilePicture || '',
    messageType,
    deliveryStatus: [],
    isDeleted: false
  };

  // Handle different message types
  if (messageType === 'TEXT') {
    if (!text || text.trim().length === 0) {
      throw new Error('Text message cannot be empty');
    }
    newMessage.text = sanitizeMessageText(text);
  } else if (messageType === 'PRODUCT_SHARE') {
    // Validate and fetch product
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    newMessage.sharedProduct = {
      productId: product._id,
      productName: product.name,
      productImage: product.images && product.images.length > 0 ? product.images[0].url : '',
      productPrice: product.pricing.finalPrice || product.pricing.regularPrice,
      productUrl: `/products/${product.productId}`
    };

    newMessage.text = text ? sanitizeMessageText(text) : `Shared product: ${product.name}`;
  } else if (messageType === 'ORDER_SHARE') {
    // Validate and fetch order
    const order = await Order.findById(orderId).populate('product');
    if (!order) {
      throw new Error('Order not found');
    }

    // Verify sender owns the order
    if (order.user.toString() !== senderId.toString()) {
      throw new Error('You can only share your own orders');
    }

    newMessage.sharedOrder = {
      orderId: order._id,
      orderNumber: order._id.toString().slice(-8).toUpperCase(),
      productName: order.product ? order.product.name : 'Product',
      orderStatus: order.orderStatus,
      orderUrl: `/orders/${order._id}`
    };

    newMessage.text = text ? sanitizeMessageText(text) : `Shared order #${newMessage.sharedOrder.orderNumber}`;
  }

  // Handle reply
  if (replyToMessageId) {
    const replyToMessage = await Message.findOne({ messageId: replyToMessageId });
    if (replyToMessage && replyToMessage.conversationId.toString() === conversation._id.toString()) {
      newMessage.replyTo = {
        messageId: replyToMessage._id,
        text: truncateText(replyToMessage.text, 100),
        senderId: replyToMessage.senderId
      };
    }
  }

  // Determine recipients and set delivery status
  let recipients = [];
  if (conversation.type === 'INDIVIDUAL') {
    recipients = conversation.participants.filter(
      p => p.toString() !== senderId.toString()
    );
  } else if (conversation.type === 'GROUP_BROADCAST') {
    recipients = conversation.groupMembers.filter(
      m => m.toString() !== senderId.toString()
    );
  }

  // Set delivery status for all recipients
  newMessage.deliveryStatus = recipients.map(recipientId => ({
    userId: recipientId,
    status: 'SENT',
    deliveredAt: new Date()
  }));

  // Create message
  const message = new Message(newMessage);
  await message.save();

  // Update conversation's last message
  await updateLastMessage(conversationId, message);

  // Increment unread count for recipients
  if (recipients.length > 0) {
    await incrementUnreadCount(conversationId, recipients);
  }

  return message;
}

/**
 * Edit a message
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID
 * @param {string} newText - New message text
 * @returns {Promise<Object>} Updated message
 */
async function editMessage(messageId, userId, newText) {
  const message = await Message.findOne({ messageId });
  if (!message) {
    throw new Error('Message not found');
  }

  // Check if user can edit
  if (!message.canEdit(userId)) {
    if (message.senderId.toString() !== userId.toString()) {
      throw new Error('You can only edit your own messages');
    }
    if (message.messageType !== 'TEXT') {
      throw new Error('Only text messages can be edited');
    }
    if (message.isDeleted) {
      throw new Error('Deleted messages cannot be edited');
    }

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (message.createdAt < fifteenMinutesAgo) {
      throw new Error('Messages older than 15 minutes cannot be edited');
    }
  }

  // Update message
  message.text = sanitizeMessageText(newText);
  message.isEdited = true;
  message.editedAt = new Date();
  await message.save();

  // Update last message if this is the last one
  const conversation = await Conversation.findById(message.conversationId);
  if (conversation.lastMessage &&
      conversation.lastMessage.messageId.toString() === message._id.toString()) {
    await updateLastMessage(conversation.conversationId, message);
  }

  return message;
}

/**
 * Delete a message (soft delete)
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID
 * @param {string} reason - Delete reason (optional)
 * @returns {Promise<Object>} Deleted message
 */
async function deleteMessage(messageId, userId, reason = null) {
  const message = await Message.findOne({ messageId });
  if (!message) {
    throw new Error('Message not found');
  }

  // Check if user can delete
  if (!message.canDelete(userId)) {
    if (message.senderId.toString() !== userId.toString()) {
      throw new Error('You can only delete your own messages');
    }
    if (message.isDeleted) {
      throw new Error('Message already deleted');
    }
  }

  // Soft delete
  message.isDeleted = true;
  message.deletedAt = new Date();
  message.deletedBy = userId;
  if (reason) {
    message.deleteReason = reason;
  }
  await message.save();

  return message;
}

/**
 * Mark messages as read
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID
 * @param {Array<string>} messageIds - Array of message IDs (empty to mark all)
 * @returns {Promise<Object>} Result with count
 */
async function markMessagesAsRead(conversationId, userId, messageIds = []) {
  const conversation = await Conversation.findOne({ conversationId });
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Build query
  const query = {
    conversationId: conversation._id,
    senderId: { $ne: userId },
    isDeleted: false,
    'deliveryStatus.userId': userId,
    'deliveryStatus.status': { $ne: 'READ' }
  };

  if (messageIds && messageIds.length > 0) {
    query.messageId = { $in: messageIds };
  }

  // Find messages
  const messages = await Message.find(query);

  let markedCount = 0;
  for (const message of messages) {
    const statusEntry = message.deliveryStatus.find(
      s => s.userId.toString() === userId.toString()
    );

    if (statusEntry && statusEntry.status !== 'READ') {
      statusEntry.status = 'READ';
      statusEntry.readAt = new Date();
      await message.save();
      markedCount++;
    }
  }

  // Reset unread count for this conversation
  const previousCount = await resetUnreadCount(conversationId, userId);

  return {
    markedCount,
    previousUnreadCount: previousCount,
    updatedUnreadCount: 0
  };
}

/**
 * Get messages from a conversation with pagination
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID
 * @param {Object} pagination - { page, limit, beforeMessageId }
 * @returns {Promise<Object>} Messages with pagination
 */
async function getConversationMessages(conversationId, userId, pagination = {}) {
  const { page = 1, limit = 20, beforeMessageId } = pagination;

  // Verify user has access
  const conversation = await getConversationById(conversationId, userId);

  // Build query
  const query = {
    conversationId: conversation._id
  };

  // Cursor-based pagination (for loading older messages)
  if (beforeMessageId) {
    const beforeMessage = await Message.findOne({ messageId: beforeMessageId });
    if (beforeMessage) {
      query.createdAt = { $lt: beforeMessage.createdAt };
    }
  }

  // Get messages
  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(limit);

  // Format messages
  const formattedMessages = messages.map(msg =>
    formatMessageForResponse(msg, userId)
  ).reverse(); // Reverse to show oldest first

  // Check if more messages exist
  let hasMore = false;
  if (messages.length > 0) {
    const oldestMessage = messages[messages.length - 1];
    const olderCount = await Message.countDocuments({
      conversationId: conversation._id,
      createdAt: { $lt: oldestMessage.createdAt }
    });
    hasMore = olderCount > 0;
  }

  // Can user send message
  const canSend = await canUserSendMessage(userId, conversationId);

  return {
    conversation: {
      conversationId: conversation.conversationId,
      type: conversation.type,
      participants: conversation.participants,
      canSendMessage: canSend.canSend
    },
    messages: formattedMessages,
    pagination: {
      page,
      limit,
      hasMore,
      oldestMessageId: messages.length > 0 ? messages[messages.length - 1].messageId : null
    }
  };
}

/**
 * Poll for new messages
 * @param {string} userId - User ID
 * @param {Date} lastPollTime - Last poll timestamp
 * @param {string} conversationId - Specific conversation ID (optional)
 * @returns {Promise<Object>} New messages and counts
 */
async function pollNewMessages(userId, lastPollTime, conversationId = null) {
  // Get user's conversations
  const conversationQuery = {
    isActive: true,
    $or: [
      { participants: userId },
      { groupMembers: userId }
    ]
  };

  if (conversationId) {
    conversationQuery.conversationId = conversationId;
  }

  const conversations = await Conversation.find(conversationQuery);
  const conversationIds = conversations.map(c => c._id);

  // Find new messages since last poll
  const newMessages = await Message.find({
    conversationId: { $in: conversationIds },
    createdAt: { $gt: new Date(lastPollTime) },
    isDeleted: false
  }).sort({ createdAt: 1 });

  // Group by conversation
  const conversationsWithNewMessages = {};
  for (const message of newMessages) {
    const convId = message.conversationId.toString();
    if (!conversationsWithNewMessages[convId]) {
      conversationsWithNewMessages[convId] = [];
    }
    conversationsWithNewMessages[convId].push(formatMessageForResponse(message, userId));
  }

  // Build response
  const result = {
    hasNewMessages: newMessages.length > 0,
    newMessagesCount: newMessages.length,
    conversations: [],
    totalUnreadCount: 0
  };

  // Get updated unread count
  const user = await User.findById(userId).select('unreadMessageCount');
  result.totalUnreadCount = user ? user.unreadMessageCount : 0;

  // Add conversation data
  for (const conversation of conversations) {
    const convId = conversation._id.toString();
    const conv = conversations.find(c => c._id.toString() === convId);

    if (conversationsWithNewMessages[convId]) {
      result.conversations.push({
        conversationId: conv.conversationId,
        newMessages: conversationsWithNewMessages[convId],
        updatedUnreadCount: conv.getUnreadCountForUser(userId)
      });
    }
  }

  return result;
}

/**
 * Search messages
 * @param {string} userId - User ID
 * @param {string} query - Search query
 * @param {Object} filters - { conversationId, messageType }
 * @returns {Promise<Array>} Search results
 */
async function searchMessages(userId, query, filters = {}) {
  const { conversationId, messageType } = filters;

  // Get user's conversations
  const conversationQuery = {
    isActive: true,
    $or: [
      { participants: userId },
      { groupMembers: userId }
    ]
  };

  if (conversationId) {
    conversationQuery.conversationId = conversationId;
  }

  const conversations = await Conversation.find(conversationQuery);
  const conversationIds = conversations.map(c => c._id);

  // Build search query
  const searchQuery = {
    conversationId: { $in: conversationIds },
    isDeleted: false,
    text: new RegExp(query, 'i')
  };

  if (messageType) {
    searchQuery.messageType = messageType;
  }

  // Search messages
  const messages = await Message.find(searchQuery)
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('senderId', 'name profilePicture');

  // Format results
  const results = messages.map(message => {
    const conv = conversations.find(c => c._id.toString() === message.conversationId.toString());

    // Highlight matched text
    const matchedText = message.text.replace(
      new RegExp(query, 'gi'),
      match => `<mark>${match}</mark>`
    );

    return {
      messageId: message.messageId,
      conversationId: conv ? conv.conversationId : null,
      text: message.text,
      matchedText: truncateText(matchedText, 200),
      sender: {
        userId: message.senderId._id,
        name: message.senderId.name,
        avatar: message.senderId.profilePicture || ''
      },
      messageType: message.messageType,
      createdAt: message.createdAt
    };
  });

  return results;
}

/**
 * Report a message
 * @param {string} messageId - Message ID
 * @param {string} reportedBy - Reporter user ID
 * @param {string} reason - Report reason
 * @param {string} description - Report description
 * @returns {Promise<Object>} Created report
 */
async function reportMessage(messageId, reportedBy, reason, description) {
  const message = await Message.findOne({ messageId });
  if (!message) {
    throw new Error('Message not found');
  }

  // Cannot report own messages
  if (message.senderId.toString() === reportedBy.toString()) {
    throw new Error('You cannot report your own messages');
  }

  // Check if already reported by this user
  const existingReport = await MessageReport.findOne({
    messageId: message._id,
    reportedBy
  });

  if (existingReport) {
    throw new Error('You have already reported this message');
  }

  // Create report
  const reportId = generateReportId();
  const report = new MessageReport({
    reportId,
    messageId: message._id,
    conversationId: message.conversationId,
    reportedBy,
    reportReason: reason,
    reportDescription: description,
    reportedUser: message.senderId,
    status: 'PENDING'
  });

  await report.save();

  return report;
}

module.exports = {
  sendMessage,
  editMessage,
  deleteMessage,
  markMessagesAsRead,
  getConversationMessages,
  pollNewMessages,
  searchMessages,
  reportMessage
};
