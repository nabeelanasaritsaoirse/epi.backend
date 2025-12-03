/**
 * Chat Helper Utilities
 * Provides utility functions for the messaging system
 */

const xss = require('xss');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const Referral = require('../models/Referral');

/**
 * Generate unique conversation ID
 * Format: CONV-YYYYMMDD-XXXX
 * @returns {Promise<string>} Unique conversation ID
 */
async function generateConversationId() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const datePrefix = `CONV-${year}${month}${day}`;

  // Find the last conversation created today
  const lastConv = await Conversation.findOne({
    conversationId: new RegExp(`^${datePrefix}`)
  }).sort({ conversationId: -1 });

  let sequence = 1;
  if (lastConv) {
    const lastSequence = parseInt(lastConv.conversationId.split('-')[2]);
    sequence = lastSequence + 1;
  }

  return `${datePrefix}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Generate unique message ID
 * Format: MSG-YYYYMMDD-XXXX
 * @returns {Promise<string>} Unique message ID
 */
async function generateMessageId() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const datePrefix = `MSG-${year}${month}${day}`;

  // Find the last message created today
  const lastMsg = await Message.findOne({
    messageId: new RegExp(`^${datePrefix}`)
  }).sort({ messageId: -1 });

  let sequence = 1;
  if (lastMsg) {
    const lastSequence = parseInt(lastMsg.messageId.split('-')[2]);
    sequence = lastSequence + 1;
  }

  return `${datePrefix}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Generate unique report ID
 * Format: REP-YYYYMMDD-XXXX
 * @returns {string} Unique report ID
 */
function generateReportId() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000);

  return `REP-${year}${month}${day}-${String(random).padStart(4, '0')}`;
}

/**
 * Sanitize message text to prevent XSS attacks
 * @param {string} text - Raw text input
 * @returns {string} Sanitized text
 */
