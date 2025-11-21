/**
 * Message Model
 * Handles all types of messages in the chat system
 *
 * Message Types:
 * - TEXT: Regular text messages
 * - PRODUCT_SHARE: Sharing products with referrals
 * - ORDER_SHARE: Sharing order information
 * - SYSTEM: System-generated messages
 *
 * Features:
 * - Delivery and read status tracking
 * - Message editing (with timestamp)
 * - Soft delete functionality
 * - Reply to messages
 * - Product and order sharing
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageSchema = new Schema({
  // Unique message identifier
  messageId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Conversation this message belongs to
  conversationId: {
    type: Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },

  // Sender information
  senderId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Cached sender info for performance
  senderName: {
    type: String,
    required: true
  },

  senderAvatar: {
    type: String,
    default: ''
  },

  // Message type
  messageType: {
    type: String,
    enum: ['TEXT', 'PRODUCT_SHARE', 'ORDER_SHARE', 'SYSTEM'],
    required: true,
    index: true
  },

  // Text content (sanitized HTML)
  text: {
    type: String,
    maxlength: 5000
  },

  // Product sharing
  sharedProduct: {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product'
    },
    productName: String,
    productImage: String,
    productPrice: Number,
    productUrl: String // Deep link to product
  },

  // Order sharing
  sharedOrder: {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order'
    },
    orderNumber: String,
    productName: String,
    orderStatus: String,
    orderUrl: String // Deep link to order
  },

  // Delivery status per recipient (for group broadcasts)
  deliveryStatus: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['SENT', 'DELIVERED', 'READ'],
      default: 'SENT'
    },
    deliveredAt: Date,
    readAt: Date
  }],

  // Message editing
  isEdited: {
    type: Boolean,
    default: false
  },

  editedAt: Date,

  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },

  deletedAt: Date,

  deletedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },

  deleteReason: String, // If admin deleted

  // Reply functionality
  replyTo: {
    messageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message'
    },
    text: {
      type: String,
      maxlength: 100 // Preview only
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Critical indexes for performance
messageSchema.index({ conversationId: 1, createdAt: -1 }); // Most important - for fetching conversation messages
messageSchema.index({ senderId: 1 });
messageSchema.index({ isDeleted: 1 });
messageSchema.index({ 'deliveryStatus.userId': 1 });
messageSchema.index({ messageType: 1 });
messageSchema.index({ createdAt: -1 }); // For polling

// Method to check if message can be edited
messageSchema.methods.canEdit = function(userId) {
  // Can only edit own messages
  if (this.senderId.toString() !== userId.toString()) {
    return false;
  }

  // Can only edit TEXT messages
  if (this.messageType !== 'TEXT') {
    return false;
  }

  // Can only edit messages less than 15 minutes old
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  if (this.createdAt < fifteenMinutesAgo) {
    return false;
  }

  // Cannot edit deleted messages
  if (this.isDeleted) {
    return false;
  }

  return true;
};

// Method to check if message can be deleted by user
messageSchema.methods.canDelete = function(userId) {
  // Can only delete own messages
  if (this.senderId.toString() !== userId.toString()) {
    return false;
  }

  // Cannot delete already deleted messages
  if (this.isDeleted) {
    return false;
  }

  return true;
};

// Method to get delivery status for a specific user
messageSchema.methods.getDeliveryStatusForUser = function(userId) {
  const status = this.deliveryStatus.find(s => s.userId.toString() === userId.toString());
  return status || { status: 'SENT' };
};

module.exports = mongoose.model('Message', messageSchema);
