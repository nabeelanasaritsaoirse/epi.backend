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

const mongoose = require("mongoose");
const crypto = require("crypto");
const InstallmentOrder = require("../models/InstallmentOrder");
const PaymentRecord = require("../models/PaymentRecord");
const User = require("../models/User");
const razorpay = require("../config/razorpay");
const {
  deductFromWallet,
  creditCommissionToWallet,
} = require("./installmentWalletService");
const {
  calculateCommission,
  generateIdempotencyKey,
  isOrderFullyPaid,
} = require("../utils/installmentHelpers");
const {
  OrderNotFoundError,
  OrderAlreadyCompletedError,
  UnauthorizedOrderAccessError,
  InvalidPaymentAmountError,
  InvalidOrderStatusError,
  PaymentAlreadyProcessedError,
  RazorpayVerificationError,
  TransactionFailedError,
} = require("../utils/customErrors");

/**
 * Verify Razorpay payment signature
 *
 * @param {string} razorpayOrderId - Razorpay order ID
 * @param {string} razorpayPaymentId - Razorpay payment ID
 * @param {string} razorpaySignature - Razorpay signature
 * @returns {boolean} True if signature is valid
 * @throws {RazorpayVerificationError} If signature verification fails
 */
function verifyRazorpaySignature(
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature
) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const generatedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

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
    razorpaySignature,
  } = paymentData;

  // ========================================
  // 1. Get and Validate Order
  // ========================================
  const order = await InstallmentOrder.findOne({
    $or: [{ _id: orderId }, { orderId }],
  }).populate("referrer", "name email");

  // ⭐ NEW: Check one-payment-per-day rule
  if (!order.canPayToday()) {
    throw new Error('You have already made a payment for this order today. Please try again tomorrow.');
  }

  if (!order) {
    throw new OrderNotFoundError(orderId);
  }

  // Verify user owns this order
  if (order.user.toString() !== userId) {
    throw new UnauthorizedOrderAccessError(orderId);
  }

  // Check order status
  if (order.status === "COMPLETED") {
    throw new OrderAlreadyCompletedError(orderId);
  }

  if (order.status === "CANCELLED") {
    throw new InvalidOrderStatusError(order.status, "ACTIVE");
  }

  if (order.status !== "ACTIVE") {
    throw new InvalidOrderStatusError(order.status, "ACTIVE");
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
    throw new Error("No pending installments found");
  }

  const installmentNumber = nextInstallment.installmentNumber;
  const paymentAmount = order.dailyPaymentAmount;

  // ========================================
  // 3. Check Idempotency (Prevent Duplicate Processing)
  // ========================================
  const idempotencyKey = generateIdempotencyKey(
    order._id.toString(),
    userId,
    installmentNumber
  );
  const existingPayment = await PaymentRecord.findByIdempotencyKey(
    idempotencyKey
  );

  if (existingPayment && existingPayment.status === "COMPLETED") {
    throw new PaymentAlreadyProcessedError(existingPayment.paymentId);
  }

  // ========================================
  // 4. Verify Razorpay Signature (if Razorpay payment)
  // ========================================
  if (paymentMethod === "RAZORPAY") {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new Error("Missing Razorpay payment details");
    }

    verifyRazorpaySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );
  }

  // ========================================
  // 5. Start MongoDB Transaction
  // ========================================
  // DISABLED FOR LOCAL DEVELOPMENT: MongoDB transactions require replica set
  // Uncomment for production use with replica set
  // const session = await mongoose.startSession();
  // session.startTransaction();
  const session = null; // Disabled for local development

  try {
    let walletTransactionId = null;

    // ========================================
    // 6. Process Payment Based on Method
    // ========================================
    if (paymentMethod === "WALLET") {
      // Deduct from wallet
      const walletDeduction = await deductFromWallet(
        userId,
        paymentAmount,
        `Installment ${installmentNumber} payment for ${order.productName}`,
        null, // session disabled for local development
        {
          orderId: order._id,
          installmentNumber,
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
      razorpayVerified: paymentMethod === "RAZORPAY" ? true : false,
      walletTransactionId,
      status: "COMPLETED",
      idempotencyKey,
      processedAt: new Date(),
      completedAt: new Date(),
    });

    await payment.save(); // session disabled for local development

    // ========================================
    // 8. Update Order
    // ========================================
    order.paidInstallments += 1;
    order.totalPaidAmount += paymentAmount;
    order.remainingAmount = Math.max(
      0,
      order.productPrice - order.totalPaidAmount
    );

    // Update payment schedule
    const scheduleIndex = order.paymentSchedule.findIndex(
      (item) => item.installmentNumber === installmentNumber
    );

    if (scheduleIndex !== -1) {
      order.paymentSchedule[scheduleIndex].status = "PAID";
      order.paymentSchedule[scheduleIndex].paidDate = new Date();
      order.paymentSchedule[scheduleIndex].paymentId = payment._id;
    }

    // Check if order is fully paid
    if (isOrderFullyPaid(order.productPrice, order.totalPaidAmount)) {
      order.status = "COMPLETED";
      order.completedAt = new Date();
    }

    await order.save(); // session disabled for local development

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
        null // session disabled for local development
      );

      // Update payment record with commission details
      payment.commissionCalculated = true;
      payment.commissionAmount = commissionAmount;
      payment.commissionPercentage = order.productCommissionPercentage;
      payment.commissionCreditedToReferrer = true;
      payment.commissionTransactionId = commissionResult.walletTransaction._id;

      await payment.save(); // session disabled for local development

      // Update order total commission
      order.totalCommissionPaid += commissionAmount;

      // ⭐ NEW: Update lastPaymentDate for one-per-day rule
      order.lastPaymentDate = new Date();

      await order.save(); // session disabled for local development
    }

    // ========================================
    // 10. Commit Transaction
    // ========================================
    // DISABLED FOR LOCAL DEVELOPMENT: MongoDB transactions require replica set
    // await session.commitTransaction();

    return {
      payment: payment.getSummary(),
      order: order.getSummary(),
      commission: commissionResult
        ? {
            amount: commissionResult.totalCommission,
            availableAmount: commissionResult.availableAmount,
            lockedAmount: commissionResult.lockedAmount,
            referrer: order.referrer?.name,
          }
        : null,
    };
  } catch (error) {
    // DISABLED FOR LOCAL DEVELOPMENT: MongoDB transactions require replica set
    // await session.abortTransaction();
    console.error("Payment processing failed:", error);
    throw new TransactionFailedError(error.message);
  } finally {
    // DISABLED FOR LOCAL DEVELOPMENT: MongoDB transactions require replica set
    // session.endSession();
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
    $or: [{ _id: orderId }, { orderId }],
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
    throw new Error("Order cannot accept payment at this time");
  }

  // Get next installment
  const nextInstallment = order.getNextPendingInstallment();

  if (!nextInstallment) {
    throw new Error("No pending installments found");
  }

  // Create Razorpay order
  const razorpayOrder = await razorpay.orders.create({
    amount: order.dailyPaymentAmount * 100, // Convert to paise
    currency: "INR",
    receipt: `order_${Date.now()}`,
    payment_capture: 1,
    notes: {
      orderId: order._id.toString(),
      installmentNumber: nextInstallment.installmentNumber,
      userId: userId,
    },
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
      dailyAmount: order.dailyPaymentAmount,
    },
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
    $or: [{ _id: orderId }, { orderId }],
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
    $or: [{ _id: paymentId }, { paymentId }],
  });

  if (!payment) {
    throw new Error("Payment not found");
  }

  if (!payment.canRetry()) {
    throw new Error("Payment cannot be retried");
  }

  // Reset payment status for retry
  payment.status = "PENDING";
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
  const query = userId
    ? { user: userId, status: "COMPLETED" }
    : { status: "COMPLETED" };

  const stats = await PaymentRecord.aggregate([
    { $match: query },
    {
      $group: {
        _id: "$paymentMethod",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
        totalCommission: { $sum: "$commissionAmount" },
      },
    },
  ]);

  return stats;
}
/**
 * Get daily pending installment payments for user
 */