function sanitizeMessageText(text) {
  if (!text) return '';

  // Configure XSS options - allow basic formatting but remove dangerous tags
  const options = {
    whiteList: {
      b: [],
      i: [],
      u: [],
      br: [],
      p: [],
      strong: [],
      em: []
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style']
  };

  // Sanitize and trim
  let sanitized = xss(text, options);
  sanitized = sanitized.trim();

  // Limit length
  if (sanitized.length > 5000) {
    sanitized = sanitized.substring(0, 5000);
  }

  return sanitized;
}

/**
 * Check if two users have a referral relationship (bidirectional)
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @returns {Promise<Object|null>} Referral object if relationship exists, null otherwise
 */
async function checkReferralRelationship(userId1, userId2) {
  // First, check the Referral collection
  // Check if userId1 referred userId2
  let referral = await Referral.findOne({
    referrer: userId1,
    referredUser: userId2
  });

  if (referral) {
    return { referral, direction: 'user1_to_user2' };
  }

  // Check if userId2 referred userId1
  referral = await Referral.findOne({
    referrer: userId2,
    referredUser: userId1
  });

  if (referral) {
    return { referral, direction: 'user2_to_user1' };
  }

  // If no Referral document exists, check the User model's referredBy field
  const user1 = await User.findById(userId1).populate('referredBy');
  const user2 = await User.findById(userId2).populate('referredBy');

  if (!user1 || !user2) {
    return null;
  }

  // Check if user1 referred user2
  if (user2.referredBy && user2.referredBy._id.toString() === userId1.toString()) {
    return {
      referral: { referrer: userId1, referredUser: userId2 },
      direction: 'user1_to_user2',
      fromUserModel: true
    };
  }

  // Check if user2 referred user1
  if (user1.referredBy && user1.referredBy._id.toString() === userId2.toString()) {
    return {
      referral: { referrer: userId2, referredUser: userId1 },
      direction: 'user2_to_user1',
      fromUserModel: true
    };
  }

  return null;
}

/**
 * Format conversation for list view
 * @param {Object} conversation - Conversation document
 * @param {string} currentUserId - Current user's ID
 * @returns {Object} Formatted conversation object
 */
function formatConversationForList(conversation, currentUserId) {
  const formatted = {
    conversationId: conversation.conversationId,
    type: conversation.type,
    isActive: conversation.isActive,
    isMuted: conversation.isMutedForUser(currentUserId),
    unreadCount: conversation.getUnreadCountForUser(currentUserId),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt
  };

  // Add type-specific data
  if (conversation.type === 'INDIVIDUAL') {
    // Find the other participant
    const otherUserId = conversation.participants.find(
      p => p._id.toString() !== currentUserId.toString()
    );

    if (otherUserId && otherUserId.name) {
      formatted.otherUser = {
        userId: otherUserId._id,
        name: otherUserId.name,
        avatar: otherUserId.profilePicture || '',
        isOnline: false // Can be enhanced with real-time presence
      };
    }
  } else if (conversation.type === 'GROUP_BROADCAST') {
    formatted.groupName = conversation.groupName;
    formatted.memberCount = conversation.groupMembers ? conversation.groupMembers.length : 0;
    formatted.isOwner = conversation.groupOwnerId.toString() === currentUserId.toString();
  }

  // Add last message if exists
  if (conversation.lastMessage && conversation.lastMessage.messageId) {
    formatted.lastMessage = {
      text: conversation.lastMessage.text || '',
      timestamp: conversation.lastMessage.timestamp,
      senderId: conversation.lastMessage.senderId,
      messageType: conversation.lastMessage.messageType
    };
  }

  return formatted;
}

/**
 * Format message for API response
 * @param {Object} message - Message document
 * @param {string} currentUserId - Current user's ID
 * @returns {Object} Formatted message object
 */
function formatMessageForResponse(message, currentUserId) {
  // If message is deleted, show placeholder
  if (message.isDeleted) {
    return {
      messageId: message.messageId,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderName: message.senderName,
      messageType: 'TEXT',
      text: '[Message deleted]',
      isDeleted: true,
      deletedAt: message.deletedAt,
      createdAt: message.createdAt
    };
  }

  const formatted = {
    messageId: message.messageId,
    conversationId: message.conversationId,
    senderId: message.senderId,
    senderName: message.senderName,
    senderAvatar: message.senderAvatar || '',
    messageType: message.messageType,
    text: message.text || '',
    isEdited: message.isEdited,
    editedAt: message.editedAt,
    createdAt: message.createdAt
  };

  // Add delivery status for current user
  if (message.deliveryStatus && message.deliveryStatus.length > 0) {
    const userStatus = message.getDeliveryStatusForUser(currentUserId);
    formatted.deliveryStatus = userStatus.status;
    if (userStatus.readAt) {
      formatted.readAt = userStatus.readAt;
    }
    if (userStatus.deliveredAt) {
      formatted.deliveredAt = userStatus.deliveredAt;
    }
  }

  // Add shared product if exists
  if (message.sharedProduct && message.sharedProduct.productId) {
    formatted.sharedProduct = {
      productId: message.sharedProduct.productId,
      productName: message.sharedProduct.productName,
      productImage: message.sharedProduct.productImage,
      productPrice: message.sharedProduct.productPrice,
      productUrl: message.sharedProduct.productUrl
    };
  }

  // Add shared order if exists
  if (message.sharedOrder && message.sharedOrder.orderId) {
    formatted.sharedOrder = {
      orderId: message.sharedOrder.orderId,
      orderNumber: message.sharedOrder.orderNumber,
      productName: message.sharedOrder.productName,
      orderStatus: message.sharedOrder.orderStatus,
      orderUrl: message.sharedOrder.orderUrl
    };
  }

  // Add reply info if exists
  if (message.replyTo && message.replyTo.messageId) {
    formatted.replyTo = {
      messageId: message.replyTo.messageId,
      text: message.replyTo.text,
      senderId: message.replyTo.senderId
    };
  }

  return formatted;
}

/**
 * Calculate unread message count for a conversation and user
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID
 * @returns {Promise<number>} Unread count
 */
async function calculateUnreadCount(conversationId, userId) {
  const count = await Message.countDocuments({
    conversationId,
    senderId: { $ne: userId },
    isDeleted: false,
    'deliveryStatus.userId': userId,
    'deliveryStatus.status': { $ne: 'READ' }
  });

  return count;
}

/**
 * Check if a user is blocked by another user
 * @param {string} userId - User to check
 * @param {string} byUserId - User who might have blocked
 * @returns {Promise<boolean>} True if blocked
 */
async function isUserBlocked(userId, byUserId) {
  const user = await User.findById(byUserId);
  if (!user || !user.chatSettings || !user.chatSettings.blockedUsers) {
    return false;
  }

  return user.chatSettings.blockedUsers.some(
    blockedId => blockedId.toString() === userId.toString()
  );
}

/**
 * Check if a user can send messages in a conversation
 * @param {string} userId - User ID
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object>} { canSend: boolean, reason: string }
 */
async function canUserSendMessage(userId, conversationId) {
  const conversation = await Conversation.findOne({ conversationId });

  if (!conversation) {
    return { canSend: false, reason: 'Conversation not found' };
  }

  if (!conversation.isActive) {
    return { canSend: false, reason: 'Conversation is not active' };
  }

  // Check if user is participant
  if (conversation.type === 'INDIVIDUAL') {
    const isParticipant = conversation.participants.some(
      p => p.toString() === userId.toString()
    );

    if (!isParticipant) {
      return { canSend: false, reason: 'User is not a participant' };
    }

    // Check if other user blocked this user
    const otherUserId = conversation.participants.find(
      p => p.toString() !== userId.toString()
    );

    if (otherUserId) {
      const blocked = await isUserBlocked(userId, otherUserId.toString());
      if (blocked) {
        return { canSend: false, reason: 'You are blocked by this user' };
      }
    }
  } else if (conversation.type === 'GROUP_BROADCAST') {
    // Only group owner can send in broadcast groups
    if (conversation.groupOwnerId.toString() !== userId.toString()) {
      return { canSend: false, reason: 'Only group owner can send messages in broadcast' };
    }
  }

  return { canSend: true };
}

/**
 * Truncate text to specified length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

module.exports = {
  generateConversationId,
  generateMessageId,
  generateReportId,
  sanitizeMessageText,
  checkReferralRelationship,
  formatConversationForList,
  formatMessageForResponse,
  calculateUnreadCount,
  isUserBlocked,
  canUserSendMessage,
  truncateText
};
