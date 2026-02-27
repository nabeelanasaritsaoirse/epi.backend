// models/Coupon.js
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

  // Discount base (used for INSTANT / REDUCE_DAYS)
  discountType: {
    type: String,
    enum: ['flat', 'percentage', null],
    default: null
  },

  discountValue: {
    type: Number,
    default: 0,
    min: 0
  },

  /**
   * HOW the coupon works:
   *  - INSTANT          → reduce price instantly
   *  - REDUCE_DAYS      → convert ₹ discount into FREE installments
   *  - MILESTONE_REWARD → give FREE days after X payments
   */
  couponType: {
    type: String,
    enum: ['INSTANT', 'REDUCE_DAYS', 'MILESTONE_REWARD'],
    required: true,
    index: true
  },

  // Minimum order amount requirement
  minOrderValue: {
    type: Number,
    default: 0,
    min: 0
  },

  // Validity
  expiryDate: {
    type: Date,
    required: true
  },

  isActive: {
    type: Boolean,
    default: true
  },

  // Usage limits
  maxUsageCount: { type: Number, default: null },
  currentUsageCount: { type: Number, default: 0 },

  // Per-user limit (future extension)
  maxUsagePerUser: { type: Number, default: null },

  // --------------------------------------
  // USAGE TRACKING
  // --------------------------------------
  usageHistory: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'InstallmentOrder' },
    usedAt: { type: Date, default: Date.now },
    discountApplied: { type: Number, default: 0 }
  }],

  // --------------------------------------
  // COUPON RESTRICTIONS
  // --------------------------------------

  // First-time user only (users with no previous orders)
  firstTimeUserOnly: { type: Boolean, default: false },

  // Product-specific (empty array = all products)
  applicableProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],

  // Category-specific (empty array = all categories)
  applicableCategories: [{ type: String }],

  // Maximum discount cap for percentage coupons (null = no cap)
  maxDiscountAmount: { type: Number, default: null },

  // Payment method restriction (empty array or ['ALL'] = all methods)
  applicablePaymentMethods: [{
    type: String,
    enum: ['WALLET', 'RAZORPAY', 'ALL']
  }],

  // --------------------------------------
  // WIN-BACK / INACTIVE USER TARGETING
  // --------------------------------------

  // User must be inactive for X days to use this coupon
  minDaysSinceLastOrder: { type: Number, default: null },
  isWinBackCoupon: { type: Boolean, default: false },

  // --------------------------------------
  // STACKABLE COUPONS
  // --------------------------------------

  isStackable: { type: Boolean, default: false },
  stackPriority: { type: Number, default: 0 }, // Lower = applied first

  // --------------------------------------
  // REFERRAL-LINKED COUPONS
  // --------------------------------------

  linkedToReferrer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  referrerCommissionPercent: { type: Number, default: 25 },
  isReferralCoupon: { type: Boolean, default: false },

  // --------------------------------------
  // AUTO-GENERATED UNIQUE CODES
  // --------------------------------------

  isParentCoupon: { type: Boolean, default: false },
  parentCoupon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    default: null
  },
  assignedToUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  isPersonalCode: { type: Boolean, default: false },

  // --------------------------------------
  // MILESTONE REWARD EXCLUSIVE FIELDS
  // --------------------------------------

  /**
   * rewardCondition: number of payments required (e.g., pay 10 days)
   * rewardValue: number of free days (e.g., get 3 free)
   */
  rewardCondition: {
    type: Number,
    default: null,
    min: 1
  },

  rewardValue: {
    type: Number,
    default: null,
    min: 1
  },

  // Backward alias for clarity (not required, optional)
  milestonePaymentsRequired: {
    type: Number,
    default: null
  },

  milestoneFreeDays: {
    type: Number,
    default: null
  },

  description: {
    type: String,
    default: ''
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// INDEXES
couponSchema.index({ couponCode: 1 });
couponSchema.index({ couponType: 1 });
couponSchema.index({ expiryDate: 1 });
couponSchema.index({ isActive: 1, expiryDate: 1 });

// --------------------------------------
// PRE-SAVE
// --------------------------------------
couponSchema.pre('save', function (next) {
  this.updatedAt = Date.now();

  // Normalize milestone alias fields
  if (this.couponType === 'MILESTONE_REWARD') {
    this.milestonePaymentsRequired = this.rewardCondition;
    this.milestoneFreeDays = this.rewardValue;

    // Remove irrelevant fields
    this.discountType = null;
    this.discountValue = 0;
  }

  next();
});

// --------------------------------------
// INSTANCE METHODS
// --------------------------------------

couponSchema.methods.isValid = function () {
  if (!this.isActive) return { valid: false, error: 'Coupon is not active' };

  if (new Date() > this.expiryDate) {
    return { valid: false, error: 'Coupon expired' };
  }

  if (this.maxUsageCount !== null && this.currentUsageCount >= this.maxUsageCount) {
    return { valid: false, error: 'Usage limit reached' };
  }

  return { valid: true };
};

// Calculate discount (INSTANT / REDUCE_DAYS)
couponSchema.methods.calculateDiscount = function (orderAmount) {
  if (this.couponType === 'MILESTONE_REWARD') return 0;

  if (this.discountType === 'flat') {
    return Math.min(this.discountValue, orderAmount);
  }

  if (this.discountType === 'percentage') {
    return Math.round(orderAmount * (this.discountValue / 100));
  }

  return 0;
};

couponSchema.methods.incrementUsage = async function () {
  this.currentUsageCount += 1;
  await this.save();
};

couponSchema.methods.canUserUse = function (userId) {
  if (this.maxUsagePerUser === null || this.maxUsagePerUser === undefined) return true;

  const userUsageCount = this.usageHistory.filter(
    h => h.user && h.user.toString() === userId.toString()
  ).length;

  return userUsageCount < this.maxUsagePerUser;
};

// --------------------------------------
// STATIC METHODS
// --------------------------------------

couponSchema.statics.findActiveByCode = function (code) {
  return this.findOne({
    couponCode: code.toUpperCase(),
    isActive: true,
    expiryDate: { $gt: new Date() }
  });
};

couponSchema.statics.getActiveCoupons = function () {
  return this.find({
    isActive: true,
    expiryDate: { $gt: new Date() }
  }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('Coupon', couponSchema);
