/**
 * Installment Order Service
 *
 * Handles order creation and management for installment-based purchases.
 *
 * Features:
 * - Create orders with payment schedules
 * - Process first payment immediately (Razorpay or Wallet)
 * - MongoDB transactions for atomicity
 * - Referrer commission tracking
 * - Product snapshot preservation
 */

const mongoose = require("mongoose");
const InstallmentOrder = require("../models/InstallmentOrder");
const PaymentRecord = require("../models/PaymentRecord");
const Product = require("../models/Product");
const User = require("../models/User");
const razorpay = require("../config/razorpay");
const {
  calculateDailyAmount,
  generatePaymentSchedule,
  validateInstallmentDuration,
  getMaxAllowedDays,
  generateOrderId,
  generateIdempotencyKey, // For first payment idempotency
  calculateTotalProductPrice, // ⭐ NEW
  applyInstantCoupon, // ⭐ NEW
  calculateCouponDaysReduction, // ⭐ NEW
} = require("../utils/installmentHelpers");
const {
  deductFromWallet,
  creditCommissionToWallet,
} = require("./installmentWalletService");
const {
  ProductNotFoundError,
  UserNotFoundError,
  InvalidInstallmentDurationError,
  ProductOutOfStockError,
  TransactionFailedError,
} = require("../utils/customErrors");

/**
 * Create new installment order with first payment
 *
 * Process Flow:
 * 1. Validate product and user
 * 2. Calculate daily amount and validate duration
 * 3. Generate payment schedule
 * 4. Create Razorpay order OR process wallet deduction
 * 5. Create order and first payment record
 * 6. If wallet payment, process commission immediately
 *
 * @param {Object} orderData - Order creation data
 * @param {string} orderData.userId - User ID
 * @param {string} orderData.productId - Product ID
 * @param {number} orderData.totalDays - Total installment days
 * @param {number} [orderData.dailyAmount] - Optional daily amount (calculated if not provided)
 * @param {string} orderData.paymentMethod - 'RAZORPAY' or 'WALLET'
 * @param {Object} orderData.deliveryAddress - Delivery address object
 * @returns {Promise<Object>} { order, firstPayment, razorpayOrder? }
 */
