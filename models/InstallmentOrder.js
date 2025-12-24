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
      enum: ["PENDING", "PAID", "SKIPPED", "FREE"],
      default: "PENDING",
    },
    isCouponBenefit: { type: Boolean, default: false },
    paidDate: { type: Date, default: null },
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
  },
  { timestamps: true }
);

/** INDEXES **/
installmentOrderSchema.index({ user: 1, status: 1 });
installmentOrderSchema.index({ user: 1, createdAt: -1 });
installmentOrderSchema.index({ status: 1, deliveryStatus: 1 });
installmentOrderSchema.index({ referrer: 1, createdAt: -1 });
installmentOrderSchema.index({ "paymentSchedule.status": 1 });

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

module.exports = mongoose.model("InstallmentOrder", installmentOrderSchema);
