/**
 * InstallmentOrder Model (FINAL, FIXED, STABLE)
 */

const mongoose = require("mongoose");
const { generateOrderId } = require("../utils/installmentHelpers");

/**
 * Payment Schedule Item Schema
 */
const paymentScheduleItemSchema = new mongoose.Schema(
  {
    installmentNumber: { type: Number, required: true, min: 1 },
    dueDate: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["PENDING", "PAID", "COMPLETED", "SKIPPED", "FREE"],
      default: "PENDING",
    },
    isCouponBenefit: { type: Boolean, default: false },
    paidDate: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    transactionId: { type: String, default: null },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentRecord",
      default: null,
    },
  },
  { _id: false }
);

/**
 * Installment Order Schema
 */
const installmentOrderSchema = new mongoose.Schema(
  {
    orderId: { type: String },

    /** USER **/
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /** PRODUCT **/
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    quantity: { type: Number, required: true, min: 1, max: 10 },

    pricePerUnit: { type: Number, required: true, min: 0 },
    totalProductPrice: { type: Number, required: true, min: 0 }, 
    productPrice: { type: Number, required: true, min: 0 }, 
    productName: { type: String, required: true },
    productSnapshot: { type: Object, default: {} },

    /** VARIANT **/
    variantId: { type: String, default: null },
    variantDetails: {
      sku: String,
      attributes: {
        size: String,
        color: String,
        material: String,
      },
      price: Number,
      description: String,
    },

    /** COUPONS **/
    couponCode: { type: String, default: null, uppercase: true },
    couponDiscount: { type: Number, default: 0, min: 0 },

    // ✅ FIXED ENUM — made optional, no default value
    couponType: {
      type: String,
      enum: ["INSTANT", "REDUCE_DAYS", "MILESTONE_REWARD"],
      default: undefined,
    },

    originalPrice: { type: Number, default: null },

    /** MILESTONE REWARD **/
    milestonePaymentsRequired: { type: Number, default: null, min: 1 },
    milestoneFreeDays: { type: Number, default: null, min: 1 },
    milestoneRewardApplied: { type: Boolean, default: false },
    milestoneRewardAppliedAt: { type: Date, default: null },

    /** INSTALLMENT PLAN **/
    totalDays: { type: Number, required: true, min: 5 },
    dailyPaymentAmount: { type: Number, required: true, min: 50 },
    paidInstallments: { type: Number, default: 0 },
    totalPaidAmount: { type: Number, default: 0 },
    remainingAmount: { type: Number, required: true },

    paymentSchedule: [paymentScheduleItemSchema],

    /** STATUS **/
    status: {
      type: String,
      enum: ["PENDING", "ACTIVE", "COMPLETED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },

    /** DELIVERY **/
    deliveryAddress: {
      name: String,
      phoneNumber: String,
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: "India" },
      landmark: String,
    },
    deliveryStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "SHIPPED", "DELIVERED"],
      default: "PENDING",
      index: true,
    },
    deliveryApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deliveryApprovedAt: { type: Date, default: null },

    /** REFERRAL COMMISSION **/
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    productCommissionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    commissionPercentage: {
      type: Number,
      default: 10,
      min: 0,
      max: 100,
    },
    totalCommissionPaid: { type: Number, default: 0 },

    /** FIRST PAYMENT **/
    firstPaymentMethod: {
      type: String,
      enum: ["RAZORPAY", "WALLET"],
      required: true,
    },
    firstPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentRecord",
      default: null,
    },
    firstPaymentCompletedAt: { type: Date, default: null },

    /** ONE PAYMENT PER DAY **/
    lastPaymentDate: { type: Date, default: null, index: true },

    /** NOTES **/
    orderNotes: { type: String, default: "" },
    adminNotes: { type: String, default: "" },
    cancelledAt: { type: Date, default: null },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    cancellationReason: { type: String, default: "" },

    completedAt: { type: Date, default: null },

    /** ADMIN TRACKING **/
    createdByAdmin: { type: Boolean, default: false },
    createdByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdByAdminEmail: { type: String, default: null },

    /** BULK ORDER **/
    bulkOrderId: {
      type: String,
      default: null,
      index: true,
    },

    /** AUTOPAY SETTINGS (Order Level) **/
    autopay: {
      // Autopay enabled for this specific order
      enabled: {
        type: Boolean,
        default: false,
      },
      // Priority for payment (lower = higher priority)
      priority: {
        type: Number,
        default: 1,
        min: 1,
        max: 100,
      },
      // Pause autopay until this date
      pausedUntil: {
        type: Date,
        default: null,
      },
      // Specific dates to skip autopay
      skipDates: [{
        type: Date,
      }],
      // Last autopay attempt info
      lastAttempt: {
        date: { type: Date, default: null },
        status: {
          type: String,
          enum: ['SUCCESS', 'FAILED', 'SKIPPED', 'INSUFFICIENT_BALANCE'],
          default: undefined
        },
        errorMessage: { type: String, default: null },
      },
      // Autopay history (last 10 entries)
      history: [{
        date: Date,
        status: String,
        amount: Number,
        errorMessage: String,
        paymentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'PaymentRecord',
        },
      }],
      // When autopay was enabled
      enabledAt: {
        type: Date,
        default: null,
      },
      // Total successful autopayments
      successCount: {
        type: Number,
        default: 0,
      },
      // Total failed autopayments
      failedCount: {
        type: Number,
        default: 0,
      },
    },
  },
  { timestamps: true }
);

