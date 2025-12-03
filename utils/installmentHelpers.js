/**
 * Helper Utilities for Installment Order System
 * Provides ID generation, commission calculation, date manipulation, and business logic helpers
 */

const crypto = require("crypto");

/* -------------------------------------------------------
   ID GENERATORS
-------------------------------------------------------- */

function generateOrderId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `ORD-${date}-${random}`;
}

function generatePaymentId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `PAY-${date}-${random}`;
}

function generateTransactionId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `TXN-${date}-${random}`;
}

/* -------------------------------------------------------
   BUSINESS RULES
-------------------------------------------------------- */

function getMaxAllowedDays(productPrice) {
  if (productPrice <= 10000) return 100;
  if (productPrice <= 50000) return 180;
  return 365;
}

function calculateDailyAmount(price, days) {
  if (days <= 0) throw new Error("Days must be > 0");
  return Math.ceil(price / days);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function calculateCommission(amount, percentage) {
  if (percentage < 0 || percentage > 100)
    throw new Error("Percentage must be between 0 and 100");
  return Math.round((amount * percentage) * 100) / 100 / 100;
}

function splitCommission(totalCommission) {
  const availableAmount = Math.round(totalCommission * 0.9 * 100) / 100;
  const lockedAmount = Math.round(totalCommission * 0.1 * 100) / 100;
  return { availableAmount, lockedAmount };
}

/* -------------------------------------------------------
   PAYMENT SCHEDULE - REDUCE_DAYS + REMAINDER FIXED
-------------------------------------------------------- */

function generatePaymentSchedule(
  totalDays,
  dailyAmount,
  startDate = new Date(),
  couponInfo = null
) {
  const schedule = [];

  let freeDays = 0;
  let remainder = 0;

  // ⭐ Calculate free days for REDUCE_DAYS coupon
  if (couponInfo?.type === "REDUCE_DAYS") {
    freeDays = Math.floor(couponInfo.discount / dailyAmount);
    remainder = couponInfo.discount % dailyAmount;
  }

  for (let i = 0; i < totalDays; i++) {
    const installmentNumber = i + 1;
    const dueDate = addDays(startDate, i);

    const isLast = installmentNumber === totalDays;
    const freeStartIndex = totalDays - freeDays - (remainder > 0 ? 1 : 0);

    const isFree = couponInfo?.type === "REDUCE_DAYS"
      ? installmentNumber > freeStartIndex
      : false;

    const amount =
      isLast && remainder > 0
        ? remainder  // last day remainder
        : isFree
        ? 0
        : dailyAmount;

    schedule.push({
      installmentNumber,
      dueDate,
      amount,
      status: isFree ? "FREE" : "PENDING",
      isCouponBenefit: isFree,
      paidDate: null,
      paymentId: null,
    });
  }

  return schedule;
}

/* -------------------------------------------------------
   DURATION VALIDATION
-------------------------------------------------------- */

function validateInstallmentDuration(totalDays, productPrice) {
  const minDays = 5;
  const maxDays = getMaxAllowedDays(productPrice);

  if (totalDays < minDays)
    return { valid: false, min: minDays, max: maxDays };

  if (totalDays > maxDays)
    return { valid: false, min: minDays, max: maxDays };

  return { valid: true, min: minDays, max: maxDays };
}

/* -------------------------------------------------------
   REMAINING PAYMENT CALC
-------------------------------------------------------- */

function calculateRemainingPayment(totalAmount, paidAmount, dailyAmount) {
  const remaining = Math.max(0, totalAmount - paidAmount);
  return {
    remainingAmount: Math.round(remaining * 100) / 100,
    remainingInstallments: Math.ceil(remaining / dailyAmount),
    progress:
      totalAmount > 0
        ? Math.round((paidAmount / totalAmount) * 100 * 100) / 100
        : 0,
  };
}

/* -------------------------------------------------------
   COMPLETION CHECK
-------------------------------------------------------- */

function isOrderFullyPaid(totalAmount, paidAmount) {
  return paidAmount >= totalAmount;
}

/* -------------------------------------------------------
   INSTALLMENT HELPERS
-------------------------------------------------------- */

function getNextPendingInstallment(schedule) {
  return schedule.find((i) => i.status === "PENDING") || null;
}

function getPaidInstallmentsCount(schedule) {
  return schedule.filter((i) => i.status === "PAID").length;
}

/* -------------------------------------------------------
   MILESTONE LOGIC (CRITICALLY FIXED)
-------------------------------------------------------- */

/**
 * Milestone reached when:
 * paidInstallments >= milestonePaymentsRequired
 */
function checkMilestoneReached(order) {
  if (order.couponType !== "MILESTONE_REWARD") return false;
  if (order.milestoneRewardApplied) return false;

  return order.paidInstallments >= order.milestonePaymentsRequired;
}

/**
 * Apply milestone free days:
 * - FREE installments count as PAID
 * - They reduce remainingAmount only via logic in processPayment
 * - If all installments become PAID/FREE → order is COMPLETED
 */
function applyMilestoneFreeDaysToSchedule(order) {
  const freeDays = order.milestoneFreeDays;
  if (!freeDays || freeDays <= 0) return order.paymentSchedule;

  const schedule = order.paymentSchedule;

  let freeApplied = 0;

  for (let i = 0; i < schedule.length && freeApplied < freeDays; i++) {
    const inst = schedule[i];

    if (inst.status === "PENDING") {
      inst.status = "FREE";
      inst.amount = 0;
      inst.isCouponBenefit = true;
      freeApplied++;
    }
  }

  return schedule;
}

/* -------------------------------------------------------
   DAILY LIMIT
-------------------------------------------------------- */

function canPayToday(lastPaymentDate) {
  if (!lastPaymentDate) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const last = new Date(lastPaymentDate);
  last.setHours(0, 0, 0, 0);

  return last.getTime() < today.getTime();
}

/* -------------------------------------------------------
   COUPON HELPERS
-------------------------------------------------------- */

function calculateTotalProductPrice(pricePerUnit, quantity = 1) {
  return pricePerUnit * quantity;
}

function applyInstantCoupon(totalPrice, couponDiscount) {
  const discountApplied = Math.min(couponDiscount, totalPrice);
  return {
    finalPrice: Math.max(0, totalPrice - discountApplied),
    discountApplied,
  };
}

function calculateCouponDaysReduction(couponDiscount, dailyAmount) {
  return {
    freeDays: Math.floor(couponDiscount / dailyAmount),
    remainder: couponDiscount % dailyAmount,
  };
}

/* -------------------------------------------------------
   UTILS
-------------------------------------------------------- */

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
}

