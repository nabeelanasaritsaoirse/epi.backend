/**
 * Helper Utilities for Installment Order System
 * Provides ID generation, commission calculation, date manipulation, and business logic helpers
 */

const crypto = require('crypto');

/**
 * Generates a unique Order ID
 * Format: ORD-YYYYMMDD-XXXX
 * @returns {string} Unique order ID
 */
function generateOrderId() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `ORD-${dateStr}-${random}`;
}

/**
 * Generates a unique Payment ID
 * Format: PAY-YYYYMMDD-XXXX
 * @returns {string} Unique payment ID
 */
function generatePaymentId() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `PAY-${dateStr}-${random}`;
}

/**
 * Generates a unique Transaction ID
 * Format: TXN-YYYYMMDD-XXXX
 * @returns {string} Unique transaction ID
 */
function generateTransactionId() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `TXN-${dateStr}-${random}`;
}

/**
 * Get maximum allowed days based on product price
 * Business Rules:
 * - ≤ ₹10,000 → 100 days max
 * - ₹10,001 - ₹50,000 → 180 days max
 * - > ₹50,000 → 365 days max
 *
 * @param {number} productPrice - Product price in rupees
 * @returns {number} Maximum allowed days
 */
function getMaxAllowedDays(productPrice) {
  if (productPrice <= 10000) {
    return 100;
  } else if (productPrice <= 50000) {
    return 180;
  } else {
    return 365;
  }
}

/**
 * Calculate daily installment amount
 * Rounds up to ensure full payment coverage
 *
 * @param {number} price - Total product price
 * @param {number} days - Number of installment days
 * @returns {number} Daily payment amount (rounded up)
 */
function calculateDailyAmount(price, days) {
  if (days <= 0) {
    throw new Error('Days must be greater than 0');
  }
  return Math.ceil(price / days);
}

/**
 * Add days to a date
 * Returns new Date object (does not modify original)
 *
 * @param {Date} date - Starting date
 * @param {number} days - Number of days to add
 * @returns {Date} New date with days added
 */
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Calculate commission amount
 *
 * @param {number} amount - Base amount (payment amount)
 * @param {number} percentage - Commission percentage (e.g., 20 for 20%)
 * @returns {number} Commission amount (rounded to 2 decimals)
 */
function calculateCommission(amount, percentage) {
  if (percentage < 0 || percentage > 100) {
    throw new Error('Percentage must be between 0 and 100');
  }
  const commission = (amount * percentage) / 100;
  return Math.round(commission * 100) / 100; // Round to 2 decimals
}

/**
 * Split commission into available and locked portions
 * Business Rule: 90% available for withdrawal, 10% locked for investment
 *
 * @param {number} totalCommission - Total commission amount
 * @returns {Object} { availableAmount, lockedAmount }
 */
function splitCommission(totalCommission) {
  const availableAmount = Math.round(totalCommission * 0.90 * 100) / 100;
  const lockedAmount = Math.round(totalCommission * 0.10 * 100) / 100;

  return {
    availableAmount,
    lockedAmount
  };
}

/**
 * Generate payment schedule for order
 * ⭐ ENHANCED: Now supports REDUCE_DAYS coupons with FREE days and remainder
 *
 * @param {number} totalDays - Total number of installment days
 * @param {number} dailyAmount - Daily payment amount
 * @param {Date} startDate - Order start date
 * @param {Object} couponInfo - Optional coupon information
 * @param {string} couponInfo.type - 'REDUCE_DAYS' or null
 * @param {number} couponInfo.discount - Coupon discount amount
 * @returns {Array} Array of payment schedule items
 */
