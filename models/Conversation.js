/**
 * Conversation Model
 * Manages both individual chats and group broadcasts for the messaging system
 *
 * Features:
 * - Individual 1-on-1 chats between referrer and referred user
 * - Group broadcast from referrer to all their referrals
 * - Tracks last message for chat list preview
 * - Unread count per participant
 * - Mute functionality
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const conversationSchema = new Schema({
  // Unique conversation identifier
  conversationId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Type of conversation
  type: {
    type: String,
    enum: ['INDIVIDUAL', 'GROUP_BROADCAST'],
    required: true,
    index: true
  },

  // For INDIVIDUAL chats - exactly 2 participants
  participants: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Referral relationship tracking
  referrerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },

  referredUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },

  // For GROUP_BROADCAST chats
  groupOwnerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },

  groupMembers: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],

  groupName: {
    type: String,
    default: 'My Referrals'
  },

  // Last message preview for chat list
  lastMessage: {
    messageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message'
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    text: {
      type: String,
      maxlength: 100 // Preview only
    },
    messageType: {
      type: String,
      enum: ['TEXT', 'PRODUCT_SHARE', 'ORDER_SHARE', 'SYSTEM']
    },
    timestamp: Date
  },

  // Unread counts per user
  unreadCounts: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    count: {
      type: Number,
      default: 0
    }
  }],

  // Status
  isActive: {
    type: Boolean,
    default: true
  },

  // Mute settings per user
  isMuted: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    mutedUntil: Date
  }],

  // Metadata
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
conversationSchema.index({ participants: 1 });
conversationSchema.index({ referrerId: 1, referredUserId: 1 });
conversationSchema.index({ groupOwnerId: 1 });
conversationSchema.index({ type: 1 });
conversationSchema.index({ 'unreadCounts.userId': 1 });
conversationSchema.index({ updatedAt: -1 });

// Virtual to check if conversation is muted for a specific user
conversationSchema.methods.isMutedForUser = function(userId) {
  const muteEntry = this.isMuted.find(m => m.userId.toString() === userId.toString());
  if (!muteEntry) return false;

  if (muteEntry.mutedUntil && muteEntry.mutedUntil < new Date()) {
    return false; // Mute expired
  }

  return true;
};

// Get unread count for specific user
conversationSchema.methods.getUnreadCountForUser = function(userId) {
  const unreadEntry = this.unreadCounts.find(u => u.userId.toString() === userId.toString());
  return unreadEntry ? unreadEntry.count : 0;
};

module.exports = mongoose.model('Conversation', conversationSchema);