function generateIdempotencyKey(orderId, userId, installmentNumber) {
  const raw = `${orderId}-${userId}-${installmentNumber}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function sanitizePaymentResponse(payment) {
  const sanitized = { ...payment };
  delete sanitized.razorpaySignature;
  delete sanitized.idempotencyKey;
  return sanitized;
}

function calculateOrderSummary(order) {
  const rem = calculateRemainingPayment(
    order.productPrice,
    order.totalPaidAmount,
    order.dailyPaymentAmount
  );

  return {
    orderId: order.orderId,
    productPrice: order.productPrice,
    dailyPaymentAmount: order.dailyPaymentAmount,
    totalDays: order.totalDays,
    paidInstallments: order.paidInstallments,
    totalPaidAmount: order.totalPaidAmount,
    remainingAmount: rem.remainingAmount,
    remainingInstallments: rem.remainingInstallments,
    progress: rem.progress,
    status: order.status,
    nextDueDate: order.getNextPendingInstallment()?.dueDate || null,
  };
}

/* -------------------------------------------------------
   EXPORTS
-------------------------------------------------------- */

module.exports = {
  generateOrderId,
  generatePaymentId,
  generateTransactionId,
  getMaxAllowedDays,
  calculateDailyAmount,
  calculateCommission,
  splitCommission,
  validateInstallmentDuration,
  addDays,
  generatePaymentSchedule,
  getNextPendingInstallment,
  getPaidInstallmentsCount,
  calculateRemainingPayment,
  isOrderFullyPaid,
  calculateTotalProductPrice,
  applyInstantCoupon,
  calculateCouponDaysReduction,
  canPayToday,
  checkMilestoneReached,
  applyMilestoneFreeDaysToSchedule,
  formatCurrency,
  generateIdempotencyKey,
  sanitizePaymentResponse,
  calculateOrderSummary,
};
