/**
 * Conversation Service
 * Handles all conversation-related business logic
 */

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const {
  generateConversationId,
  formatConversationForList,
  checkReferralRelationship
} = require('../utils/chatHelpers');

/**
 * Get all conversations for a user with pagination
 * @param {string} userId - User ID
 * @param {string} type - Conversation type filter (optional)
 * @param {Object} pagination - { page, limit }
 * @returns {Promise<Object>} Conversations with pagination info
 */
async function getUserConversations(userId, type = null, pagination = { page: 1, limit: 20 }) {
  const { page, limit } = pagination;
  const skip = (page - 1) * limit;

  // Build query
  const query = {
    isActive: true,
    $or: [
      { participants: userId },
      { groupMembers: userId }
    ]
  };

  if (type) {
    query.type = type;
  }

  // Get total count
  const total = await Conversation.countDocuments(query);

  // Get conversations with populated participants
  const conversations = await Conversation.find(query)
    .populate('participants', 'name email profilePicture')
    .populate('groupOwnerId', 'name profilePicture')
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit);

  // Format conversations for response
  const formattedConversations = conversations.map(conv =>
    formatConversationForList(conv, userId)
  );

  // Calculate total unread count
  const totalUnreadCount = await User.findById(userId).select('unreadMessageCount');

  return {
    conversations: formattedConversations,
    pagination: {
      page,
      limit,
      totalConversations: total,
      totalPages: Math.ceil(total / limit)
    },
    totalUnreadCount: totalUnreadCount ? totalUnreadCount.unreadMessageCount : 0
  };
}

/**
 * Get conversation by ID with permission check
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID (for permission check)
 * @returns {Promise<Object>} Conversation object
 */
async function getConversationById(conversationId, userId) {
  const conversation = await Conversation.findOne({ conversationId })
    .populate('participants', 'name email profilePicture')
    .populate('groupOwnerId', 'name profilePicture')
    .populate('groupMembers', 'name profilePicture');

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Check if user is participant
  const isParticipant = isUserInConversation(conversation, userId);
  if (!isParticipant) {
    throw new Error('Unauthorized access to conversation');
  }

  return conversation;
}

/**
 * Create individual conversation between two users
 * @param {string} userId1 - First user ID (current user)
 * @param {string} userId2 - Second user ID
 * @returns {Promise<Object>} Created or existing conversation
 */
async function createIndividualConversation(userId1, userId2) {
  // Check if users have referral relationship
  const relationship = await checkReferralRelationship(userId1, userId2);
  if (!relationship) {
    throw new Error('No referral relationship exists between users');
  }

  // Check if conversation already exists
  const existingConv = await Conversation.findOne({
    type: 'INDIVIDUAL',
    participants: { $all: [userId1, userId2] }
  });

  if (existingConv) {
    return {
      conversation: existingConv,
      isNewConversation: false
    };
  }

  // Determine referrer and referred user
  let referrerId, referredUserId;
  if (relationship.direction === 'user1_to_user2') {
    referrerId = userId1;
    referredUserId = userId2;
  } else {
    referrerId = userId2;
    referredUserId = userId1;
  }

  // Create new conversation
  const conversationId = await generateConversationId();
  const conversation = new Conversation({
    conversationId,
    type: 'INDIVIDUAL',
    participants: [userId1, userId2],
    referrerId,
    referredUserId,
    unreadCounts: [
      { userId: userId1, count: 0 },
      { userId: userId2, count: 0 }
    ],
    createdBy: userId1,
    isActive: true
  });

  await conversation.save();

  return {
    conversation,
    isNewConversation: true
  };
}

/**
 * Create group broadcast conversation
 * @param {string} ownerId - Group owner ID (referrer)
 * @param {Array<string>} memberIds - Array of member user IDs (all must be referrals)
 * @param {string} groupName - Group name
 * @returns {Promise<Object>} Created conversation
 */
async function createGroupBroadcast(ownerId, memberIds, groupName = 'My Referrals') {
  // Validate max 50 members
  if (memberIds.length > 50) {
    throw new Error('Maximum 50 members allowed in group broadcast');
  }

  // Verify all members are direct referrals of owner
  const User = require('../models/User');
  const owner = await User.findById(ownerId);
  if (!owner) {
    throw new Error('Owner not found');
  }

  // Check each member is a direct referral
  for (const memberId of memberIds) {
    const relationship = await checkReferralRelationship(ownerId, memberId);
    if (!relationship) {
      throw new Error(`User ${memberId} is not a direct referral`);
    }
  }

  // Check if similar group already exists
  const existingGroup = await Conversation.findOne({
    type: 'GROUP_BROADCAST',
    groupOwnerId: ownerId,
    groupMembers: { $all: memberIds }
  });

  if (existingGroup) {
    throw new Error('Similar group broadcast already exists');
  }

  // Create group broadcast
  const conversationId = await generateConversationId();
  const unreadCounts = memberIds.map(memberId => ({
    userId: memberId,
    count: 0
  }));

  const conversation = new Conversation({
    conversationId,
    type: 'GROUP_BROADCAST',
    groupOwnerId: ownerId,
    groupMembers: memberIds,
    groupName: groupName || 'My Referrals',
    unreadCounts,
    createdBy: ownerId,
    isActive: true
  });

  await conversation.save();
  await conversation.populate('groupMembers', 'name profilePicture');

  return conversation;
}