async function createOrder(orderData) {
  const {
    userId,
    productId,
    variantId,
    quantity = 1,
    couponCode,
    totalDays,
    dailyAmount,
    paymentMethod,
    deliveryAddress,
  } = orderData;

  // Validate inputs
  if (quantity < 1 || quantity > 10) {
    throw new Error("Quantity must be between 1 and 10");
  }

  if (!totalDays || isNaN(totalDays) || totalDays < 1) {
    throw new Error(`Invalid totalDays: ${totalDays}. Must be a positive number.`);
  }

  console.log("\n========================================");
  console.log("🔍 DEBUG: Service - createOrder called");
  console.log("========================================");
  console.log(`🔍 DEBUG: Input - productId: ${productId}, variantId: ${variantId}, quantity: ${quantity}, totalDays: ${totalDays}, paymentMethod: ${paymentMethod}`);

  const user = await User.findById(userId);
  if (!user) throw new UserNotFoundError(userId);

  console.log(`🔍 DEBUG: Looking for product with ID: ${productId}`);

  let product;
  if (mongoose.Types.ObjectId.isValid(productId) && productId.length === 24) {
    console.log(`🔍 DEBUG: Trying to find product by MongoDB _id: ${productId}`);
    product = await Product.findById(productId);
    if (product) {
      console.log(`✅ Found product by _id: ${product.name} (productId: ${product.productId})`);
    }
  }
  if (!product) {
    console.log(`🔍 DEBUG: Trying to find product by custom productId field: ${productId}`);
    product = await Product.findOne({ productId });
    if (product) {
      console.log(`✅ Found product by productId: ${product.name} (_id: ${product._id})`);
    }
  }
  if (!product) {
    console.error(`❌ Product not found with ID: ${productId}`);
    throw new ProductNotFoundError(productId);
  }

  if (
    product.availability?.stockStatus === "out_of_stock" ||
    product.availability?.isAvailable === false
  ) {
    throw new ProductOutOfStockError(productId);
  }

  let selectedVariant = null;
  let pricePerUnit =
    product.pricing?.finalPrice || product.pricing?.regularPrice || 0;

  console.log(`🔍 DEBUG: Base product price: ${pricePerUnit}`);

  let variantDetails = null;
  if (variantId && product.variants && product.variants.length > 0) {
    console.log(`🔍 DEBUG: Looking for variant: ${variantId}`);
    selectedVariant = product.variants.find((v) => v.variantId === variantId);

    if (!selectedVariant) {
      console.error(`❌ Variant not found: ${variantId}`);
      throw new Error(`Variant with ID ${variantId} not found`);
    }

    if (!selectedVariant.isActive) {
      console.error(`❌ Variant not active: ${variantId}`);
      throw new Error(`Variant ${variantId} is not available`);
    }

    pricePerUnit = selectedVariant.salePrice || selectedVariant.price;
    console.log(`✅ Found variant. Price: ${pricePerUnit}`);

    variantDetails = {
      sku: selectedVariant.sku,
      attributes: selectedVariant.attributes,
      price: pricePerUnit,
      description:
        selectedVariant.description?.short || selectedVariant.description?.long,
    };
  }

  // Validate price is valid
  if (!pricePerUnit || isNaN(pricePerUnit) || pricePerUnit <= 0) {
    console.error(`❌ Invalid price: ${pricePerUnit}`);
    throw new Error(`Invalid product price: ${pricePerUnit}. Product may not have proper pricing configured.`);
  }

  console.log(`🔍 DEBUG: Final pricePerUnit: ${pricePerUnit}, quantity: ${quantity}`);

  const totalProductPrice = calculateTotalProductPrice(pricePerUnit, quantity);
  let productPrice = totalProductPrice;
  let originalPrice = totalProductPrice;

  let couponDiscount = 0;
  let appliedCouponCode = null;
  let couponType = null;

  let milestonePaymentsRequired = null;
  let milestoneFreeDays = null;

  if (couponCode) {
    const Coupon = require("../models/Coupon");
    const coupon = await Coupon.findOne({
      couponCode: couponCode.toUpperCase(),
    });

    if (!coupon) throw new Error(`Coupon '${couponCode}' not found`);
    if (!coupon.isActive)
      throw new Error(`Coupon '${couponCode}' is not active`);
    if (new Date() > coupon.expiryDate)
      throw new Error(`Coupon '${couponCode}' has expired`);

    if (totalProductPrice < coupon.minOrderValue) {
      throw new Error(
        `Minimum order value of ₹${coupon.minOrderValue} required for coupon`
      );
    }

    if (coupon.discountType === "flat") {
      couponDiscount = coupon.discountValue;
    } else if (coupon.discountType === "percentage") {
      couponDiscount = Math.round(
        (totalProductPrice * coupon.discountValue) / 100
      );
    }

    couponDiscount = Math.min(couponDiscount, totalProductPrice);

    couponType = coupon.couponType || "INSTANT";
    appliedCouponCode = coupon.couponCode;

    if (couponType === "INSTANT") {
      const result = applyInstantCoupon(totalProductPrice, couponDiscount);
      productPrice = result.finalPrice;
    } else if (couponType === "REDUCE_DAYS") {
      productPrice = totalProductPrice;
    }

    if (couponType === "MILESTONE_REWARD") {
      milestonePaymentsRequired = coupon.rewardCondition;
      milestoneFreeDays = coupon.rewardValue;
      if (!milestonePaymentsRequired || !milestoneFreeDays) {
        throw new Error(`Invalid milestone coupon configuration`);
      }
    }

    if (coupon.incrementUsage) await coupon.incrementUsage();
  }

  const durationValidation = validateInstallmentDuration(
    totalDays,
    productPrice
  );
  if (!durationValidation.valid) {
    throw new InvalidInstallmentDurationError(
      totalDays,
      durationValidation.min,
      durationValidation.max
    );
  }

  // ---------------------------------------------------
  // 🔧 FIX FOR INSTANT COUPON (DAILY AMOUNT RECALC)
  // ---------------------------------------------------
  // Calculate daily amount if not provided, or recalculate for INSTANT coupon
  let finalDailyAmount = dailyAmount;

  if (couponType === "INSTANT") {
    // For INSTANT coupons, recalculate based on discounted price
    finalDailyAmount = Math.ceil(productPrice / totalDays);
    console.log(`🔧 FIXED DAILY AMOUNT (INSTANT): ${finalDailyAmount}`);
  } else if (!finalDailyAmount) {
    // If no daily amount provided and no INSTANT coupon, calculate it
    finalDailyAmount = calculateDailyAmount(productPrice, totalDays);
    console.log(`🔧 CALCULATED DAILY AMOUNT: ${finalDailyAmount}`);
  }

  // Replace old logic with corrected logic
  const calculatedDailyAmount = finalDailyAmount;
  // ---------------------------------------------------

  // Validate that calculatedDailyAmount is a valid number
  if (!calculatedDailyAmount || isNaN(calculatedDailyAmount) || calculatedDailyAmount <= 0) {
    throw new Error("Invalid daily payment amount calculated. Please check your input.");
  }

  if (calculatedDailyAmount < 50) {
    throw new Error("Daily payment amount must be at least ₹50");
  }

  const couponInfo =
    couponType === "REDUCE_DAYS"
      ? { type: "REDUCE_DAYS", discount: couponDiscount }
      : null;

  const paymentSchedule = generatePaymentSchedule(
    totalDays,
    calculatedDailyAmount,
    new Date(),
    couponInfo
  );

  let referrer = null;
  let commissionPercentage = 10; // Default 10% commission for all products

  if (user.referredBy) {
    referrer = await User.findById(user.referredBy);
    // Always use 10% commission regardless of product settings
    commissionPercentage = 10;
  }

  const productSnapshot = {
    productId: product.productId,
    name: product.name,
    description: product.description,
    pricing: product.pricing,
    images: product.images,
    brand: product.brand,
    category: product.category,
  };

  const session = null;

  try {
    let razorpayOrder = null;
    let firstPaymentStatus = "PENDING";
    let walletTransactionId = null;

    if (paymentMethod === "RAZORPAY") {
      razorpayOrder = await razorpay.orders.create({
        amount: calculatedDailyAmount * 100,
        currency: "INR",
        receipt: `order_${Date.now()}`,
        payment_capture: 1,
      });
    } else if (paymentMethod === "WALLET") {
      const walletDeduction = await deductFromWallet(
        userId,
        calculatedDailyAmount,
        `First installment payment for ${product.name}`,
        null,
        {
          productId: product._id,
          installmentNumber: 1,
        }
      );

      walletTransactionId = walletDeduction.walletTransaction._id;
      firstPaymentStatus = "COMPLETED";
    }

    const generatedOrderId = generateOrderId();

    const orderDataForModel = {
      orderId: generatedOrderId,
      user: userId,
      product: product._id,

      quantity,
      pricePerUnit,
      totalProductPrice,
      productPrice,
      productName: product.name,
      productSnapshot,

      variantId: variantId || null,
      variantDetails,

      couponCode: appliedCouponCode || null,
      couponDiscount,
      ...(couponType && { couponType }), // Only include couponType if it exists
      originalPrice: couponDiscount > 0 ? originalPrice : null,
      milestonePaymentsRequired,
      milestoneFreeDays,
      milestoneRewardApplied: false,
      milestoneRewardAppliedAt: null,

      totalDays,
      dailyPaymentAmount: calculatedDailyAmount,
      paidInstallments: paymentMethod === "WALLET" ? 1 : 0,
      totalPaidAmount: paymentMethod === "WALLET" ? calculatedDailyAmount : 0,
      remainingAmount:
        productPrice - (paymentMethod === "WALLET" ? calculatedDailyAmount : 0),
      paymentSchedule,
      status: paymentMethod === "WALLET" ? "ACTIVE" : "PENDING",
      deliveryAddress,
      deliveryStatus: "PENDING",

      referrer: referrer?._id || null,
      productCommissionPercentage: commissionPercentage,
      commissionPercentage,

      firstPaymentMethod: paymentMethod,
      lastPaymentDate: paymentMethod === "WALLET" ? new Date() : null,
    };

    const order = new InstallmentOrder(orderDataForModel);
    await order.save();

    // Generate idempotency key for first payment to prevent duplicates
    const firstPaymentIdempotencyKey = generateIdempotencyKey(
      order._id.toString(),
      userId,
      1 // First installment
    );

    const paymentData = {
      order: order._id,
      user: userId,
      amount: calculatedDailyAmount,
      installmentNumber: 1,
      paymentMethod,
      razorpayOrderId: razorpayOrder?.id || null,
      status: firstPaymentStatus,
      walletTransactionId,
      idempotencyKey: firstPaymentIdempotencyKey, // Add idempotency key
      processedAt: paymentMethod === "WALLET" ? new Date() : null,
      completedAt: paymentMethod === "WALLET" ? new Date() : null,
    };

    const firstPayment = new PaymentRecord(paymentData);
    await firstPayment.save();

    order.firstPaymentId = firstPayment._id;

    if (paymentMethod === "WALLET") {
      order.firstPaymentCompletedAt = new Date();
      order.paymentSchedule[0].status = "PAID";
      order.paymentSchedule[0].paidDate = new Date();
      order.paymentSchedule[0].paymentId = firstPayment._id;
    }

    await order.save();

    // ========================================
    // 🔧 FIX: Process commission for BOTH Wallet and Razorpay first payment
    // ========================================
    if (referrer && commissionPercentage > 0) {
      const commissionAmount =
        (calculatedDailyAmount * commissionPercentage) / 100;

      // Only credit commission immediately for WALLET payments
      // For RAZORPAY, commission will be credited when payment is verified
      if (paymentMethod === "WALLET") {
        const commissionResult = await creditCommissionToWallet(
          referrer._id,
          commissionAmount,
          order._id.toString(),
          firstPayment._id.toString(),
          null
        );

        await firstPayment.recordCommission(
          commissionAmount,
          commissionPercentage,
          commissionResult.walletTransaction._id
        );

        order.totalCommissionPaid = commissionAmount;
        await order.save();

        console.log(`✅ Commission credited immediately for WALLET payment: ₹${commissionAmount}`);
      } else if (paymentMethod === "RAZORPAY") {
        // Store commission details in payment record for later processing
        firstPayment.commissionAmount = commissionAmount;
        firstPayment.commissionPercentage = commissionPercentage;
        firstPayment.commissionCalculated = false; // Will be set to true when payment is verified
        await firstPayment.save();

        console.log(`⏳ Commission will be credited after RAZORPAY payment verification: ₹${commissionAmount}`);
      }
    }

    return {
      order: {
        orderId: order.orderId,
        _id: order._id,
        status: order.status,
        quantity: order.quantity,
        pricePerUnit: order.pricePerUnit,
        totalProductPrice: order.totalProductPrice,
        productPrice: order.productPrice,
        productName: order.productName,
        dailyPaymentAmount: order.dailyPaymentAmount,
        totalDays: order.totalDays,
        paidInstallments: order.paidInstallments,
        totalPaidAmount: order.totalPaidAmount,
        remainingAmount: order.remainingAmount,
        couponCode: order.couponCode,
        couponDiscount: order.couponDiscount,
        couponType: order.couponType,
        paymentSchedule: order.paymentSchedule,
        deliveryAddress: order.deliveryAddress,
        deliveryStatus: order.deliveryStatus,
        firstPaymentMethod: order.firstPaymentMethod,
        createdAt: order.createdAt,
        canPayToday: order.canPayToday ? order.canPayToday() : true,
      },
      firstPayment: {
        paymentId: firstPayment.paymentId,
        _id: firstPayment._id,
        amount: firstPayment.amount,
        installmentNumber: firstPayment.installmentNumber,
        paymentMethod: firstPayment.paymentMethod,
        status: firstPayment.status,
        razorpayOrderId: firstPayment.razorpayOrderId,
        commissionAmount: firstPayment.commissionAmount,
        commissionCalculated: firstPayment.commissionCalculated,
        completedAt: firstPayment.completedAt,
        createdAt: firstPayment.createdAt,
      },
      razorpayOrder: razorpayOrder
        ? {
            id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
          }
        : null,
    };
  } catch (error) {
    console.error("\n❌ Order creation failed!");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    // Provide more specific error message
    const errorMessage = error.message || 'Database transaction failed';
    throw new TransactionFailedError(errorMessage);
  }
}

