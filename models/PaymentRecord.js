/**
 * PaymentRecord Model
 *
 * Tracks individual installment payments for orders.
 * Each payment is processed via Razorpay or Wallet deduction.
 *
 * Features:
 * - Idempotency to prevent duplicate processing
 * - Commission tracking per payment
 * - Razorpay payment verification
 * - Transaction linking
 */

const mongoose = require('mongoose');
const { generatePaymentId } = require('../utils/installmentHelpers');

const paymentRecordSchema = new mongoose.Schema({
  // Unique Payment Identifier
  paymentId: {
    type: String,
    unique: true,
    required: false,  // Auto-generated in pre-save hook
    index: true
  },

  // Order & User Information
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InstallmentOrder',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Payment Details
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  installmentNumber: {
    type: Number,
    required: true,
    min: 1
  },

  // Payment Method
  paymentMethod: {
    type: String,
    enum: ['RAZORPAY', 'WALLET', 'ADMIN_MARKED', 'CASH', 'UPI', 'BANK_TRANSFER', 'OTHER'],
    required: true
  },

  // Razorpay Details (if applicable)
  razorpayOrderId: {
    type: String,
    default: null,
    index: true
  },
  razorpayPaymentId: {
    type: String,
    default: null,
    index: true
  },
  razorpaySignature: {
    type: String,
    default: null
  },
  razorpayVerified: {
    type: Boolean,
    default: false
  },

  // Wallet Transaction (if applicable)
  walletTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WalletTransaction',
    default: null
  },

  // Payment Status
  status: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED'],
    default: 'PENDING',
    index: true
  },

  // Idempotency
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true, // Allows null values
    index: true
  },

  // Commission Details
  commissionCalculated: {
    type: Boolean,
    default: false
  },
  commissionAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  commissionPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  commissionCreditedToReferrer: {
    type: Boolean,
    default: false
  },
  commissionTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WalletTransaction',
    default: null
  },

  // Error Handling
  errorMessage: {
    type: String,
    default: null
  },
  retryCount: {
    type: Number,
    default: 0,
    min: 0
  },

  // Timestamps
  processedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  failedAt: {
    type: Date,
    default: null
  },
  paidAt: {
    type: Date,
    default: null
  },

  // Admin Tracking
  adminMarked: {
    type: Boolean,
    default: false
  },
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  markedByEmail: {
    type: String,
    default: null
  },
  adminNote: {
    type: String,
    default: null
  },
  transactionId: {
    type: String,
    default: null
  },

  // Cancellation
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  cancelledByEmail: {
    type: String,
    default: null
  },
  cancellationReason: {
    type: String,
    default: null
  },
  cancelledAt: {
    type: Date,
    default: null
  },

  // Metadata
  metadata: {
    type: Object,
    default: {}
  },
  commissionCreditError: {
    type: String,
    default: null
  },

  // Bulk Order
  bulkOrderId: {
    type: String,
    default: null,
    index: true
  },
  bulkRazorpayOrderId: {
    type: String,
    default: null,
    index: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// ============================================
// INDEXES for Query Performance
// ============================================

paymentRecordSchema.index({ order: 1, installmentNumber: 1 }, { unique: true });
paymentRecordSchema.index({ user: 1, status: 1 });
paymentRecordSchema.index({ user: 1, createdAt: -1 });
paymentRecordSchema.index({ status: 1, createdAt: -1 });
paymentRecordSchema.index({ razorpayPaymentId: 1 }, { sparse: true });
paymentRecordSchema.index({ idempotencyKey: 1 }, { sparse: true });
// Commission reconciliation — find payments with unprocessed commissions
paymentRecordSchema.index({ commissionCalculated: 1, commissionCreditedToReferrer: 1, status: 1 });
// Order-level payment status lookup
paymentRecordSchema.index({ order: 1, status: 1 });

// ============================================
// PRE-SAVE MIDDLEWARE
// ============================================

/**
 * Auto-generate paymentId and idempotencyKey before saving new payment
 */
paymentRecordSchema.pre('save', async function(next) {
  // Auto-generate paymentId if not provided
  if (this.isNew && !this.paymentId) {
    this.paymentId = generatePaymentId();
  }

  // ⭐ FIX: Auto-generate idempotencyKey if not provided
  // Format: {orderId}-{installmentNumber}-{timestamp}
  if (this.isNew && !this.idempotencyKey) {
    this.idempotencyKey = `${this.order}-${this.installmentNumber}-${Date.now()}`;
    console.log(`🔍 Auto-generated idempotencyKey: ${this.idempotencyKey}`);
  }

  next();
});

// ============================================
// INSTANCE METHODS
// ============================================

/**
 * Mark payment as completed
 * @returns {Promise<void>}
 */
paymentRecordSchema.methods.markAsCompleted = async function() {
  this.status = 'COMPLETED';
  this.completedAt = new Date();
  await this.save();
};

/**
 * Mark payment as failed
 * @param {string} errorMessage - Error message
 * @returns {Promise<void>}
 */
paymentRecordSchema.methods.markAsFailed = async function(errorMessage) {
  this.status = 'FAILED';
  this.failedAt = new Date();
  this.errorMessage = errorMessage;
  this.retryCount += 1;
  await this.save();
};

/**
 * Mark Razorpay payment as verified
 * @returns {Promise<void>}
 */
paymentRecordSchema.methods.markRazorpayVerified = async function() {
  this.razorpayVerified = true;
  await this.save();
};

/**
 * Record commission details
 * @param {number} amount - Commission amount
 * @param {number} percentage - Commission percentage
 * @param {string} transactionId - Commission transaction ID
 * @returns {Promise<void>}
 */
paymentRecordSchema.methods.recordCommission = async function(amount, percentage, transactionId) {
  this.commissionCalculated = true;
  this.commissionAmount = amount;
  this.commissionPercentage = percentage;
  this.commissionCreditedToReferrer = true;
  this.commissionTransactionId = transactionId;
  await this.save();
};

/**
 * Get payment summary for API response
 * @returns {Object}
 */
paymentRecordSchema.methods.getSummary = function() {
  return {
    paymentId: this.paymentId,
    order: this.order,
    amount: this.amount,
    installmentNumber: this.installmentNumber,
    paymentMethod: this.paymentMethod,
    status: this.status,
    razorpayPaymentId: this.razorpayPaymentId,
    commissionAmount: this.commissionAmount,
    completedAt: this.completedAt,
    createdAt: this.createdAt
  };
};

/**
 * Check if payment can be retried
 * @returns {boolean}
 */
paymentRecordSchema.methods.canRetry = function() {
  return this.status === 'FAILED' && this.retryCount < 3;
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Get payments by order
 * @param {string} orderId - Order ID
 * @returns {Promise<Array>}
 */
paymentRecordSchema.statics.getByOrder = function(orderId) {
  return this.find({ order: orderId })
    .sort({ installmentNumber: 1 })
    .populate('user', 'name email');
};

/**
 * Get payments by user
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>}
 */
paymentRecordSchema.statics.getByUser = function(userId, options = {}) {
  const { status, limit = 50, skip = 0 } = options;

  const query = { user: userId };
  if (status) query.status = status;

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('order', 'orderId productName productPrice');
};

/**
 * Get payment by Razorpay payment ID
 * @param {string} razorpayPaymentId - Razorpay payment ID
 * @returns {Promise<Object|null>}
 */
paymentRecordSchema.statics.getByRazorpayPaymentId = function(razorpayPaymentId) {
  return this.findOne({ razorpayPaymentId });
};

/**
 * Check if payment exists by idempotency key
 * @param {string} idempotencyKey - Idempotency key
 * @returns {Promise<Object|null>}
 */
paymentRecordSchema.statics.findByIdempotencyKey = function(idempotencyKey) {
  return this.findOne({ idempotencyKey });
};

/**
 * Get pending payments for processing
 * @param {number} limit - Limit
 * @returns {Promise<Array>}
 */
paymentRecordSchema.statics.getPendingPayments = function(limit = 100) {
  return this.find({
    status: 'PENDING',
    retryCount: { $lt: 3 }
  })
  .sort({ createdAt: 1 })
  .limit(limit);
};

/**
 * Get total amount paid by user
 * @param {string} userId - User ID
 * @returns {Promise<number>}
 */
paymentRecordSchema.statics.getTotalPaidByUser = async function(userId) {
  const result = await this.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId(userId),
        status: 'COMPLETED'
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);

  return result.length > 0 ? result[0].total : 0;
};

/**
 * Get commission stats for referrer
 * @param {string} referrerId - Referrer user ID
 * @returns {Promise<Object>}
 */
paymentRecordSchema.statics.getCommissionStats = async function(referrerId) {
  const InstallmentOrder = mongoose.model('InstallmentOrder');

  const orders = await InstallmentOrder.find({ referrer: referrerId }).select('_id');
  const orderIds = orders.map(o => o._id);

  const result = await this.aggregate([
    {
      $match: {
        order: { $in: orderIds },
        status: 'COMPLETED',
        commissionCreditedToReferrer: true
      }
    },
    {
      $group: {
        _id: null,
        totalCommission: { $sum: '$commissionAmount' },
        totalPayments: { $sum: 1 }
      }
    }
  ]);

  return result.length > 0
    ? {
        totalCommission: result[0].totalCommission,
        totalPayments: result[0].totalPayments
      }
    : { totalCommission: 0, totalPayments: 0 };
};

// ============================================
// VIRTUAL PROPERTIES
// ============================================

/**
 * Virtual: Is payment completed?
 */
paymentRecordSchema.virtual('isCompleted').get(function() {
  return this.status === 'COMPLETED';
});

/**
 * Virtual: Is payment failed?
 */
paymentRecordSchema.virtual('isFailed').get(function() {
  return this.status === 'FAILED';
});

/**
 * Virtual: Is Razorpay payment?
 */
paymentRecordSchema.virtual('isRazorpayPayment').get(function() {
  return this.paymentMethod === 'RAZORPAY';
});

/**
 * Virtual: Is Wallet payment?
 */
paymentRecordSchema.virtual('isWalletPayment').get(function() {
  return this.paymentMethod === 'WALLET';
});

// Ensure virtuals are included in toJSON and toObject
paymentRecordSchema.set('toJSON', { virtuals: true });
paymentRecordSchema.set('toObject', { virtuals: true });

const PaymentRecord = mongoose.model('PaymentRecord', paymentRecordSchema);

module.exports = PaymentRecord;