function generatePaymentSchedule(totalDays, dailyAmount, startDate = new Date(), couponInfo = null) {
  const schedule = [];
  let freeDays = 0;
  let remainder = 0;

  // ⭐ Calculate free days and remainder for REDUCE_DAYS coupon
  if (couponInfo && couponInfo.type === 'REDUCE_DAYS' && couponInfo.discount > 0) {
    freeDays = Math.floor(couponInfo.discount / dailyAmount);
    remainder = couponInfo.discount % dailyAmount;
  }

  for (let i = 0; i < totalDays; i++) {
    const dueDate = addDays(startDate, i);
    const installmentNumber = i + 1;

    // ⭐ Determine if this installment is FREE (last X days before the very last day)
    const isFreeByCoupon = freeDays > 0 && (installmentNumber > totalDays - freeDays - (remainder > 0 ? 1 : 0)) && (installmentNumber < totalDays || remainder === 0);

    // ⭐ Last day might have reduced amount if there's a remainder
    const isLastDay = installmentNumber === totalDays;
    const amount = isLastDay && remainder > 0 ? remainder : dailyAmount;

    schedule.push({
      installmentNumber,
      dueDate: dueDate,
      amount: amount,
      status: isFreeByCoupon ? 'FREE' : 'PENDING', // FREE for coupon-benefited days
      isCouponBenefit: isFreeByCoupon,
      paidDate: null,
      paymentId: null
    });
  }

  return schedule;
}

/**
 * Validate installment duration for product
 * Checks if days are within allowed range
 *
 * @param {number} totalDays - Requested installment days
 * @param {number} productPrice - Product price
 * @returns {Object} { valid: boolean, min: number, max: number, error?: string }
 */
function validateInstallmentDuration(totalDays, productPrice) {
  const minDays = 5;
  const maxDays = getMaxAllowedDays(productPrice);

  if (totalDays < minDays) {
    return {
      valid: false,
      min: minDays,
      max: maxDays,
      error: `Minimum installment duration is ${minDays} days`
    };
  }

  if (totalDays > maxDays) {
    return {
      valid: false,
      min: minDays,
      max: maxDays,
      error: `Maximum installment duration for this product is ${maxDays} days`
    };
  }

  return {
    valid: true,
    min: minDays,
    max: maxDays
  };
}

/**
 * Calculate remaining payment details
 *
 * @param {number} totalAmount - Total product price
 * @param {number} paidAmount - Amount already paid
 * @param {number} dailyAmount - Daily installment amount
 * @returns {Object} { remainingAmount, remainingInstallments, progress }
 */
function calculateRemainingPayment(totalAmount, paidAmount, dailyAmount) {
  const remainingAmount = Math.max(0, totalAmount - paidAmount);
  const remainingInstallments = Math.ceil(remainingAmount / dailyAmount);
  const progress = (paidAmount / totalAmount) * 100;

  return {
    remainingAmount: Math.round(remainingAmount * 100) / 100,
    remainingInstallments,
    progress: Math.round(progress * 100) / 100
  };
}

/**
 * Check if order is fully paid
 *
 * @param {number} totalAmount - Total product price
 * @param {number} paidAmount - Amount already paid
 * @returns {boolean} True if fully paid
 */
function isOrderFullyPaid(totalAmount, paidAmount) {
  return paidAmount >= totalAmount;
}

/**
 * Get next pending installment from schedule
 *
 * @param {Array} paymentSchedule - Array of payment schedule items
 * @returns {Object|null} Next pending installment or null if none
 */
function getNextPendingInstallment(paymentSchedule) {
  return paymentSchedule.find(item => item.status === 'PENDING') || null;
}

/**
 * Get total paid installments count
 *
 * @param {Array} paymentSchedule - Array of payment schedule items
 * @returns {number} Count of paid installments
 */
function getPaidInstallmentsCount(paymentSchedule) {
  return paymentSchedule.filter(item => item.status === 'PAID').length;
}

/**
 * Format currency to INR
 *
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Generate idempotency key for payment
 * Prevents duplicate payment processing
 *
 * @param {string} orderId - Order ID
 * @param {string} userId - User ID
 * @param {number} installmentNumber - Installment number
 * @returns {string} Idempotency key
 */