async function getDailyPendingPayments(userId) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const orders = await InstallmentOrder.find({
    user: userId,
    status: "ACTIVE",
    paymentSchedule: {
      $elemMatch: {
        status: "PENDING",
        dueDate: { $gte: start, $lte: end },
      },
    },
  });

  let pendingList = [];

  for (const order of orders) {
    order.paymentSchedule.forEach((inst) => {
      if (
        inst.status === "PENDING" &&
        inst.dueDate >= start &&
        inst.dueDate <= end
      ) {
        pendingList.push({
          orderId: order.orderId,
          productName: order.productName,
          installmentNumber: inst.installmentNumber,
          amount: order.dailyPaymentAmount,
          dueDate: inst.dueDate,
        });
      }
    });
  }

  return {
    count: pendingList.length,
    totalAmount: pendingList.reduce((sum, p) => sum + p.amount, 0),
    payments: pendingList,
  };
}

/**
 * ⭐ NEW: Process combined daily payment for multiple orders
 *
 * Allows user to pay for multiple orders in a single transaction.
 * Creates one Razorpay order for total amount, then distributes to individual orders.
 *
 * @param {Object} data - Combined payment data
 * @param {string} data.userId - User ID
 * @param {Array<string>} data.selectedOrders - Array of order IDs to pay
 * @param {string} data.paymentMethod - 'RAZORPAY' or 'WALLET'
 * @param {string} [data.razorpayOrderId] - Razorpay order ID (for verification)
 * @param {string} [data.razorpayPaymentId] - Razorpay payment ID (for verification)
 * @param {string} [data.razorpaySignature] - Razorpay signature (for verification)
 * @returns {Promise<Object>} Combined payment result
 */
