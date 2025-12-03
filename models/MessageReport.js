/**
 * MessageReport Model
 * Handles spam, abuse, and inappropriate message reporting
 *
 * Features:
 * - User-reported messages
 * - Admin review and action tracking
 * - Multiple report reasons
 * - Action history
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageReportSchema = new Schema({
  // Unique report identifier
  reportId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Reported message
  messageId: {
    type: Schema.Types.ObjectId,
    ref: 'Message',
    required: true,
    index: true
  },

  conversationId: {
    type: Schema.Types.ObjectId,
    ref: 'Conversation',
    index: true
  },

  // Reporter information
  reportedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  reportReason: {
    type: String,
    enum: ['SPAM', 'ABUSE', 'HARASSMENT', 'INAPPROPRIATE', 'OTHER'],
    required: true
  },

  reportDescription: {
    type: String,
    maxlength: 500
  },

  // Reported user (message sender)
  reportedUser: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Admin review and action
  status: {
    type: String,
    enum: ['PENDING', 'REVIEWED', 'ACTIONED', 'DISMISSED'],
    default: 'PENDING',
    index: true
  },

  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User' // Admin user
  },

  reviewedAt: Date,

  adminAction: {
    type: String,
    enum: ['MESSAGE_DELETED', 'USER_WARNED', 'USER_BLOCKED', 'NO_ACTION']
  },

  adminNotes: {
    type: String,
    maxlength: 1000
  },

  // Timestamp
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
messageReportSchema.index({ reportedBy: 1 });
messageReportSchema.index({ reportedUser: 1 });
messageReportSchema.index({ status: 1 });
messageReportSchema.index({ createdAt: -1 });

// Prevent duplicate reports from same user for same message
messageReportSchema.index({ messageId: 1, reportedBy: 1 }, { unique: true });

// Method to mark as reviewed
messageReportSchema.methods.markAsReviewed = function(adminId, action, notes) {
  this.status = action === 'NO_ACTION' ? 'DISMISSED' : 'ACTIONED';
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.adminAction = action;
  this.adminNotes = notes;
  return this.save();
};

module.exports = mongoose.model('MessageReport', messageReportSchema);