function generateIdempotencyKey(orderId, userId, installmentNumber) {
  const data = `${orderId}-${userId}-${installmentNumber}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Sanitize payment response for client
 * Removes sensitive internal data
 *
 * @param {Object} payment - Payment object
 * @returns {Object} Sanitized payment object
 */
function sanitizePaymentResponse(payment) {
  const sanitized = { ...payment };

  // Remove sensitive fields
  delete sanitized.razorpaySignature;
  delete sanitized.idempotencyKey;

  return sanitized;
}

/**
 * Calculate order summary
 * Provides comprehensive order status information
 *
 * @param {Object} order - Order object
 * @returns {Object} Order summary
 */
function calculateOrderSummary(order) {
  const remaining = calculateRemainingPayment(
    order.productPrice,
    order.totalPaidAmount,
    order.dailyPaymentAmount
  );

  const paidCount = getPaidInstallmentsCount(order.paymentSchedule);
  const nextInstallment = getNextPendingInstallment(order.paymentSchedule);

  return {
    orderId: order.orderId,
    productPrice: order.productPrice,
    dailyPaymentAmount: order.dailyPaymentAmount,
    totalDays: order.totalDays,
    paidInstallments: paidCount,
    totalPaidAmount: order.totalPaidAmount,
    remainingAmount: remaining.remainingAmount,
    remainingInstallments: remaining.remainingInstallments,
    progress: remaining.progress,
    status: order.status,
    isCompleted: isOrderFullyPaid(order.productPrice, order.totalPaidAmount),
    nextDueDate: nextInstallment ? nextInstallment.dueDate : null,
    canMakePayment: order.status === 'ACTIVE' && remaining.remainingAmount > 0
  };
}

// ⭐ NEW: Calculate total product price (pricePerUnit × quantity)
/**
 * Calculate total product price with quantity
 * @param {number} pricePerUnit - Price per unit
 * @param {number} quantity - Quantity ordered
 * @returns {number} Total price
 */
function calculateTotalProductPrice(pricePerUnit, quantity = 1) {
  return pricePerUnit * quantity;
}

// ⭐ NEW: Apply INSTANT coupon (reduces price immediately)
/**
 * Apply INSTANT type coupon
 * @param {number} totalPrice - Total product price
 * @param {number} couponDiscount - Coupon discount amount
 * @returns {Object} { finalPrice, discountApplied }
 */
function applyInstantCoupon(totalPrice, couponDiscount) {
  const discountApplied = Math.min(couponDiscount, totalPrice);
  const finalPrice = totalPrice - discountApplied;
  return {
    finalPrice: Math.max(0, finalPrice),
    discountApplied
  };
}

// ⭐ NEW: Calculate free days for REDUCE_DAYS coupon
/**
 * Calculate how many days should be marked FREE for REDUCE_DAYS coupon
 * @param {number} couponDiscount - Coupon discount amount
 * @param {number} dailyAmount - Daily payment amount
 * @returns {Object} { freeDays, remainder }
 */
function calculateCouponDaysReduction(couponDiscount, dailyAmount) {
  const freeDays = Math.floor(couponDiscount / dailyAmount);
  const remainder = couponDiscount % dailyAmount;
  return {
    freeDays,
    remainder
  };
}

// ⭐ NEW: Check if payment is allowed today (one-per-day rule)
/**
 * Check if user can pay today based on last payment date
 * @param {Date} lastPaymentDate - Date of last payment
 * @returns {boolean} True if payment allowed today
 */
function canPayToday(lastPaymentDate) {
  if (!lastPaymentDate) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastPayment = new Date(lastPaymentDate);
  lastPayment.setHours(0, 0, 0, 0);

  return lastPayment.getTime() < today.getTime();
}

module.exports = {
  // ID Generators
  generateOrderId,
  generatePaymentId,
  generateTransactionId,

  // Business Logic
  getMaxAllowedDays,
  calculateDailyAmount,
  calculateCommission,
  splitCommission,
  validateInstallmentDuration,

  // Date Helpers
  addDays,

  // Payment Schedule
  generatePaymentSchedule,
  getNextPendingInstallment,
  getPaidInstallmentsCount,

  // Payment Calculations
  calculateRemainingPayment,
  isOrderFullyPaid,

  // ⭐ NEW: Quantity & Pricing
  calculateTotalProductPrice,
  applyInstantCoupon,
  calculateCouponDaysReduction,
  canPayToday,

  // Utilities
  formatCurrency,
  generateIdempotencyKey,
  sanitizePaymentResponse,
  calculateOrderSummary
};
