/**
 * Notification Model
 * Handles both admin posts (offers, announcements) and system notifications (order updates, payments)
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const notificationSchema = new Schema({
  // Unique notification identifier
  notificationId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Notification Type: ADMIN_POST or SYSTEM_NOTIFICATION
  type: {
    type: String,
    enum: ['ADMIN_POST', 'SYSTEM_NOTIFICATION'],
    required: true,
    index: true
  },

  // Admin Post Types (only if type = ADMIN_POST)
  postType: {
    type: String,
    enum: ['OFFER', 'POST', 'POST_WITH_IMAGE', 'PRODUCT_SHARE'],
    required: function() {
      return this.type === 'ADMIN_POST';
    }
  },

  // System Notification Types (only if type = SYSTEM_NOTIFICATION)
  systemType: {
    type: String,
    enum: [
      'ORDER_CONFIRMATION',
      'ORDER_SHIPPED',
      'ORDER_DELIVERED',
      'ORDER_CANCELLED',
      'PAYMENT_SUCCESS',
      'PAYMENT_FAILED',
      'PAYMENT_PENDING',
      'DELIVERY_UPDATE',
      'WALLET_CREDIT',
      'WALLET_DEBIT',
      'COMMISSION_EARNED',
      'REFERRAL_JOINED',
      'KYC_APPROVED',
      'KYC_REJECTED',
      'GENERAL'
    ],
    required: function() {
      return this.type === 'SYSTEM_NOTIFICATION';
    }
  },

  // Content
  title: {
    type: String,
    required: true,
    maxlength: 200,
    trim: true
  },

  body: {
    type: String,
    required: true,
    maxlength: 5000,
    trim: true
  },

  // Image URL (S3)
  imageUrl: {
    type: String,
    default: null
  },

  // Product Share (if postType = PRODUCT_SHARE)
  sharedProduct: {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product'
    },
    productName: String,
    productImage: String,
    productPrice: Number,
    productUrl: String
  },

  // Target Audience
  targetType: {
    type: String,
    enum: ['ALL_USERS', 'SPECIFIC_USER'],
    required: true,
    default: 'ALL_USERS'
  },

  // For SPECIFIC_USER (system notifications)
  targetUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },

  // Delivery Channels
  sendInApp: {
    type: Boolean,
    default: true
  },

  sendPush: {
    type: Boolean,
    default: false
  },

  sendPushOnly: {
    type: Boolean,
    default: false
  },

  // Engagement Settings (for ADMIN_POST only)
  commentsEnabled: {
    type: Boolean,
    default: true
  },

  likesEnabled: {
    type: Boolean,
    default: true
  },

  // Engagement Counts (for ADMIN_POST)
  likeCount: {
    type: Number,
    default: 0,
    min: 0
  },

  commentCount: {
    type: Number,
    default: 0,
    min: 0
  },

  viewCount: {
    type: Number,
    default: 0,
    min: 0
  },

  // Status
  status: {
    type: String,
    enum: ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'INACTIVE', 'DELETED'],
    required: true,
    default: 'DRAFT',
    index: true
  },

  // Scheduling
  scheduledAt: {
    type: Date,
    index: true
  },

  publishedAt: {
    type: Date,
    index: true
  },

  // Admin Info (for ADMIN_POST)
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },

  // Soft Delete
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },

  deletedAt: {
    type: Date
  },

  deletedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },

  // Metadata (for system notifications)
  metadata: {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order'
    },
    paymentId: {
      type: Schema.Types.ObjectId
    },
    transactionId: String,
    amount: Number,
    referralUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    additionalData: Schema.Types.Mixed
  },

  // Push Notification Stats
  pushStats: {
    sent: {
      type: Number,
      default: 0
    },
    failed: {
      type: Number,
      default: 0
    },
    sentAt: Date
  }

}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance
notificationSchema.index({ type: 1, status: 1, publishedAt: -1 });
notificationSchema.index({ status: 1, scheduledAt: 1 });
notificationSchema.index({ targetUserId: 1, status: 1, createdAt: -1 });
notificationSchema.index({ createdBy: 1, status: 1 });
notificationSchema.index({ isDeleted: 1 });

// Virtual for engagement rate
notificationSchema.virtual('engagementRate').get(function() {
  if (this.viewCount === 0) return 0;
  const interactions = this.likeCount + this.commentCount;
  return ((interactions / this.viewCount) * 100).toFixed(2);
});

module.exports = mongoose.model('Notification', notificationSchema);
