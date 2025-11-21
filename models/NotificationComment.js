/**
 * Notification Comment Model
 * Handles user comments on admin posts
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const notificationCommentSchema = new Schema({
  // Unique comment identifier
  commentId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Reference to notification
  notificationId: {
    type: Schema.Types.ObjectId,
    ref: 'Notification',
    required: true,
    index: true
  },

  // Commenter details
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  userName: {
    type: String,
    required: true
  },

  userAvatar: {
    type: String,
    default: ''
  },

  // Comment content
  text: {
    type: String,
    required: true,
    maxlength: 1000,
    trim: true
  },

  // Soft delete
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

  deletedByAdmin: {
    type: Boolean,
    default: false
  },

  // Admin moderation
  deletionReason: {
    type: String,
    maxlength: 500
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

// Compound indexes
notificationCommentSchema.index({ notificationId: 1, createdAt: -1 });
notificationCommentSchema.index({ notificationId: 1, isDeleted: 1, createdAt: -1 });
notificationCommentSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('NotificationComment', notificationCommentSchema);