async function processSelectedDailyPayments(data) {
  const {
    userId,
    selectedOrders,
    paymentMethod,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature
  } = data;

  const commissionService = require('./commissionService');

  console.log(`🔄 Processing combined payment for ${selectedOrders.length} orders`);

  // ========================================
  // 1. Get All Selected Orders
  // ========================================
  const orders = await InstallmentOrder.find({
    $or: selectedOrders.map(id =>
      mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { orderId: id }
    ),
    user: userId,
    status: 'ACTIVE'
  }).populate('referrer', 'name email');

  if (orders.length === 0) {
    throw new Error('No active orders found for payment');
  }

  if (orders.length !== selectedOrders.length) {
    throw new Error('Some selected orders are not available for payment');
  }

  // ========================================
  // 2. Validate All Orders Can Pay Today
  // ========================================
  for (const order of orders) {
    if (!order.canPayToday()) {
      throw new Error(`Order ${order.orderId} has already been paid today`);
    }
    if (!order.canAcceptPayment()) {
      throw new Error(`Order ${order.orderId} cannot accept payment`);
    }
  }

  // ========================================
  // 3. Calculate Total Amount
  // ========================================
  const totalAmount = orders.reduce((sum, order) => {
    const nextInstallment = order.getNextPendingInstallment();
    return sum + (nextInstallment?.amount || order.dailyPaymentAmount);
  }, 0);

  console.log(`💰 Total amount for combined payment: ₹${totalAmount}`);

  // ========================================
  // 4. Verify Razorpay Payment (if applicable)
  // ========================================
  if (paymentMethod === 'RAZORPAY') {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new Error('Razorpay payment details are required');
    }
    verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    console.log('✅ Razorpay signature verified');
  }

  // ========================================
  // 5. Start MongoDB Transaction
  // ========================================
  // DISABLED FOR LOCAL DEVELOPMENT: MongoDB transactions require replica set
  // Uncomment for production use with replica set
  // const session = await mongoose.startSession();
  // session.startTransaction();
  const session = null; // Disabled for local development

  try {
    const results = [];
    const commissionResults = [];

    // ========================================
    // 6. Process Each Order Payment
    // ========================================
    for (const order of orders) {
      const nextInstallment = order.getNextPendingInstallment();
      const paymentAmount = nextInstallment?.amount || order.dailyPaymentAmount;

      // Handle wallet deduction (only for first order, we already verified total)
      let walletTransactionId = null;
      if (paymentMethod === 'WALLET') {
        // Deduct individual amount for this order
        const walletResult = await deductFromWallet(
          userId,
          paymentAmount,
          `Payment for order ${order.orderId}`,
          null, // session disabled for local development
          { orderId: order._id, installmentNumber: nextInstallment.installmentNumber }
        );
        walletTransactionId = walletResult.walletTransaction._id;
      }

      // Create payment record
      const payment = new PaymentRecord({
        order: order._id,
        user: userId,
        amount: paymentAmount,
        installmentNumber: nextInstallment.installmentNumber,
        paymentMethod,
        razorpayOrderId: paymentMethod === 'RAZORPAY' ? razorpayOrderId : null,
        razorpayPaymentId: paymentMethod === 'RAZORPAY' ? razorpayPaymentId : null,
        razorpaySignature: paymentMethod === 'RAZORPAY' ? razorpaySignature : null,
        razorpayVerified: paymentMethod === 'RAZORPAY',
        walletTransactionId,
        status: 'COMPLETED',
        idempotencyKey: generateIdempotencyKey(order._id.toString(), userId, nextInstallment.installmentNumber),
        processedAt: new Date(),
        completedAt: new Date()
      });

      await payment.save(); // session disabled for local development

      // Update order
      order.paidInstallments += 1;
      order.totalPaidAmount += paymentAmount;
      order.lastPaymentDate = new Date();  // ⭐ NEW

      // Update payment schedule
      const scheduleItem = order.paymentSchedule[nextInstallment.installmentNumber - 1];
      scheduleItem.status = 'PAID';
      scheduleItem.paidDate = new Date();
      scheduleItem.paymentId = payment._id;

      // Check if order is fully paid
      if (isOrderFullyPaid(order.productPrice, order.totalPaidAmount)) {
        order.status = 'COMPLETED';
        order.completedAt = new Date();
        console.log(`✅ Order ${order.orderId} completed!`);
      }

      await order.save(); // session disabled for local development

      // Calculate commission
      const commissionResult = await commissionService.calculateAndCreditCommission({
        order,
        payment,
        session: null // session disabled for local development
      });

      commissionResults.push(commissionResult);

      results.push({
        orderId: order.orderId,
        paymentId: payment.paymentId,
        amount: paymentAmount,
        installmentNumber: nextInstallment.installmentNumber,
        orderStatus: order.status
      });
    }

    // ========================================
    // 7. Commit Transaction
    // ========================================
    // DISABLED FOR LOCAL DEVELOPMENT: MongoDB transactions require replica set
    // await session.commitTransaction();

    console.log(`✅ Combined payment successful for ${results.length} orders`);

    return {
      success: true,
      totalAmount,
      ordersProcessed: results.length,
      payments: results,
      commissions: commissionResults.filter(c => c.commissionCalculated)
    };

  } catch (error) {
    // DISABLED FOR LOCAL DEVELOPMENT: MongoDB transactions require replica set
    // await session.abortTransaction();
    console.error('❌ Combined payment failed:', error);
    throw new TransactionFailedError(error.message);
  } finally {
    // DISABLED FOR LOCAL DEVELOPMENT: MongoDB transactions require replica set
    // session.endSession();
  }
}

module.exports = {
  processPayment,
  createRazorpayOrderForPayment,
  getPaymentHistory,
  getUserPaymentHistory,
  retryFailedPayment,
  getPaymentStats,
  verifyRazorpaySignature,
  getDailyPendingPayments,
  processSelectedDailyPayments,  // ⭐ NEW
};
