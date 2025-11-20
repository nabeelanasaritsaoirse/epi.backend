/**
 * Installment Payment Service
 *
 * Handles daily payment processing for installment orders.
 *
 * Features:
 * - Process payments via Razorpay or Wallet
 * - Idempotency to prevent duplicate processing
 * - Automatic commission calculation and crediting
 * - MongoDB transactions for atomicity
 * - Razorpay signature verification
 * - Order completion detection
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const InstallmentOrder = require('../models/InstallmentOrder');
const PaymentRecord = require('../models/PaymentRecord');
const User = require('../models/User');
const razorpay = require('../config/razorpay');
const {
  deductFromWallet,
  creditCommissionToWallet
} = require('./installmentWalletService');
const {
  calculateCommission,
  generateIdempotencyKey,
  isOrderFullyPaid
} = require('../utils/installmentHelpers');
const {
  OrderNotFoundError,
  OrderAlreadyCompletedError,
  UnauthorizedOrderAccessError,
  InvalidPaymentAmountError,
  InvalidOrderStatusError,
  PaymentAlreadyProcessedError,
  RazorpayVerificationError,
  TransactionFailedError
} = require('../utils/customErrors');

/**
 * Verify Razorpay payment signature
 *
 * @param {string} razorpayOrderId - Razorpay order ID
 * @param {string} razorpayPaymentId - Razorpay payment ID
 * @param {string} razorpaySignature - Razorpay signature
 * @returns {boolean} True if signature is valid
 * @throws {RazorpayVerificationError} If signature verification fails
 */
function verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (generatedSignature !== razorpaySignature) {
    throw new RazorpayVerificationError();
  }

  return true;
}

/**
 * Process daily installment payment
 *
 * Handles both Razorpay and Wallet payments.
 * Uses MongoDB transactions for atomic operations.
 * Automatically calculates and credits commission to referrer.
 *
 * @param {Object} paymentData - Payment data
 * @param {string} paymentData.orderId - Order ID
 * @param {string} paymentData.userId - User ID
 * @param {string} paymentData.paymentMethod - 'RAZORPAY' or 'WALLET'
 * @param {string} [paymentData.razorpayOrderId] - Razorpay order ID (required for Razorpay)
 * @param {string} [paymentData.razorpayPaymentId] - Razorpay payment ID (required for Razorpay)
 * @param {string} [paymentData.razorpaySignature] - Razorpay signature (required for Razorpay)
 * @returns {Promise<Object>} { payment, order, commission? }
 */
