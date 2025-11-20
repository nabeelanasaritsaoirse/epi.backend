/**
 * InstallmentOrder Model
 *
 * Manages orders with daily installment payment plans.
 * Supports flexible payment schedules where users can skip days or pay multiple installments.
 *
 * Business Rules:
 * - Minimum 5 days installment
 * - First payment made immediately on order creation
 * - Users can skip days but must complete all payments
 * - After full payment, admin approves delivery
 * - Commission credited on EVERY payment (not after completion)
 */

const mongoose = require('mongoose');
const { generateOrderId } = require('../utils/installmentHelpers');

/**
 * Payment Schedule Item Schema
 * Tracks individual installments in the payment plan
 */
const paymentScheduleItemSchema = new mongoose.Schema({
  installmentNumber: {
    type: Number,
    required: true,
    min: 1
  },
  dueDate: {
    type: Date,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['PENDING', 'PAID', 'SKIPPED'],
    default: 'PENDING'
  },
  paidDate: {
    type: Date,
    default: null
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentRecord',
    default: null
  }
}, { _id: false });

/**
 * Installment Order Schema
 */
const installmentOrderSchema = new mongoose.Schema({
  // Unique Order Identifier
  orderId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },

  // User Information
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Product Information
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  productPrice: {
    type: Number,
    required: true,
    min: 0
  },
  productName: {
    type: String,
    required: true
  },
  productSnapshot: {
    type: Object,
    default: {} // Stores product details at time of order
  },

  // Product Variant Information (optional - for products with variants)
  variantId: {
    type: String,
    default: null
  },
  variantDetails: {
    sku: String,
    attributes: {
      size: String,
      color: String,
      material: String
    },
    price: Number,
    description: String
  },

  // Coupon Information (optional - for discount coupons)
  couponCode: {
    type: String,
    default: null,
    uppercase: true
  },
  couponDiscount: {
    type: Number,
    default: 0,
    min: 0
  },
  originalPrice: {
    type: Number,
    default: null
  },

  // Installment Plan Details
  totalDays: {
    type: Number,
    required: true,
    min: 5
  },
  dailyPaymentAmount: {
    type: Number,
    required: true,
    min: 50 // Minimum ₹50 per day
  },

  // Payment Progress Tracking
  paidInstallments: {
    type: Number,
    default: 0,
    min: 0
  },
  totalPaidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  remainingAmount: {
    type: Number,
    required: true,
    min: 0
  },

  // Payment Schedule
  paymentSchedule: [paymentScheduleItemSchema],

  // Order Status
  status: {
    type: String,
    enum: ['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING',
    index: true
  },

  // Delivery Information
  deliveryAddress: {
    name: String,
    phoneNumber: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' },
    landmark: String
  },
  deliveryStatus: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'SHIPPED', 'DELIVERED'],
    default: 'PENDING',
    index: true
  },
  deliveryApprovedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  deliveryApprovedAt: {
    type: Date,
    default: null
  },

  // Referral Information
  referrer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  productCommissionPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  totalCommissionPaid: {
    type: Number,
    default: 0,
    min: 0
  },

  // First Payment (Immediate on Order Creation)
  firstPaymentMethod: {
    type: String,
    enum: ['RAZORPAY', 'WALLET'],
    required: true
  },
  firstPaymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentRecord',
    default: null
  },
  firstPaymentCompletedAt: {
    type: Date,
    default: null
  },

  // Order Metadata
  orderNotes: {
    type: String,
    default: ''
  },
  adminNotes: {
    type: String,
    default: ''
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  cancellationReason: {
    type: String,
    default: ''
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// ============================================
// INDEXES for Query Performance
// ============================================

installmentOrderSchema.index({ user: 1, status: 1 });
installmentOrderSchema.index({ user: 1, createdAt: -1 });
installmentOrderSchema.index({ status: 1, deliveryStatus: 1 });
installmentOrderSchema.index({ referrer: 1, createdAt: -1 });
installmentOrderSchema.index({ 'paymentSchedule.status': 1 });

// ============================================
// PRE-SAVE MIDDLEWARE
// ============================================

/**
 * Auto-generate orderId before saving new order
 */
installmentOrderSchema.pre('save', async function(next) {
  if (this.isNew && !this.orderId) {
    this.orderId = generateOrderId();
  }
  next();
});

/**
 * Auto-update remainingAmount based on totalPaidAmount
 */
installmentOrderSchema.pre('save', function(next) {
  this.remainingAmount = Math.max(0, this.productPrice - this.totalPaidAmount);
  next();
});

// ============================================
// INSTANCE METHODS
// ============================================

/**
 * Check if order is fully paid
 * @returns {boolean}
 */
installmentOrderSchema.methods.isFullyPaid = function() {
  return this.totalPaidAmount >= this.productPrice;
};

/**
 * Get payment progress percentage
 * @returns {number} Progress percentage (0-100)
 */
installmentOrderSchema.methods.getProgress = function() {
  if (this.productPrice === 0) return 0;
  return Math.round((this.totalPaidAmount / this.productPrice) * 100 * 100) / 100;
};

/**
 * Get next pending installment
 * @returns {Object|null}
 */
installmentOrderSchema.methods.getNextPendingInstallment = function() {
  return this.paymentSchedule.find(item => item.status === 'PENDING') || null;
};

/**
 * Mark order as completed
 * @returns {Promise<void>}
 */
installmentOrderSchema.methods.markAsCompleted = async function() {
  this.status = 'COMPLETED';
  this.completedAt = new Date();
  await this.save();
};

/**
 * Can user make payment on this order?
 * @returns {boolean}
 */
installmentOrderSchema.methods.canAcceptPayment = function() {
  return (
    this.status === 'ACTIVE' &&
    this.remainingAmount > 0 &&
    !this.isFullyPaid()
  );
};

/**
 * Get order summary for API response
 * @returns {Object}
 */
installmentOrderSchema.methods.getSummary = function() {
  return {
    orderId: this.orderId,
    user: this.user,
    product: this.product,
    productName: this.productName,
    productPrice: this.productPrice,
    dailyPaymentAmount: this.dailyPaymentAmount,
    totalDays: this.totalDays,
    paidInstallments: this.paidInstallments,
    totalPaidAmount: this.totalPaidAmount,
    remainingAmount: this.remainingAmount,
    progress: this.getProgress(),
    status: this.status,
    deliveryStatus: this.deliveryStatus,
    isCompleted: this.isFullyPaid(),
    nextDueDate: this.getNextPendingInstallment()?.dueDate || null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Get orders by user
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>}
 */
installmentOrderSchema.statics.getByUser = function(userId, options = {}) {
  const { status, limit = 50, skip = 0 } = options;

  const query = { user: userId };
  if (status) query.status = status;

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('product', 'name images pricing')
    .populate('user', 'name email phoneNumber');
};

/**
 * Get completed orders for admin dashboard
 * @param {Object} options - Query options
 * @returns {Promise<Array>}
 */
installmentOrderSchema.statics.getCompletedOrders = function(options = {}) {
  const { limit = 50, skip = 0, deliveryStatus } = options;

  const query = { status: 'COMPLETED' };
  if (deliveryStatus) query.deliveryStatus = deliveryStatus;

  return this.find(query)
    .sort({ completedAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('user', 'name email phoneNumber addresses')
    .populate('product', 'name images pricing');
};

/**
 * Get active orders with pending payments
 * @returns {Promise<Array>}
 */
installmentOrderSchema.statics.getActiveOrders = function() {
  return this.find({
    status: 'ACTIVE',
    remainingAmount: { $gt: 0 }
  })
  .sort({ createdAt: -1 })
  .populate('user', 'name email')
  .populate('product', 'name');
};

// ============================================
// VIRTUAL PROPERTIES
// ============================================

/**
 * Virtual: Remaining installments count
 */
installmentOrderSchema.virtual('remainingInstallments').get(function() {
  return Math.ceil(this.remainingAmount / this.dailyPaymentAmount);
});

/**
 * Virtual: Total installments count
 */
installmentOrderSchema.virtual('totalInstallments').get(function() {
  return this.totalDays;
});

// Ensure virtuals are included in toJSON and toObject
installmentOrderSchema.set('toJSON', { virtuals: true });
installmentOrderSchema.set('toObject', { virtuals: true });

const InstallmentOrder = mongoose.model('InstallmentOrder', installmentOrderSchema);

module.exports = InstallmentOrder;