/** INDEXES **/
installmentOrderSchema.index({ user: 1, status: 1 });
installmentOrderSchema.index({ user: 1, createdAt: -1 });
installmentOrderSchema.index({ status: 1, deliveryStatus: 1 });
installmentOrderSchema.index({ referrer: 1, createdAt: -1 });
installmentOrderSchema.index({ "paymentSchedule.status": 1 });
// Autopay indexes
installmentOrderSchema.index({ "autopay.enabled": 1, status: 1 });
installmentOrderSchema.index({ "autopay.priority": 1 });

/** PRE-SAVE **/
installmentOrderSchema.pre("save", function (next) {
  if (this.isNew && !this.orderId) {
    this.orderId = generateOrderId();
  }
  next();
});

installmentOrderSchema.pre("save", function (next) {
  const basePrice = this.productPrice;
  this.remainingAmount = Math.max(0, basePrice - this.totalPaidAmount);
  next();
});

/** INSTANCE METHODS **/
installmentOrderSchema.methods.isFullyPaid = function () {
  return this.totalPaidAmount >= this.productPrice;
};

installmentOrderSchema.methods.getProgress = function () {
  if (this.productPrice === 0) return 0;
  return Math.round((this.totalPaidAmount / this.productPrice) * 10000) / 100;
};

installmentOrderSchema.methods.getNextPendingInstallment = function () {
  return this.paymentSchedule.find((i) => i.status === "PENDING") || null;
};

installmentOrderSchema.methods.getNextPayableInstallment = function () {
  return (
    this.paymentSchedule.find(
      (i) => i.status === "PENDING" && i.amount > 0
    ) || null
  );
};

installmentOrderSchema.methods.getPendingPaidInstallmentsCount = function () {
  return this.paymentSchedule.filter(
    (i) => i.status === "PENDING" && i.amount > 0
  ).length;
};

installmentOrderSchema.methods.canAcceptPayment = function () {
  return (
    this.status === "ACTIVE" &&
    this.remainingAmount > 0 &&
    !this.isFullyPaid()
  );
};

installmentOrderSchema.methods.canPayToday = function () {
  if (!this.lastPaymentDate) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const last = new Date(this.lastPaymentDate);
  last.setHours(0, 0, 0, 0);

  return last.getTime() < today.getTime();
};

installmentOrderSchema.methods.markAsCompleted = async function () {
  this.status = "COMPLETED";
  this.completedAt = new Date();
  await this.save();
};

/** AUTOPAY METHODS **/

/**
 * Check if autopay is currently active for this order
 */
installmentOrderSchema.methods.isAutopayActive = function () {
  if (!this.autopay?.enabled) return false;
  if (this.status !== "ACTIVE") return false;

  // Check if paused
  if (this.autopay.pausedUntil) {
    const now = new Date();
    if (now < this.autopay.pausedUntil) return false;
  }

  return true;
};

/**
 * Check if today is a skip date for autopay
 */
installmentOrderSchema.methods.isSkipDate = function (date = new Date()) {
  if (!this.autopay?.skipDates?.length) return false;

  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  return this.autopay.skipDates.some(skipDate => {
    const skip = new Date(skipDate);
    skip.setHours(0, 0, 0, 0);
    return skip.getTime() === checkDate.getTime();
  });
};

/**
 * Check if order can process autopay today
 */
installmentOrderSchema.methods.canProcessAutopay = function () {
  if (!this.isAutopayActive()) return false;
  if (!this.canPayToday()) return false;
  if (this.isSkipDate()) return false;
  if (this.isFullyPaid()) return false;

  return true;
};

/**
 * Add entry to autopay history (keeps last 10)
 */
installmentOrderSchema.methods.addAutopayHistory = function (entry) {
  if (!this.autopay) {
    this.autopay = { history: [] };
  }
  if (!this.autopay.history) {
    this.autopay.history = [];
  }

  this.autopay.history.unshift({
    date: new Date(),
    status: entry.status,
    amount: entry.amount,
    errorMessage: entry.errorMessage || null,
    paymentId: entry.paymentId || null,
  });

  // Keep only last 10 entries
  if (this.autopay.history.length > 10) {
    this.autopay.history = this.autopay.history.slice(0, 10);
  }
};

/** SUMMARY **/
installmentOrderSchema.methods.getSummary = function () {
  return {
    orderId: this.orderId,
    productName: this.productName,
    productPrice: this.productPrice,
    totalProductPrice: this.totalProductPrice,
    dailyPaymentAmount: this.dailyPaymentAmount,
    totalDays: this.totalDays,

    paidInstallments: this.paidInstallments,
    totalPaidAmount: this.totalPaidAmount,
    remainingAmount: this.remainingAmount,

    couponType: this.couponType,
    couponDiscount: this.couponDiscount,
    milestonePaymentsRequired: this.milestonePaymentsRequired,
    milestoneFreeDays: this.milestoneFreeDays,
    milestoneRewardApplied: this.milestoneRewardApplied,

    status: this.status,
    progress: this.getProgress(),

    nextDueDate: this.getNextPayableInstallment()?.dueDate || null,
    createdAt: this.createdAt,
  };
};

/** STATIC METHODS **/
installmentOrderSchema.statics.getByUser = async function (userId, options = {}) {
  const { status, limit = 50, skip = 0 } = options;

  const query = { user: userId };
  if (status) query.status = status;

  return this.find(query)
    .populate("product", "name images pricing availability")
    .populate("referrer", "name email")
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip));
};

module.exports = mongoose.model("InstallmentOrder", installmentOrderSchema);