async function processPayment(paymentData) {
  const {
    orderId,
    userId,
    paymentMethod,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature
  } = paymentData;

  // ========================================
  // 1. Get and Validate Order
  // ========================================
  const order = await InstallmentOrder.findOne({
    $or: [{ _id: orderId }, { orderId }]
  }).populate('referrer', 'name email');

  if (!order) {
    throw new OrderNotFoundError(orderId);
  }

  // Verify user owns this order
  if (order.user.toString() !== userId) {
    throw new UnauthorizedOrderAccessError(orderId);
  }

  // Check order status
  if (order.status === 'COMPLETED') {
    throw new OrderAlreadyCompletedError(orderId);
  }

  if (order.status === 'CANCELLED') {
    throw new InvalidOrderStatusError(order.status, 'ACTIVE');
  }

  if (order.status !== 'ACTIVE') {
    throw new InvalidOrderStatusError(order.status, 'ACTIVE');
  }

  // Check if already fully paid
  if (isOrderFullyPaid(order.productPrice, order.totalPaidAmount)) {
    throw new OrderAlreadyCompletedError(orderId);
  }

  // ========================================
  // 2. Get Next Pending Installment
  // ========================================
  const nextInstallment = order.getNextPendingInstallment();

  if (!nextInstallment) {
    throw new Error('No pending installments found');
  }

  const installmentNumber = nextInstallment.installmentNumber;
  const paymentAmount = order.dailyPaymentAmount;

  // ========================================
  // 3. Check Idempotency (Prevent Duplicate Processing)
  // ========================================
  const idempotencyKey = generateIdempotencyKey(order._id.toString(), userId, installmentNumber);
  const existingPayment = await PaymentRecord.findByIdempotencyKey(idempotencyKey);

  if (existingPayment && existingPayment.status === 'COMPLETED') {
    throw new PaymentAlreadyProcessedError(existingPayment.paymentId);
  }

  // ========================================
  // 4. Verify Razorpay Signature (if Razorpay payment)
  // ========================================
  if (paymentMethod === 'RAZORPAY') {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new Error('Missing Razorpay payment details');
    }

    verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  }

  // ========================================
  // 5. Start MongoDB Transaction
  // ========================================
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let walletTransactionId = null;

    // ========================================
    // 6. Process Payment Based on Method
    // ========================================
    if (paymentMethod === 'WALLET') {
      // Deduct from wallet
      const walletDeduction = await deductFromWallet(
        userId,
        paymentAmount,
        `Installment ${installmentNumber} payment for ${order.productName}`,
        session,
        {
          orderId: order._id,
          installmentNumber
        }
      );

      walletTransactionId = walletDeduction.walletTransaction._id;
    }

    // ========================================
    // 7. Create Payment Record
    // ========================================
    const payment = new PaymentRecord({
      order: order._id,
      user: userId,
      amount: paymentAmount,
      installmentNumber,
      paymentMethod,
      razorpayOrderId: razorpayOrderId || null,
      razorpayPaymentId: razorpayPaymentId || null,
      razorpaySignature: razorpaySignature || null,
      razorpayVerified: paymentMethod === 'RAZORPAY' ? true : false,
      walletTransactionId,
      status: 'COMPLETED',
      idempotencyKey,
      processedAt: new Date(),
      completedAt: new Date()
    });

    await payment.save({ session });

    // ========================================
    // 8. Update Order
    // ========================================
    order.paidInstallments += 1;
    order.totalPaidAmount += paymentAmount;
    order.remainingAmount = Math.max(0, order.productPrice - order.totalPaidAmount);

    // Update payment schedule
    const scheduleIndex = order.paymentSchedule.findIndex(
      item => item.installmentNumber === installmentNumber
    );

    if (scheduleIndex !== -1) {
      order.paymentSchedule[scheduleIndex].status = 'PAID';
      order.paymentSchedule[scheduleIndex].paidDate = new Date();
      order.paymentSchedule[scheduleIndex].paymentId = payment._id;
    }

    // Check if order is fully paid
    if (isOrderFullyPaid(order.productPrice, order.totalPaidAmount)) {
      order.status = 'COMPLETED';
      order.completedAt = new Date();
    }

    await order.save({ session });

    // ========================================
    // 9. Calculate and Credit Commission (if referrer exists)
    // ========================================
    let commissionResult = null;

    if (order.referrer && order.productCommissionPercentage > 0) {
      const commissionAmount = calculateCommission(
        paymentAmount,
        order.productCommissionPercentage
      );

      commissionResult = await creditCommissionToWallet(
        order.referrer._id,
        commissionAmount,
        order._id.toString(),
        payment._id.toString(),
        session
      );

      // Update payment record with commission details
      payment.commissionCalculated = true;
      payment.commissionAmount = commissionAmount;
      payment.commissionPercentage = order.productCommissionPercentage;
      payment.commissionCreditedToReferrer = true;
      payment.commissionTransactionId = commissionResult.walletTransaction._id;

      await payment.save({ session });

      // Update order total commission
      order.totalCommissionPaid += commissionAmount;
      await order.save({ session });
    }

    // ========================================
    // 10. Commit Transaction
    // ========================================
    await session.commitTransaction();

    return {
      payment: payment.getSummary(),
      order: order.getSummary(),
      commission: commissionResult ? {
        amount: commissionResult.totalCommission,
        availableAmount: commissionResult.availableAmount,
        lockedAmount: commissionResult.lockedAmount,
        referrer: order.referrer?.name
      } : null
    };

  } catch (error) {
    await session.abortTransaction();
    console.error('Payment processing failed:', error);
    throw new TransactionFailedError(error.message);
  } finally {
    session.endSession();
  }
}

