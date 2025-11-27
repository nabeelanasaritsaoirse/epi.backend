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
    enum: ['PENDING', 'PAID', 'SKIPPED', 'FREE'],  // ⭐ NEW: Added 'FREE' for coupon benefits
    default: 'PENDING'
  },
  // ⭐ NEW: Flag for coupon-benefited installments
  isCouponBenefit: {
    type: Boolean,
    default: false
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

  // ⭐ NEW: Quantity Support (1-10 items per order)
  /**
   * quantity: Number of units being ordered
   * Allows users to order multiple items in a single order
   * Range: 1-10 items
   */
  quantity: {
    type: Number,
    required: true,
    default: 1,
    min: 1,
    max: 10
  },

  // ⭐ NEW: Price Per Unit (original product/variant price)
  /**
   * pricePerUnit: Price of ONE unit before quantity multiplication
   * Used for: refunds, price history, per-unit calculations
   * If variant selected: variant price
   * If no variant: product base price
   */
  pricePerUnit: {
    type: Number,
    required: true,
    min: 0
  },

  // ⭐ NEW: Total Product Price (pricePerUnit × quantity, BEFORE coupon)
  /**
   * totalProductPrice: Final order value (pricePerUnit × quantity)
   * This is the base amount before any coupon discount
   * Installments are calculated on this amount (or productPrice if coupon applied)
   */
  totalProductPrice: {
    type: Number,
    required: true,
    min: 0
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
  // ⭐ NEW: Coupon Application Type
  /**
   * couponType: How the coupon discount is applied
   * - INSTANT: Reduces productPrice immediately (e.g., ₹4000 → ₹3800)
   * - REDUCE_DAYS: Marks last X days as FREE in payment schedule
   */
  couponType: {
    type: String,
    enum: ['INSTANT', 'REDUCE_DAYS'],
    default: null
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
  // ⭐ NEW: Commission Percentage (stored at order level for consistency)
  /**
   * commissionPercentage: Commission rate for this specific order
   * Defaults to 10% if not set from product.referralBonus.value
   * Stored at order level to prevent issues if product commission changes later
   */
  commissionPercentage: {
    type: Number,
    default: 10,
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

  // ⭐ NEW: Last Payment Date (for one-payment-per-day rule)
  /**
   * lastPaymentDate: Date of the most recent payment
   * Used to enforce "one payment per order per day" rule
   * Resets at midnight (00:00) each day
   */
  lastPaymentDate: {
    type: Date,
    default: null,
    index: true
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
 * ⭐ UPDATED: Uses totalProductPrice if available, falls back to productPrice
 */
installmentOrderSchema.pre('save', function(next) {
  const basePrice = this.totalProductPrice || this.productPrice;
  this.remainingAmount = Math.max(0, basePrice - this.totalPaidAmount);
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

// ⭐ NEW: Check if user can make payment TODAY (one-per-day rule)
/**
 * Check if payment is allowed today (one payment per order per day)
 * Resets at midnight (00:00)
 * @returns {boolean} True if payment allowed today
 */
installmentOrderSchema.methods.canPayToday = function() {
  if (!this.lastPaymentDate) return true;  // No previous payment, allow

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastPayment = new Date(this.lastPaymentDate);
  lastPayment.setHours(0, 0, 0, 0);

  // Compare dates at midnight level
  return lastPayment.getTime() < today.getTime();
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