/**
 * Get order by ID
 *
 * @param {string} orderId - Order ID (ObjectId or custom orderId)
 * @param {string} userId - User ID (for ownership verification)
 * @returns {Promise<Object>} Order document
 */
async function getOrderById(orderId, userId = null) {
  const query = mongoose.Types.ObjectId.isValid(orderId)
    ? { _id: orderId }
    : { orderId };

  if (userId) {
    query.user = userId;
  }

  const order = await InstallmentOrder.findOne(query)
    .populate("product", "name images pricing availability")
    .populate("user", "name email phoneNumber")
    .populate("referrer", "name email");

  return order;
}

/**
 * Get user's orders
 *
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of orders
 */
async function getUserOrders(userId, options = {}) {
  return InstallmentOrder.getByUser(userId, options);
}

/**
 * Get completed orders for admin
 *
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of completed orders
 */
async function getCompletedOrders(options = {}) {
  const { deliveryStatus, limit = 50, skip = 0 } = options;

  const query = { status: "COMPLETED" };
  if (deliveryStatus) query.deliveryStatus = deliveryStatus;

  return InstallmentOrder.find(query)
    .sort({ completedAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate("user", "name email phoneNumber")
    .populate("product", "name images pricing")
    .populate("referrer", "name email");
}

/**
 * Cancel order
 *
 * @param {string} orderId - Order ID
 * @param {string} userId - User ID
 * @param {string} reason - Cancellation reason
 * @returns {Promise<Object>} Updated order
 */
async function cancelOrder(orderId, userId, reason) {
  const order = await getOrderById(orderId, userId);

  if (!order) {
    throw new Error("Order not found");
  }

  if (order.status === "COMPLETED") {
    throw new Error("Cannot cancel completed order");
  }

  if (order.status === "CANCELLED") {
    throw new Error("Order already cancelled");
  }

  order.status = "CANCELLED";
  order.cancelledAt = new Date();
  order.cancelledBy = userId;
  order.cancellationReason = reason;

  await order.save();

  return order;
}

/**
 * Approve delivery (Admin only)
 *
 * @param {string} orderId - Order ID
 * @param {string} adminId - Admin user ID
 * @returns {Promise<Object>} Updated order
 */
async function approveDelivery(orderId, adminId) {
  const order = await InstallmentOrder.findOne({
    $or: [{ _id: orderId }, { orderId }],
  });

  if (!order) {
    throw new Error("Order not found");
  }

  if (order.status !== "COMPLETED") {
    throw new Error("Order must be fully paid before delivery approval");
  }

  if (order.deliveryStatus === "APPROVED") {
    throw new Error("Delivery already approved");
  }

  order.deliveryStatus = "APPROVED";
  order.deliveryApprovedBy = adminId;
  order.deliveryApprovedAt = new Date();

  await order.save();

  return order;
}

/**
 * Update delivery status
 *
 * @param {string} orderId - Order ID
 * @param {string} status - New delivery status
 * @returns {Promise<Object>} Updated order
 */
async function updateDeliveryStatus(orderId, status) {
  const order = await InstallmentOrder.findOne({
    $or: [{ _id: orderId }, { orderId }],
  });

  if (!order) {
    throw new Error("Order not found");
  }

  const validStatuses = ["PENDING", "APPROVED", "SHIPPED", "DELIVERED"];
  if (!validStatuses.includes(status)) {
    throw new Error("Invalid delivery status");
  }

  order.deliveryStatus = status;
  await order.save();

  return order;
}

/**
 * Get order statistics
 *
 * @param {string} userId - Optional user ID for user-specific stats
 * @returns {Promise<Object>} Order statistics
 */
async function getOrderStats(userId = null) {
  const query = userId ? { user: userId } : {};

  const stats = await InstallmentOrder.aggregate([
    { $match: query },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalValue: { $sum: "$productPrice" },
        totalPaid: { $sum: "$totalPaidAmount" },
      },
    },
  ]);

  return stats;
}

