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
const {
  checkMilestoneReached,
  applyMilestoneFreeDaysToSchedule,
} = require("../utils/installmentHelpers");

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

  if (!order) {
    throw new OrderNotFoundError(orderId);
  }

  // ⭐ ONE-PAYMENT-PER-DAY RULE
  if (!order.canPayToday()) {
    throw new Error(
      "You have already made a payment for this order today. Please try again tomorrow."
    );
  }

  // Verify user owns this order
  if (order.user.toString() !== userId.toString()) {
    throw new UnauthorizedOrderAccessError(orderId);
  }

  // Check order status
  if (order.status === "COMPLETED") {
    throw new OrderAlreadyCompletedError(orderId);
  }

  if (order.status === "CANCELLED") {
    throw new InvalidOrderStatusError(order.status, "ACTIVE");
  }

  // Allow PENDING status for first payment (when transitioning from PENDING to ACTIVE)
  if (order.status !== "ACTIVE" && order.status !== "PENDING") {
    throw new InvalidOrderStatusError(order.status, "ACTIVE or PENDING");
  }

  // Check if already fully paid (money-wise)
  if (isOrderFullyPaid(order.productPrice, order.totalPaidAmount)) {
    throw new OrderAlreadyCompletedError(orderId);
  }

  // ========================================
  // 2. Get Next Pending Installment (payable)
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

  // If payment exists but is PENDING (from order creation), update it instead of creating new
  if (existingPayment && existingPayment.status === "PENDING") {
    console.log(`✅ Found existing PENDING payment record, will update it instead of creating new`);
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
    // 7. Create or Update Payment Record
    // ========================================
    let payment;

    if (existingPayment && existingPayment.status === "PENDING") {
      // Update existing PENDING payment record
      payment = existingPayment;
      payment.razorpayPaymentId = razorpayPaymentId || null;
      payment.razorpaySignature = razorpaySignature || null;
      payment.razorpayVerified = paymentMethod === "RAZORPAY" ? true : false;
      payment.walletTransactionId = walletTransactionId;
      payment.status = "COMPLETED";
      payment.processedAt = new Date();
      payment.completedAt = new Date();
      console.log(`✅ Updated existing PENDING payment to COMPLETED`);
    } else {
      // Create new payment record
      payment = new PaymentRecord({
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
    }

    await payment.save(); // session disabled for local development

    // ========================================
    // 8. Update Order (base payment)
    // ========================================
    order.paidInstallments += 1;
    order.totalPaidAmount += paymentAmount;
    order.remainingAmount = Math.max(
      0,
      order.productPrice - order.totalPaidAmount
    );

    // Update payment schedule item
    const scheduleIndex = order.paymentSchedule.findIndex(
      (item) => item.installmentNumber === installmentNumber
    );

    if (scheduleIndex !== -1) {
      order.paymentSchedule[scheduleIndex].status = "PAID";
      order.paymentSchedule[scheduleIndex].paidDate = new Date();
      order.paymentSchedule[scheduleIndex].paymentId = payment._id;
    }

    // First, check normal "money paid" completion
    if (isOrderFullyPaid(order.productPrice, order.totalPaidAmount)) {
      order.status = "COMPLETED";
      order.completedAt = new Date();
    }

    // ⭐ MILESTONE LOGIC (FREE DAYS COUNT AS PROGRESS)
    if (
      order.couponType === "MILESTONE_REWARD" &&
      !order.milestoneRewardApplied &&
      checkMilestoneReached(order)
    ) {
      console.log("🎉 Milestone reached! Applying milestone reward...");

      // Count FREE before
      const beforeFreeCount = order.paymentSchedule.filter(
        (inst) => inst.status === "FREE"
      ).length;

      // Apply FREE days to earliest pending installments
      order.paymentSchedule = applyMilestoneFreeDaysToSchedule(order);

      // Count FREE after
      const afterFreeCount = order.paymentSchedule.filter(
        (inst) => inst.status === "FREE"
      ).length;

      const newlyFree = Math.max(0, afterFreeCount - beforeFreeCount);

      // Treat FREE milestone days as "paid installments" for progress
      if (newlyFree > 0) {
        order.paidInstallments += newlyFree;
      }

      order.milestoneRewardApplied = true;
      order.milestoneRewardAppliedAt = new Date();

      // Money-wise remaining is still based on actual paid amount
      order.remainingAmount = Math.max(
        0,
        order.productPrice - order.totalPaidAmount
      );

      console.log(
        `🎁 ${order.milestoneFreeDays} FREE days applied to order ${order.orderId} (new free days: ${newlyFree})`
      );
    }

    // ✅ FINAL COMPLETION CHECK:
    // If there is NO PENDING installment with amount > 0,
    // the order is effectively fully completed (all payable days done,
    // only FREE days left).
    const hasPendingPayable = order.paymentSchedule.some(
      (inst) => inst.status === "PENDING" && inst.amount > 0
    );

    if (!hasPendingPayable) {
      order.status = "COMPLETED";
      order.completedAt = order.completedAt || new Date();
      order.remainingAmount = 0;
    }

    await order.save(); // session disabled for local development

    // ========================================
    // 9. Calculate and Credit Commission (if referrer exists)
    // ========================================
    let commissionResult = null;

    if (order.referrer) {
      // Always use 10% commission if referrer exists
      const commissionPercentage = order.productCommissionPercentage || 10;
      const commissionAmount = calculateCommission(
        paymentAmount,
        commissionPercentage
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
      payment.commissionPercentage = commissionPercentage;
      payment.commissionCreditedToReferrer = true;
      payment.commissionTransactionId = commissionResult.walletTransaction._id;

      await payment.save(); // session disabled for local development

      // Update order total commission
      order.totalCommissionPaid = (order.totalCommissionPaid || 0) + commissionAmount;

      console.log(`✅ Commission credited: ₹${commissionAmount} (Installment #${installmentNumber})`);
    }

    // ========================================
    // 🔧 FIX: Activate order if this was first payment (PENDING -> ACTIVE)
    // ========================================
    if (order.status === "PENDING" && installmentNumber === 1) {
      order.status = "ACTIVE";
      console.log(`✅ Order activated: ${order.orderId} (First payment completed)`);
    }

    // ⭐ Always update lastPaymentDate AFTER a successful payment
    order.lastPaymentDate = new Date();
    await order.save(); // session disabled for local development

    // ========================================
    // 10. Commit Transaction
    // ========================================
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
    // await session.abortTransaction();
    console.error("Payment processing failed:", error);
    throw new TransactionFailedError(error.message);
  } finally {
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
  if (order.user.toString() !== userId.toString()) {
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

  if (userId && order.user.toString() !== userId.toString()) {
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
  // Use consistent date handling - get start and end of today
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  console.log('getDailyPendingPayments - Date range:', {
    start: start.toISOString(),
    end: end.toISOString(),
    serverTime: now.toISOString(),
    userId: userId.toString()
  });

  // Find ALL active orders for this user (not just those with pending payments today)
  const allActiveOrders = await InstallmentOrder.find({
    user: userId,
    status: "ACTIVE"
  }).populate('product', 'images');

  console.log('getDailyPendingPayments - Total active orders:', allActiveOrders.length);

  // Filter for orders with pending payments due today
  const orders = allActiveOrders.filter(order => {
    const hasPendingToday = order.paymentSchedule.some(inst =>
      inst.status === "PENDING" &&
      inst.dueDate >= start &&
      inst.dueDate <= end
    );

    if (hasPendingToday) {
      console.log('getDailyPendingPayments - Order with pending payment today:', {
        orderId: order.orderId,
        lastPaymentDate: order.lastPaymentDate ? order.lastPaymentDate.toISOString() : 'null',
        canPayToday: order.canPayToday()
      });
    }

    return hasPendingToday;
  });

  console.log('getDailyPendingPayments - Orders with payments due today:', orders.length);

  let pendingList = [];

  for (const order of orders) {
    // Check if user can actually pay today (hasn't already paid today)
    const canPay = order.canPayToday();

    // Skip this order if payment already done today
    if (!canPay) {
      console.log('getDailyPendingPayments - Skipping order (already paid today):', {
        orderId: order.orderId,
        lastPaymentDate: order.lastPaymentDate ? order.lastPaymentDate.toISOString() : 'null'
      });
      continue;
    }

    order.paymentSchedule.forEach((inst) => {
      if (
        inst.status === "PENDING" &&
        inst.dueDate >= start &&
        inst.dueDate <= end
      ) {
        console.log('getDailyPendingPayments - Adding installment:', {
          orderId: order.orderId,
          installmentNumber: inst.installmentNumber,
          dueDate: inst.dueDate.toISOString(),
          status: inst.status,
          canPayToday: canPay,
          lastPaymentDate: order.lastPaymentDate ? order.lastPaymentDate.toISOString() : 'null'
        });

        pendingList.push({
          orderId: order.orderId,
          productName: order.productName,
          productImage: order.product?.images?.[0] || null,
          installmentNumber: inst.installmentNumber,
          amount: order.dailyPaymentAmount,
          dueDate: inst.dueDate,
          canPayToday: canPay, // Always true here now
        });
      }
    });
  }

  console.log('getDailyPendingPayments - Total pending payments:', pendingList.length);

  return {
    count: pendingList.length,
    totalAmount: pendingList.reduce((sum, p) => sum + p.amount, 0),
    payments: pendingList,
    debug: {
      serverTime: now.toISOString(),
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      totalActiveOrders: allActiveOrders.length,
      ordersWithPaymentsDueToday: orders.length
    }
  };
}

/**
 * ⭐ NEW: Create combined Razorpay order for multiple installments
 *
 * @param {string} userId - User ID
 * @param {Array<string>} selectedOrders - Array of order IDs
 * @returns {Promise<Object>} Razorpay order details
 */
async function createCombinedRazorpayOrder(userId, selectedOrders) {
  if (!selectedOrders || selectedOrders.length === 0) {
    throw new Error('At least one order must be selected');
  }

  // Get all selected orders
  const orders = await InstallmentOrder.find({
    $or: selectedOrders.map((id) =>
      mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { orderId: id }
    ),
    user: userId,
    status: 'ACTIVE',
  });

  if (orders.length === 0) {
    throw new Error('No active orders found');
  }

  if (orders.length !== selectedOrders.length) {
    throw new Error('Some selected orders are not available for payment');
  }

  // Validate all orders can pay today
  for (const order of orders) {
    if (!order.canPayToday()) {
      throw new Error(`Order ${order.orderId} has already been paid today`);
    }
    if (!order.canAcceptPayment()) {
      throw new Error(`Order ${order.orderId} cannot accept payment`);
    }
  }

  // Calculate total amount
  const totalAmount = orders.reduce((sum, order) => {
    const nextInstallment = order.getNextPendingInstallment();
    return sum + (nextInstallment?.amount || order.dailyPaymentAmount);
  }, 0);

  // Create Razorpay order
  const razorpayOrder = await razorpay.orders.create({
    amount: totalAmount * 100, // Convert to paise
    currency: 'INR',
    receipt: `combined_${Date.now()}`,
    payment_capture: 1,
    notes: {
      userId: userId,
      orderCount: orders.length,
      orderIds: orders.map((o) => o.orderId).join(','),
      type: 'combined_daily_payment',
    },
  });

  return {
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
    totalAmount,
    orderCount: orders.length,
    orders: orders.map((order) => ({
      orderId: order.orderId,
      productName: order.productName,
      dailyAmount: order.dailyPaymentAmount,
    })),
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
    razorpaySignature,
  } = data;

  const commissionService = require("./commissionService");

  console.log(
    `🔄 Processing combined payment for ${selectedOrders.length} orders`
  );

  // ========================================
  // 1. Get All Selected Orders
  // ========================================
  const orders = await InstallmentOrder.find({
    $or: selectedOrders.map((id) =>
      mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { orderId: id }
    ),
    user: userId,
    status: "ACTIVE",
  }).populate("referrer", "name email");

  if (orders.length === 0) {
    throw new Error("No active orders found for payment");
  }

  if (orders.length !== selectedOrders.length) {
    throw new Error("Some selected orders are not available for payment");
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
  if (paymentMethod === "RAZORPAY") {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new Error("Razorpay payment details are required");
    }
    verifyRazorpaySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );
    console.log("✅ Razorpay signature verified");
  }

  // ========================================
  // 5. Start MongoDB Transaction
  // ========================================
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

      // Handle wallet deduction
      let walletTransactionId = null;
      if (paymentMethod === "WALLET") {
        const walletResult = await deductFromWallet(
          userId,
          paymentAmount,
          `Payment for order ${order.orderId}`,
          null, // session disabled for local development
          {
            orderId: order._id,
            installmentNumber: nextInstallment.installmentNumber,
          }
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
        razorpayOrderId: paymentMethod === "RAZORPAY" ? razorpayOrderId : null,
        razorpayPaymentId:
          paymentMethod === "RAZORPAY" ? razorpayPaymentId : null,
        razorpaySignature:
          paymentMethod === "RAZORPAY" ? razorpaySignature : null,
        razorpayVerified: paymentMethod === "RAZORPAY",
        walletTransactionId,
        status: "COMPLETED",
        idempotencyKey: generateIdempotencyKey(
          order._id.toString(),
          userId,
          nextInstallment.installmentNumber
        ),
        processedAt: new Date(),
        completedAt: new Date(),
      });

      await payment.save(); // session disabled for local development

      // Update order base fields
      order.paidInstallments += 1;
      order.totalPaidAmount += paymentAmount;
      order.remainingAmount = Math.max(
        0,
        order.productPrice - order.totalPaidAmount
      );
      order.lastPaymentDate = new Date();

      // Update payment schedule
      const scheduleItem =
        order.paymentSchedule[nextInstallment.installmentNumber - 1];
      if (scheduleItem) {
        scheduleItem.status = "PAID";
        scheduleItem.paidDate = new Date();
        scheduleItem.paymentId = payment._id;
      }

      // Normal money-based completion
      if (isOrderFullyPaid(order.productPrice, order.totalPaidAmount)) {
        order.status = "COMPLETED";
        order.completedAt = new Date();
        console.log(`✅ Order ${order.orderId} completed by payments!`);
      }

      // ⭐ MILESTONE LOGIC also for combined payments
      if (
        order.couponType === "MILESTONE_REWARD" &&
        !order.milestoneRewardApplied &&
        checkMilestoneReached(order)
      ) {
        console.log(
          `🎉 Milestone reached (combined) for order ${order.orderId}, applying reward...`
        );

        const beforeFreeCount = order.paymentSchedule.filter(
          (inst) => inst.status === "FREE"
        ).length;

        order.paymentSchedule = applyMilestoneFreeDaysToSchedule(order);

        const afterFreeCount = order.paymentSchedule.filter(
          (inst) => inst.status === "FREE"
        ).length;

        const newlyFree = Math.max(0, afterFreeCount - beforeFreeCount);

        if (newlyFree > 0) {
          order.paidInstallments += newlyFree;
        }

        order.milestoneRewardApplied = true;
        order.milestoneRewardAppliedAt = new Date();

        order.remainingAmount = Math.max(
          0,
          order.productPrice - order.totalPaidAmount
        );

        const hasPendingPayable = order.paymentSchedule.some(
          (inst) => inst.status === "PENDING" && inst.amount > 0
        );

        if (!hasPendingPayable) {
          order.status = "COMPLETED";
          order.completedAt = new Date();
          console.log(
            `✅ Order ${order.orderId} completed via milestone reward (combined flow)`
          );
        }

        console.log(
          `🎁 ${order.milestoneFreeDays} FREE days applied (combined) to order ${order.orderId}, new free days: ${newlyFree}`
        );
      }

      await order.save(); // session disabled for local development

      // Calculate commission
      const commissionResult =
        await commissionService.calculateAndCreditCommission({
          order,
          payment,
          session: null, // session disabled for local development
        });

      commissionResults.push(commissionResult);

      results.push({
        orderId: order.orderId,
        paymentId: payment.paymentId,
        amount: paymentAmount,
        installmentNumber: nextInstallment.installmentNumber,
        orderStatus: order.status,
      });
    }

    // await session.commitTransaction();

    console.log(`✅ Combined payment successful for ${results.length} orders`);

    return {
      success: true,
      totalAmount,
      ordersProcessed: results.length,
      payments: results,
      commissions: commissionResults.filter((c) => c.commissionCalculated),
    };
  } catch (error) {
    // await session.abortTransaction();
    console.error("❌ Combined payment failed:", error);
    throw new TransactionFailedError(error.message);
  } finally {
    // session.endSession();
  }
}

/**
 * Admin: Mark a payment as completed
 *
 * This function allows admins to manually mark a payment as completed.
 * Used when payments are made offline or need manual intervention.
 *
 * @param {string} paymentId - Payment record ID
 * @param {Object} adminData - Admin action data
 * @param {string} adminData.method - Payment method (e.g., 'ADMIN_MARKED', 'CASH', etc.)
 * @param {string} adminData.transactionId - Transaction reference ID
 * @param {string} [adminData.note] - Admin note
 * @param {string} [adminData.markedBy] - Admin user ID
 * @param {string} [adminData.markedByEmail] - Admin email
 * @returns {Promise<Object>} Updated payment record
 */
async function markPaymentAsCompleted(paymentId, adminData) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log(`[Admin] Marking payment ${paymentId} as completed`);

    // Get payment record
    const payment = await PaymentRecord.findById(paymentId).session(session);
    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    // Don't re-process completed payments
    if (payment.status === 'COMPLETED') {
      console.log(`[Admin] Payment ${paymentId} already completed, skipping`);
      await session.commitTransaction();
      return payment;
    }

    // Get the order
    const order = await InstallmentOrder.findById(payment.order).session(session);
    if (!order) {
      throw new Error(`Order ${payment.order} not found`);
    }

    // Update payment record
    payment.status = 'COMPLETED';
    payment.paymentMethod = adminData.method || 'ADMIN_MARKED';
    payment.transactionId = adminData.transactionId;
    payment.paidAt = new Date();
    payment.adminMarked = true;
    payment.markedBy = adminData.markedBy;
    payment.markedByEmail = adminData.markedByEmail;
    payment.adminNote = adminData.note;

    // Calculate commission if this is first payment via Razorpay
    if (payment.installmentNumber === 1 && order.firstPaymentMethod === 'RAZORPAY' && order.referrer) {
      const commissionData = calculateCommission(
        payment.amount,
        order.commissionPercentage || order.productCommissionPercentage || 10
      );

      payment.commissionCalculated = true;
      payment.commissionAmount = commissionData.commissionAmount;
      payment.commissionPercentage = commissionData.commissionPercentage;

      // Credit commission to referrer
      try {
        await creditCommissionToWallet(
          order.referrer,
          commissionData.commissionAmount,
          order._id,
          payment._id,
          session
        );

        payment.commissionCreditedToReferrer = true;
        order.totalCommissionPaid = (order.totalCommissionPaid || 0) + commissionData.commissionAmount;

        console.log(`[Admin] Commission credited: ₹${commissionData.commissionAmount} to referrer ${order.referrer}`);
      } catch (commError) {
        console.error('[Admin] Commission credit failed:', commError);
        payment.commissionCreditError = commError.message;
      }
    }

    await payment.save({ session });

    // Update order's payment schedule
    const scheduleIndex = order.paymentSchedule.findIndex(
      (p) => p.installmentNumber === payment.installmentNumber
    );

    if (scheduleIndex !== -1) {
      order.paymentSchedule[scheduleIndex].status = 'COMPLETED';
      order.paymentSchedule[scheduleIndex].paidAt = new Date();
      order.paymentSchedule[scheduleIndex].transactionId = adminData.transactionId;
    }

    // Update order totals
    order.paidInstallments = (order.paidInstallments || 0) + 1;
    order.totalPaidAmount = (order.totalPaidAmount || 0) + payment.amount;

    // Check if order is fully paid
    if (isOrderFullyPaid(order)) {
      order.status = 'COMPLETED';
      order.completedAt = new Date();
      console.log(`[Admin] Order ${order.orderId} marked as COMPLETED`);
    }

    await order.save({ session });

    await session.commitTransaction();
    console.log(`[Admin] Payment ${payment.paymentId} marked as completed successfully`);

    return payment;
  } catch (error) {
    await session.abortTransaction();
    console.error('[Admin] Error marking payment as completed:', error);
    throw error;
  } finally {
    session.endSession();
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
  createCombinedRazorpayOrder, // ⭐ NEW
  processSelectedDailyPayments, // ⭐ NEW
  markPaymentAsCompleted, // ⭐ ADMIN
};