/**
 * Update last message in conversation
 * @param {string} conversationId - Conversation ID
 * @param {Object} messageData - Message data
 * @returns {Promise<Object>} Updated conversation
 */
async function updateLastMessage(conversationId, messageData) {
  const conversation = await Conversation.findOne({ conversationId });
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  conversation.lastMessage = {
    messageId: messageData._id,
    senderId: messageData.senderId,
    text: messageData.text ? messageData.text.substring(0, 100) : '',
    messageType: messageData.messageType,
    timestamp: messageData.createdAt
  };

  conversation.updatedAt = new Date();
  await conversation.save();

  return conversation;
}

/**
 * Increment unread count for specific users in a conversation
 * @param {string} conversationId - Conversation ID
 * @param {Array<string>} userIds - Array of user IDs to increment
 * @returns {Promise<void>}
 */
async function incrementUnreadCount(conversationId, userIds) {
  const conversation = await Conversation.findOne({ conversationId });
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Increment unread count for each user
  for (const userId of userIds) {
    const unreadEntry = conversation.unreadCounts.find(
      u => u.userId.toString() === userId.toString()
    );

    if (unreadEntry) {
      unreadEntry.count += 1;
    } else {
      conversation.unreadCounts.push({ userId, count: 1 });
    }

    // Also increment user's total unread count
    await User.findByIdAndUpdate(userId, {
      $inc: { unreadMessageCount: 1 }
    });
  }

  await conversation.save();
}

/**
 * Reset unread count for a user in a conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID
 * @returns {Promise<number>} Previous unread count
 */
async function resetUnreadCount(conversationId, userId) {
  const conversation = await Conversation.findOne({ conversationId });
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const unreadEntry = conversation.unreadCounts.find(
    u => u.userId.toString() === userId.toString()
  );

  let previousCount = 0;
  if (unreadEntry) {
    previousCount = unreadEntry.count;
    unreadEntry.count = 0;
  }

  await conversation.save();

  // Decrement user's total unread count
  if (previousCount > 0) {
    await User.findByIdAndUpdate(userId, {
      $inc: { unreadMessageCount: -previousCount }
    });
  }

  return previousCount;
}

/**
 * Get all participants of a conversation
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Array>} Array of user IDs
 */
async function getConversationParticipants(conversationId) {
  const conversation = await Conversation.findOne({ conversationId });
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (conversation.type === 'INDIVIDUAL') {
    return conversation.participants.map(p => p.toString());
  } else {
    return conversation.groupMembers.map(m => m.toString());
  }
}

/**
 * Check if user is in conversation
 * @param {Object} conversation - Conversation object
 * @param {string} userId - User ID
 * @returns {boolean} True if user is participant
 */
function isUserInConversation(conversation, userId) {
  if (conversation.type === 'INDIVIDUAL') {
    return conversation.participants.some(
      p => p._id.toString() === userId.toString()
    );
  } else if (conversation.type === 'GROUP_BROADCAST') {
    // Owner is also considered a participant
    if (conversation.groupOwnerId.toString() === userId.toString()) {
      return true;
    }
    return conversation.groupMembers.some(
      m => m.toString() === userId.toString()
    );
  }
  return false;
}

/**
 * Get user's direct referrals for chat
 * @param {string} userId - User ID
 * @param {string} searchQuery - Search query (optional)
 * @returns {Promise<Array>} Array of referral users
 */
async function getMyReferralsForChat(userId, searchQuery = null) {
  const Referral = require('../models/Referral');

  // Get all referrals where user is the referrer
  const query = { referrer: userId, status: { $in: ['ACTIVE', 'COMPLETED'] } };
  const referrals = await Referral.find(query)
    .populate('referredUser', 'name profilePicture email')
    .sort({ createdAt: -1 });

  const referralUsers = await Promise.all(referrals.map(async (ref) => {
    if (!ref.referredUser) return null;

    // Check if conversation exists
    const conversation = await Conversation.findOne({
      type: 'INDIVIDUAL',
      participants: { $all: [userId, ref.referredUser._id] }
    });

    // Apply search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      if (!ref.referredUser.name.toLowerCase().includes(searchLower)) {
        return null;
      }
    }

    return {
      userId: ref.referredUser._id,
      name: ref.referredUser.name,
      avatar: ref.referredUser.profilePicture || '',
      referredAt: ref.createdAt,
      hasActiveConversation: !!conversation,
      conversationId: conversation ? conversation.conversationId : null,
      totalOrders: ref.totalPurchases || 0,
      isBlocked: false // Can be enhanced
    };
  }));

  // Filter out null entries
  return referralUsers.filter(u => u !== null);
}

module.exports = {
  getUserConversations,
  getConversationById,
  createIndividualConversation,
  createGroupBroadcast,
  updateLastMessage,
  incrementUnreadCount,
  resetUnreadCount,
  getConversationParticipants,
  isUserInConversation,
  getMyReferralsForChat
};