/**
 * Get overall investment status for a user
 *
 * Aggregates all NON-CANCELLED installment orders:
 * - Total amount of all products
 * - Total paid
 * - Total remaining
 * - Total days & paid days
 * - Overall progress %
 * - Status breakdown
 */
async function getOverallInvestmentStatus(userId) {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  // Aggregate totals across all NON-CANCELLED orders
  const [totals] = await InstallmentOrder.aggregate([
    {
      $match: {
        user: userObjectId,
        status: { $ne: "CANCELLED" },
      },
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalAmount: { $sum: "$productPrice" },
        totalPaidAmount: { $sum: "$totalPaidAmount" },
        totalRemainingAmount: { $sum: "$remainingAmount" },
        totalDays: { $sum: "$totalDays" },
        totalPaidInstallments: { $sum: "$paidInstallments" },
      },
    },
  ]);

  // If user has no orders at all
  if (!totals) {
    return {
      totalOrders: 0,
      totalAmount: 0,
      totalPaidAmount: 0,
      totalRemainingAmount: 0,
      totalDays: 0,
      totalPaidInstallments: 0,
      remainingDays: 0,
      progressPercent: 0,
      statusBreakdown: {},
      nextDueInstallment: null,
    };
  }

  // Status breakdown (ACTIVE, COMPLETED, PENDING, etc.)
  const statusStats = await InstallmentOrder.aggregate([
    {
      $match: {
        user: userObjectId,
        status: { $ne: "CANCELLED" },
      },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const statusBreakdown = {};
  statusStats.forEach((s) => {
    statusBreakdown[s._id] = s.count;
  });

  // Compute overall progress and remaining days
  const {
    totalOrders,
    totalAmount,
    totalPaidAmount,
    totalRemainingAmount,
    totalDays,
    totalPaidInstallments,
  } = totals;

  const remainingDays = Math.max(0, totalDays - totalPaidInstallments);
  const progressPercent =
    totalAmount > 0
      ? Math.round((totalPaidAmount / totalAmount) * 100 * 100) / 100 // 2 decimal %
      : 0;

  // Find the next nearest pending installment due date across all ACTIVE/PENDING orders
  const [nextDue] = await InstallmentOrder.aggregate([
    {
      $match: {
        user: userObjectId,
        status: { $in: ["PENDING", "ACTIVE"] },
      },
    },
    { $unwind: "$paymentSchedule" },
    {
      $match: {
        "paymentSchedule.status": "PENDING",
      },
    },
    {
      $sort: {
        "paymentSchedule.dueDate": 1,
      },
    },
    { $limit: 1 },
    {
      $project: {
        _id: 0,
        orderId: "$orderId",
        dueDate: "$paymentSchedule.dueDate",
        amount: "$paymentSchedule.amount",
      },
    },
  ]);

  return {
    totalOrders,
    totalAmount,
    totalPaidAmount,
    totalRemainingAmount,
    totalDays,
    totalPaidInstallments,
    remainingDays,
    progressPercent,
    statusBreakdown,
    nextDueInstallment: nextDue || null,
  };
}

module.exports = {
  createOrder,
  getOrderById,
  getUserOrders,
  getCompletedOrders,
  cancelOrder,
  approveDelivery,
  updateDeliveryStatus,
  getOrderStats,
  getOverallInvestmentStatus,
};
