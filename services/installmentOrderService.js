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
  calculateTotalProductPrice,  // ⭐ NEW
  applyInstantCoupon,           // ⭐ NEW
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
    variantId, // Optional - for products with variants
    quantity = 1, // ⭐ NEW: Quantity (default 1)
    couponCode, // Optional - for discount coupons
    totalDays,
    dailyAmount,
    paymentMethod,
    deliveryAddress,
  } = orderData;

  // ⭐ NEW: Validate quantity
  if (quantity < 1 || quantity > 10) {
    throw new Error('Quantity must be between 1 and 10');
  }

  // ========================================
  // 1. Validate User
  // ========================================
  const user = await User.findById(userId);
  if (!user) {
    throw new UserNotFoundError(userId);
  }

  // ========================================
  // 2. Validate Product
  // ========================================
  // Handle both custom productId and MongoDB _id
  let product;
  if (mongoose.Types.ObjectId.isValid(productId) && productId.length === 24) {
    product = await Product.findById(productId);
  }
  if (!product) {
    product = await Product.findOne({ productId });
  }
  if (!product) {
    throw new ProductNotFoundError(productId);
  }

  // Check product availability
  if (
    product.availability?.stockStatus === "out_of_stock" ||
    product.availability?.isAvailable === false
  ) {
    throw new ProductOutOfStockError(productId);
  }

  // ========================================
  // 2.1. Handle Product Variant (if provided)
  // ========================================
  let selectedVariant = null;
  let pricePerUnit =
    product.pricing?.finalPrice || product.pricing?.regularPrice || 0;
  let variantDetails = null;

  if (variantId && product.variants && product.variants.length > 0) {
    // Find the variant
    selectedVariant = product.variants.find((v) => v.variantId === variantId);

    if (!selectedVariant) {
      throw new Error(
        `Variant with ID ${variantId} not found for this product`
      );
    }

    if (!selectedVariant.isActive) {
      throw new Error(`Variant ${variantId} is not available`);
    }

    // Check variant stock (don't enforce, just warn)
    if (selectedVariant.stock <= 0) {
      console.warn(`⚠️  Variant ${variantId} is out of stock`);
    }

    // Use variant price instead of product price
    pricePerUnit = selectedVariant.salePrice || selectedVariant.price;

    // Store variant details
    variantDetails = {
      sku: selectedVariant.sku,
      attributes: selectedVariant.attributes,
      price: pricePerUnit,
      description:
        selectedVariant.description?.short || selectedVariant.description?.long,
    };
  }

  // ⭐ NEW: Calculate total product price (pricePerUnit × quantity)
  const totalProductPrice = calculateTotalProductPrice(pricePerUnit, quantity);

  console.log(`💰 Pricing calculation:`);
  console.log(`   Price per unit: ₹${pricePerUnit}`);
  console.log(`   Quantity: ${quantity}`);
  console.log(`   Total product price: ₹${totalProductPrice}`);

  // ========================================
  // 2.2. Handle Coupon Code (if provided)
  // ========================================
  let couponDiscount = 0;
  let appliedCouponCode = null;
  let couponType = null;  // ⭐ NEW: INSTANT or REDUCE_DAYS
  let productPrice = totalProductPrice;  // Start with total (including quantity)
  let originalPrice = totalProductPrice;

  if (couponCode) {
    const Coupon = require("../models/CouponModel");  // ⭐ UPDATED: Use CouponModel
    const coupon = await Coupon.findOne({
      couponCode: couponCode.toUpperCase(),
    });

    if (!coupon) {
      throw new Error(`Coupon '${couponCode}' not found`);
    }

    // Validate coupon is active
    if (!coupon.isActive) {
      throw new Error(`Coupon '${couponCode}' is not active`);
    }

    // Validate coupon not expired
    const now = new Date();
    if (now > coupon.expiryDate) {
      throw new Error(`Coupon '${couponCode}' has expired`);
    }

    // Validate minimum order value
    if (totalProductPrice < coupon.minOrderValue) {
      throw new Error(
        `Minimum order value of ₹${coupon.minOrderValue} is required for coupon '${couponCode}'`
      );
    }

    // Calculate discount
    if (coupon.discountType === "flat") {
      couponDiscount = coupon.discountValue;
    } else if (coupon.discountType === "percentage") {
      couponDiscount = Math.round((totalProductPrice * coupon.discountValue) / 100);
    }

    // Ensure discount doesn't exceed order amount
    couponDiscount = Math.min(couponDiscount, totalProductPrice);

    // ⭐ NEW: Apply coupon based on type
    couponType = coupon.couponType || 'INSTANT';  // Default to INSTANT
    appliedCouponCode = coupon.couponCode;

    if (couponType === 'INSTANT') {
      // INSTANT: Reduce product price immediately
      const result = applyInstantCoupon(totalProductPrice, couponDiscount);
      productPrice = result.finalPrice;
      console.log(`✅ INSTANT coupon '${appliedCouponCode}' applied: -₹${couponDiscount}`);
      console.log(`   Original price: ₹${totalProductPrice} → Final price: ₹${productPrice}`);
    } else if (couponType === 'REDUCE_DAYS') {
      // REDUCE_DAYS: Keep product price same, mark last days as FREE
      productPrice = totalProductPrice;  // No price reduction
      console.log(`✅ REDUCE_DAYS coupon '${appliedCouponCode}' applied: -₹${couponDiscount}`);
      console.log(`   Will mark last days as FREE in payment schedule`);
    }

    // Increment coupon usage
    if (coupon.incrementUsage) {
      await coupon.incrementUsage();
    }
  }

  // ========================================
  // 3. Validate Installment Duration
  // ========================================
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

  // ========================================
  // 4. Calculate Daily Amount
  // ========================================
  const calculatedDailyAmount =
    dailyAmount || calculateDailyAmount(productPrice, totalDays);

  // Validate minimum daily amount (₹50)
  if (calculatedDailyAmount < 50) {
    throw new Error("Daily payment amount must be at least ₹50");
  }

  // ========================================
  // 5. Generate Payment Schedule
  // ========================================
  // ⭐ UPDATED: Pass coupon info for REDUCE_DAYS handling
  const couponInfo = couponType === 'REDUCE_DAYS' ? {
    type: 'REDUCE_DAYS',
    discount: couponDiscount
  } : null;

  const paymentSchedule = generatePaymentSchedule(
    totalDays,
    calculatedDailyAmount,
    new Date(),
    couponInfo  // ⭐ NEW: Pass coupon info
  );

  console.log(`📅 Payment schedule generated: ${totalDays} days, ₹${calculatedDailyAmount}/day`);

  // ========================================
  // 6. Get Referrer Information
  // ========================================
  let referrer = null;
  let commissionPercentage = 10;  // ⭐ UPDATED: Default 10%

  if (user.referredBy) {
    referrer = await User.findById(user.referredBy);
    // ⭐ UPDATED: Get commission percentage from product or default to 10%
    commissionPercentage = product.referralBonus?.value || 10;
  }

  // ========================================
  // 7. Create Product Snapshot
  // ========================================
  const productSnapshot = {
    productId: product.productId,
    name: product.name,
    description: product.description,
    pricing: product.pricing,
    images: product.images,
    brand: product.brand,
    category: product.category,
  };

  // ========================================
  // 8. Start MongoDB Transaction
  // ========================================
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ========================================
    // 9. Handle Payment Method
    // ========================================
    let razorpayOrder = null;
    let firstPaymentStatus = "PENDING";
    let walletTransactionId = null;

    if (paymentMethod === "RAZORPAY") {
      // Create Razorpay order for first payment
      razorpayOrder = await razorpay.orders.create({
        amount: calculatedDailyAmount * 100, // Convert to paise
        currency: "INR",
        receipt: `order_${Date.now()}`,
        payment_capture: 1,
        notes: {
          productId: product._id.toString(),
          userId: user._id.toString(),
          installment: 1,
        },
      });

      firstPaymentStatus = "PENDING"; // Awaiting Razorpay verification
    } else if (paymentMethod === "WALLET") {
      // Process wallet deduction immediately
      const walletDeduction = await deductFromWallet(
        userId,
        calculatedDailyAmount,
        `First installment payment for ${product.name}`,
        session,
        {
          productId: product._id,
          installmentNumber: 1,
        }
      );

      walletTransactionId = walletDeduction.walletTransaction._id;
      firstPaymentStatus = "COMPLETED";
    }

    // ========================================
    // 10. Create Order Document
    // ========================================
    const order = new InstallmentOrder({
      orderId: generateOrderId(), // ✅ FIX: Generate orderId before save
      user: userId,
      product: product._id, // Store MongoDB ObjectId, not custom productId

      // ⭐ NEW: Quantity & Pricing fields
      quantity,
      pricePerUnit,
      totalProductPrice,
      productPrice,  // After coupon (if INSTANT)
      productName: product.name,
      productSnapshot,

      // Variant information (if applicable)
      variantId: variantId || null,
      variantDetails: variantDetails || undefined,

      // Coupon information (if applicable)
      couponCode: appliedCouponCode || null,
      couponDiscount: couponDiscount || 0,
      couponType: couponType || null,  // ⭐ NEW
      originalPrice: couponDiscount > 0 ? originalPrice : null,

      // Installment details
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

      // Referral & Commission
      referrer: referrer?._id || null,
      productCommissionPercentage: commissionPercentage,
      commissionPercentage,  // ⭐ NEW: Store at order level

      // Payment tracking
      firstPaymentMethod: paymentMethod,
      lastPaymentDate: paymentMethod === "WALLET" ? new Date() : null,  // ⭐ NEW
    });

    await order.save({ session });

    // ========================================
    // 11. Create First Payment Record
    // ========================================
    const firstPayment = new PaymentRecord({
      order: order._id,
      user: userId,
      amount: calculatedDailyAmount,
      installmentNumber: 1,
      paymentMethod,
      razorpayOrderId: razorpayOrder?.id || null,
      status: firstPaymentStatus,
      walletTransactionId,
      idempotencyKey:
        paymentMethod === "WALLET" ? `${order._id}-${userId}-1` : null,
    });

    await firstPayment.save({ session });

    // Update order with first payment reference
    order.firstPaymentId = firstPayment._id;

    if (paymentMethod === "WALLET") {
      order.firstPaymentCompletedAt = new Date();

      // Update payment schedule - mark first installment as PAID
      order.paymentSchedule[0].status = "PAID";
      order.paymentSchedule[0].paidDate = new Date();
      order.paymentSchedule[0].paymentId = firstPayment._id;
    }

    await order.save({ session });

    // ========================================
    // 12. Process Commission (if wallet payment and has referrer)
    // ========================================
    if (paymentMethod === "WALLET" && referrer && commissionPercentage > 0) {
      const commissionAmount =
        (calculatedDailyAmount * commissionPercentage) / 100;

      const commissionResult = await creditCommissionToWallet(
        referrer._id,
        commissionAmount,
        order._id.toString(),
        firstPayment._id.toString(),
        session
      );

      // Update payment record with commission details
      await firstPayment.recordCommission(
        commissionAmount,
        commissionPercentage,
        commissionResult.walletTransaction._id
      );

      // Update order total commission
      order.totalCommissionPaid = commissionAmount;
      await order.save({ session });
    }

    // ========================================
    // 13. Commit Transaction
    // ========================================
    await session.commitTransaction();

    return {
      order: order.getSummary(),
      firstPayment: firstPayment.getSummary(),
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
    await session.abortTransaction();
    console.error("Order creation failed:", error);
    throw new TransactionFailedError(error.message);
  } finally {
    session.endSession();
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
  return InstallmentOrder.getCompletedOrders(options);
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
  getOverallInvestmentStatus
};

