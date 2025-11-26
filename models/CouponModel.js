/**
 * Coupon Model
 *
 * Manages discount coupons for orders.
 *
 * Features:
 * - Two application types: INSTANT (reduce price) or REDUCE_DAYS (free last days)
 * - Flat or percentage discount
 * - Expiry dates and usage limits
 * - Minimum order value requirements
 */

const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  // Unique Coupon Code
  couponCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },

  // Discount Configuration
  discountType: {
    type: String,
    enum: ['flat', 'percentage'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0
  },

  // ⭐ NEW: Coupon Application Type
  /**
   * couponType determines how the discount is applied:
   * - INSTANT: Reduces the product price immediately (e.g., ₹4000 → ₹3800)
   * - REDUCE_DAYS: Marks last X days as FREE in payment schedule
   */
  couponType: {
    type: String,
    enum: ['INSTANT', 'REDUCE_DAYS'],
    default: 'INSTANT'
  },

  // Minimum Order Requirements
  minOrderValue: {
    type: Number,
    default: 0,
    min: 0
  },

  // Validity
  expiryDate: {
    type: Date,
    required: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  // Usage Limits (Optional)
  maxUsageCount: {
    type: Number,
    default: null  // null = unlimited
  },
  currentUsageCount: {
    type: Number,
    default: 0,
    min: 0
  },

  // User-specific limits (Optional)
  maxUsagePerUser: {
    type: Number,
    default: null  // null = unlimited per user
  },

  // Metadata
  description: {
    type: String,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// ============================================
// INDEXES for Query Performance
// ============================================

couponSchema.index({ couponCode: 1 });
couponSchema.index({ isActive: 1, expiryDate: 1 });
couponSchema.index({ createdAt: -1 });

// ============================================
// PRE-SAVE MIDDLEWARE
// ============================================

couponSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// ============================================
// INSTANCE METHODS
// ============================================

/**
 * Check if coupon is valid for use
 * @returns {Object} { valid: boolean, error?: string }
 */
couponSchema.methods.isValid = function() {
  // Check if active
  if (!this.isActive) {
    return { valid: false, error: 'Coupon is not active' };
  }

  // Check if expired
  const now = new Date();
  if (now > this.expiryDate) {
    return { valid: false, error: 'Coupon has expired' };
  }

  // Check usage limit
  if (this.maxUsageCount !== null && this.currentUsageCount >= this.maxUsageCount) {
    return { valid: false, error: 'Coupon usage limit reached' };
  }

  return { valid: true };
};

/**
 * Calculate discount amount for given order value
 * @param {number} orderAmount - Order total amount
 * @returns {number} Discount amount
 */
couponSchema.methods.calculateDiscount = function(orderAmount) {
  let discountAmount = 0;

  if (this.discountType === 'flat') {
    discountAmount = this.discountValue;
  } else if (this.discountType === 'percentage') {
    discountAmount = Math.round((orderAmount * this.discountValue) / 100);
  }

  // Ensure discount doesn't exceed order amount
  return Math.min(discountAmount, orderAmount);
};

/**
 * Increment usage count
 * @returns {Promise<void>}
 */
couponSchema.methods.incrementUsage = async function() {
  this.currentUsageCount += 1;
  await this.save();
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Find active coupon by code
 * @param {string} code - Coupon code
 * @returns {Promise<Object|null>}
 */
couponSchema.statics.findActiveByCode = function(code) {
  return this.findOne({
    couponCode: code.toUpperCase(),
    isActive: true,
    expiryDate: { $gt: new Date() }
  });
};

/**
 * Get all active coupons
 * @returns {Promise<Array>}
 */
couponSchema.statics.getActiveCoupons = function() {
  return this.find({
    isActive: true,
    expiryDate: { $gt: new Date() }
  }).sort({ createdAt: -1 });
};

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;