/**
 * Create Razorpay order for next installment payment
 *
 * @param {string} orderId - Order ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Razorpay order details
 */
async function createRazorpayOrderForPayment(orderId, userId) {
  // Get order
  const order = await InstallmentOrder.findOne({
    $or: [{ _id: orderId }, { orderId }]
  });

  if (!order) {
    throw new OrderNotFoundError(orderId);
  }

  // Verify user owns this order
  if (order.user.toString() !== userId) {
    throw new UnauthorizedOrderAccessError(orderId);
  }

  // Check order can accept payment
  if (!order.canAcceptPayment()) {
    throw new Error('Order cannot accept payment at this time');
  }

  // Get next installment
  const nextInstallment = order.getNextPendingInstallment();

  if (!nextInstallment) {
    throw new Error('No pending installments found');
  }

  // Create Razorpay order
  const razorpayOrder = await razorpay.orders.create({
    amount: order.dailyPaymentAmount * 100, // Convert to paise
    currency: 'INR',
    receipt: `order_${Date.now()}`,
    payment_capture: 1,
    notes: {
      orderId: order._id.toString(),
      installmentNumber: nextInstallment.installmentNumber,
      userId: userId
    }
  });

  return {
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
    installmentNumber: nextInstallment.installmentNumber,
    orderDetails: {
      orderId: order.orderId,
      productName: order.productName,
      dailyAmount: order.dailyPaymentAmount
    }
  };
}

/**
 * Get payment history for order
 *
 * @param {string} orderId - Order ID
 * @param {string} userId - User ID (for ownership verification)
 * @returns {Promise<Array>} Payment history
 */
async function getPaymentHistory(orderId, userId = null) {
  const order = await InstallmentOrder.findOne({
    $or: [{ _id: orderId }, { orderId }]
  });

  if (!order) {
    throw new OrderNotFoundError(orderId);
  }

  if (userId && order.user.toString() !== userId) {
    throw new UnauthorizedOrderAccessError(orderId);
  }

  const payments = await PaymentRecord.getByOrder(order._id);

  return payments;
}

/**
 * Get user's payment history
 *
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Payment history
 */
async function getUserPaymentHistory(userId, options = {}) {
  return PaymentRecord.getByUser(userId, options);
}

/**
 * Retry failed payment
 *
 * @param {string} paymentId - Payment ID
 * @returns {Promise<Object>} Updated payment
 */
async function retryFailedPayment(paymentId) {
  const payment = await PaymentRecord.findOne({
    $or: [{ _id: paymentId }, { paymentId }]
  });

  if (!payment) {
    throw new Error('Payment not found');
  }

  if (!payment.canRetry()) {
    throw new Error('Payment cannot be retried');
  }

  // Reset payment status for retry
  payment.status = 'PENDING';
  payment.errorMessage = null;
  await payment.save();

  return payment;
}

/**
 * Get payment statistics
 *
 * @param {string} userId - Optional user ID for user-specific stats
 * @returns {Promise<Object>} Payment statistics
 */
async function getPaymentStats(userId = null) {
  const query = userId ? { user: userId, status: 'COMPLETED' } : { status: 'COMPLETED' };

  const stats = await PaymentRecord.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$paymentMethod',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalCommission: { $sum: '$commissionAmount' }
      }
    }
  ]);

  return stats;
}

module.exports = {
  processPayment,
  createRazorpayOrderForPayment,
  getPaymentHistory,
  getUserPaymentHistory,
  retryFailedPayment,
  getPaymentStats,
  verifyRazorpaySignature
};
