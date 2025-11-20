const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    notificationId: {
      type: String,
      unique: true,
      sparse: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['inapp', 'system', 'both'],
      default: 'both',
      required: true
    },
    link: {
      type: String,
      default: null
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    readBy: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      readAt: {
        type: Date,
        default: Date.now
      }
    }],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    metadata: {
      category: String,
      tags: [String]
    }
  },
  {
    timestamps: true,
    strict: true
  }
);

// Auto-generate notificationId before saving
notificationSchema.pre('save', async function (next) {
  if (!this.notificationId) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.notificationId = `NOTIF${timestamp}${random}`;
  }
  next();
});

// Index for faster queries
notificationSchema.index({ notificationId: 1 });
notificationSchema.index({ isActive: 1, isDeleted: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ type: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
