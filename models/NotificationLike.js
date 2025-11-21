/**
 * Notification Like Model
 * Handles user likes on admin posts
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const notificationLikeSchema = new Schema({
  // Reference to notification
  notificationId: {
    type: Schema.Types.ObjectId,
    ref: 'Notification',
    required: true,
    index: true
  },

  // User who liked
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  }

}, {
  timestamps: { createdAt: true, updatedAt: false },
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Unique compound index - one like per user per notification
notificationLikeSchema.index({ notificationId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('NotificationLike', notificationLikeSchema);
