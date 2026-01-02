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
  BulkOrderError,
  BulkOrderNotFoundError,
  ValidationError,
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

      // ========================================
      // 🆕 INTEGRATE REFERRAL TRACKING SYSTEM
      // ========================================
      try {
        const referralController = require("../controllers/referralController");

        const installmentDetails = {
          productId: product._id,
          orderId: order._id,
          totalAmount: productPrice,
          dailyAmount: calculatedDailyAmount,
          days: totalDays,
          commissionPercentage: commissionPercentage,
          name: `${product.name} - ${totalDays} days installment`,
        };

        await referralController.processReferral(
          referrer._id,
          userId,
          installmentDetails
        );

        console.log(`✅ Referral tracking updated successfully for referrer: ${referrer._id}`);
      } catch (referralError) {
        // Log error but don't fail the order creation
        console.error("⚠️ Failed to update referral tracking:", referralError.message);
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
 * Aggregates only ACTIVE installment orders:
 * - ACTIVE = First payment done + Installments still pending (order chalu hai)
 * - PENDING orders excluded (first payment not done yet)
 * - COMPLETED orders excluded (all payments done)
 * - CANCELLED orders excluded
 */
async function getOverallInvestmentStatus(userId) {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  // Aggregate totals across only ACTIVE orders
  // ACTIVE = first payment done + installments chal rahe hain
  const [totals] = await InstallmentOrder.aggregate([
    {
      $match: {
        user: userObjectId,
        status: "ACTIVE", // Sirf ACTIVE orders (chalu orders)
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

  // If user has no ACTIVE orders
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

  // Status breakdown (sirf ACTIVE orders ka count)
  const statusBreakdown = {
    ACTIVE: totals.totalOrders,
  };

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

  // Find the next nearest pending installment due date across only ACTIVE orders
  const [nextDue] = await InstallmentOrder.aggregate([
    {
      $match: {
        user: userObjectId,
        status: "ACTIVE", // Sirf ACTIVE orders
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

/**
 * Verify first payment for Razorpay orders
 *
 * This function is called after user completes Razorpay payment.
 * It verifies the payment signature and activates the order.
 *
 * @param {Object} data - Payment verification data
 * @param {string} data.orderId - InstallmentOrder ID (MongoDB _id or orderId)
 * @param {string} data.userId - User ID
 * @param {string} data.razorpayOrderId - Razorpay order ID
 * @param {string} data.razorpayPaymentId - Razorpay payment ID
 * @param {string} data.razorpaySignature - Razorpay signature
 * @returns {Promise<Object>} { order, payment, message }
 */
async function verifyFirstPayment(data) {
  const {
    orderId,
    userId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  } = data;

  // 1. Find the order
  const order = await getOrderById(orderId, userId);

  if (!order) {
    throw new Error("Order not found");
  }

  // 2. Check if order is in PENDING status
  if (order.status !== "PENDING") {
    throw new Error(`Order is already ${order.status}. First payment was already processed.`);
  }

  // 3. Find the first payment record
  const firstPayment = await PaymentRecord.findOne({
    order: order._id,
    installmentNumber: 1,
    status: "PENDING",
  });

  if (!firstPayment) {
    throw new Error("First payment record not found or already processed");
  }

  // 4. Verify Razorpay payment ID matches
  if (firstPayment.razorpayOrderId !== razorpayOrderId) {
    throw new Error("Razorpay order ID mismatch");
  }

  // 5. Verify Razorpay signature
  const crypto = require("crypto");
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expectedSignature !== razorpaySignature) {
    throw new Error("Invalid payment signature. Payment verification failed.");
  }

  // 6. Payment verified! Update payment record
  firstPayment.status = "COMPLETED";
  firstPayment.razorpayPaymentId = razorpayPaymentId;
  firstPayment.razorpaySignature = razorpaySignature;
  firstPayment.processedAt = new Date();
  firstPayment.completedAt = new Date();
  await firstPayment.save();

  // 7. Update order status to ACTIVE
  order.status = "ACTIVE";
  order.paidInstallments = 1;
  order.totalPaidAmount = order.dailyPaymentAmount;
  order.remainingAmount = order.productPrice - order.dailyPaymentAmount;
  order.firstPaymentCompletedAt = new Date();
  order.lastPaymentDate = new Date();

  // Update first installment in payment schedule
  order.paymentSchedule[0].status = "PAID";
  order.paymentSchedule[0].paidDate = new Date();
  order.paymentSchedule[0].paymentId = firstPayment._id;

  await order.save();

  // 8. Process commission if referrer exists
  if (order.referrer && order.commissionPercentage > 0) {
    const commissionAmount = (order.dailyPaymentAmount * order.commissionPercentage) / 100;

    try {
      const commissionResult = await creditCommissionToWallet(
        order.referrer,
        commissionAmount,
        order._id.toString(),
        firstPayment._id.toString(),
        null
      );

      await firstPayment.recordCommission(
        commissionAmount,
        order.commissionPercentage,
        commissionResult.walletTransaction._id
      );

      order.totalCommissionPaid = commissionAmount;
      await order.save();

      console.log(`✅ Commission credited for verified first payment: ₹${commissionAmount}`);
    } catch (commissionError) {
      console.error("⚠️ Failed to credit commission:", commissionError.message);
    }

    // Process referral tracking
    try {
      const referralController = require("../controllers/referralController");
      const product = await Product.findById(order.product);

      const installmentDetails = {
        productId: order.product,
        orderId: order._id,
        totalAmount: order.productPrice,
        dailyAmount: order.dailyPaymentAmount,
        days: order.totalDays,
        commissionPercentage: order.commissionPercentage,
        name: `${product?.name || order.productName} - ${order.totalDays} days installment`,
      };

      await referralController.processReferral(
        order.referrer,
        userId,
        installmentDetails
      );

      console.log(`✅ Referral tracking updated for verified payment`);
    } catch (referralError) {
      console.error("⚠️ Failed to update referral tracking:", referralError.message);
    }
  }

  return {
    success: true,
    order: {
      orderId: order.orderId,
      _id: order._id,
      status: order.status,
      productName: order.productName,
      dailyPaymentAmount: order.dailyPaymentAmount,
      totalDays: order.totalDays,
      paidInstallments: order.paidInstallments,
      totalPaidAmount: order.totalPaidAmount,
      remainingAmount: order.remainingAmount,
    },
    payment: {
      paymentId: firstPayment._id,
      amount: firstPayment.amount,
      status: firstPayment.status,
      completedAt: firstPayment.completedAt,
    },
    message: "First payment verified successfully. Order is now ACTIVE.",
  };
}

/**
 * Generate unique bulk order ID
 * Format: BULK-YYYYMMDD-XXXX
 */
function generateBulkOrderId() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BULK-${dateStr}-${random}`;
}

/**
 * Validate a single item for bulk order
 * Returns { valid: true, data: processedData } or { valid: false, error: errorMessage }
 */
async function validateBulkOrderItem(item, index, user) {
  const {
    productId,
    variantId,
    quantity = 1,
    totalDays,
    couponCode,
  } = item;

  const errors = [];

  // Validate required fields
  if (!productId) {
    errors.push(`Item ${index + 1}: productId is required`);
  }

  if (!totalDays || isNaN(totalDays) || totalDays < 1) {
    errors.push(`Item ${index + 1}: totalDays must be a positive number`);
  }

  if (quantity < 1 || quantity > 10) {
    errors.push(`Item ${index + 1}: quantity must be between 1 and 10`);
  }

  if (errors.length > 0) {
    return { valid: false, error: errors.join(", "), itemIndex: index };
  }

  // Find product
  let product;
  if (mongoose.Types.ObjectId.isValid(productId) && productId.length === 24) {
    product = await Product.findById(productId);
  }
  if (!product) {
    product = await Product.findOne({ productId });
  }

  if (!product) {
    return {
      valid: false,
      error: `Item ${index + 1}: Product '${productId}' not found`,
      itemIndex: index,
    };
  }

  // Check stock
  if (
    product.availability?.stockStatus === "out_of_stock" ||
    product.availability?.isAvailable === false
  ) {
    return {
      valid: false,
      error: `Item ${index + 1}: Product '${product.name}' is out of stock`,
      itemIndex: index,
    };
  }

  // Get price
  let pricePerUnit =
    product.pricing?.finalPrice || product.pricing?.regularPrice || 0;
  let selectedVariant = null;
  let variantDetails = null;

  if (variantId && product.variants && product.variants.length > 0) {
    selectedVariant = product.variants.find((v) => v.variantId === variantId);

    if (!selectedVariant) {
      return {
        valid: false,
        error: `Item ${index + 1}: Variant '${variantId}' not found`,
        itemIndex: index,
      };
    }

    if (!selectedVariant.isActive) {
      return {
        valid: false,
        error: `Item ${index + 1}: Variant '${variantId}' is not available`,
        itemIndex: index,
      };
    }

    pricePerUnit = selectedVariant.salePrice || selectedVariant.price;
    variantDetails = {
      sku: selectedVariant.sku,
      attributes: selectedVariant.attributes,
      price: pricePerUnit,
      description:
        selectedVariant.description?.short || selectedVariant.description?.long,
    };
  }

  // Validate price
  if (!pricePerUnit || isNaN(pricePerUnit) || pricePerUnit <= 0) {
    return {
      valid: false,
      error: `Item ${index + 1}: Invalid product price`,
      itemIndex: index,
    };
  }

  // Calculate prices
  const totalProductPrice = calculateTotalProductPrice(pricePerUnit, quantity);
  let productPrice = totalProductPrice;
  let originalPrice = totalProductPrice;
  let couponDiscount = 0;
  let appliedCouponCode = null;
  let couponType = null;
  let milestonePaymentsRequired = null;
  let milestoneFreeDays = null;

  // Process coupon if provided
  if (couponCode) {
    try {
      const Coupon = require("../models/Coupon");
      const coupon = await Coupon.findOne({
        couponCode: couponCode.toUpperCase(),
      });

      if (!coupon) {
        return {
          valid: false,
          error: `Item ${index + 1}: Coupon '${couponCode}' not found`,
          itemIndex: index,
        };
      }

      if (!coupon.isActive) {
        return {
          valid: false,
          error: `Item ${index + 1}: Coupon '${couponCode}' is not active`,
          itemIndex: index,
        };
      }

      if (new Date() > coupon.expiryDate) {
        return {
          valid: false,
          error: `Item ${index + 1}: Coupon '${couponCode}' has expired`,
          itemIndex: index,
        };
      }

      if (totalProductPrice < coupon.minOrderValue) {
        return {
          valid: false,
          error: `Item ${index + 1}: Minimum order value ₹${coupon.minOrderValue} required for coupon`,
          itemIndex: index,
        };
      }

      // Calculate discount
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
          return {
            valid: false,
            error: `Item ${index + 1}: Invalid milestone coupon configuration`,
            itemIndex: index,
          };
        }
      }
    } catch (couponError) {
      return {
        valid: false,
        error: `Item ${index + 1}: Coupon error - ${couponError.message}`,
        itemIndex: index,
      };
    }
  }

  // Validate duration
  const durationValidation = validateInstallmentDuration(totalDays, productPrice);
  if (!durationValidation.valid) {
    return {
      valid: false,
      error: `Item ${index + 1}: Duration ${totalDays} days not allowed. Min: ${durationValidation.min}, Max: ${durationValidation.max}`,
      itemIndex: index,
    };
  }

  // Calculate daily amount
  let calculatedDailyAmount;
  if (couponType === "INSTANT") {
    calculatedDailyAmount = Math.ceil(productPrice / totalDays);
  } else {
    calculatedDailyAmount = calculateDailyAmount(productPrice, totalDays);
  }

  if (calculatedDailyAmount < 50) {
    return {
      valid: false,
      error: `Item ${index + 1}: Daily amount ₹${calculatedDailyAmount} is below minimum ₹50`,
      itemIndex: index,
    };
  }

  return {
    valid: true,
    data: {
      product,
      pricePerUnit,
      quantity,
      totalProductPrice,
      productPrice,
      originalPrice,
      totalDays,
      calculatedDailyAmount,
      variantId,
      variantDetails,
      selectedVariant,
      couponCode: appliedCouponCode,
      couponDiscount,
      couponType,
      milestonePaymentsRequired,
      milestoneFreeDays,
    },
    itemIndex: index,
  };
}

/**
 * Create Bulk Order with multiple products
 *
 * Features:
 * - Multiple products with different quantities and plans
 * - Same product with different plans (e.g., iPhone 100 days + iPhone 200 days)
 * - Single Razorpay order for combined first payment
 * - Atomic: All orders created or none (for validation)
 * - Non-atomic for creation: Creates as many as possible, reports failures
 *
 * @param {Object} bulkOrderData
 * @param {string} bulkOrderData.userId - User ID
 * @param {Array} bulkOrderData.items - Array of order items
 * @param {string} bulkOrderData.paymentMethod - 'RAZORPAY' or 'WALLET'
 * @param {Object} bulkOrderData.deliveryAddress - Delivery address
 * @returns {Promise<Object>} { bulkOrderId, orders, payment, razorpayOrder }
 */
async function createBulkOrder(bulkOrderData) {
  const {
    userId,
    items,
    paymentMethod,
    deliveryAddress,
  } = bulkOrderData;

  console.log("\n========================================");
  console.log("🛒 BULK ORDER: Starting bulk order creation");
  console.log("========================================");
  console.log(`📦 Items count: ${items.length}`);
  console.log(`💳 Payment method: ${paymentMethod}`);

  // Validate items array
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ValidationError([{ field: "items", message: "Items array is required and must not be empty" }]);
  }

  if (items.length > 10) {
    throw new ValidationError([{ field: "items", message: "Maximum 10 items allowed per bulk order" }]);
  }

  // Validate payment method
  if (!paymentMethod || !["RAZORPAY", "WALLET"].includes(paymentMethod)) {
    throw new ValidationError([{ field: "paymentMethod", message: "Payment method must be RAZORPAY or WALLET" }]);
  }

  // Validate delivery address
  if (!deliveryAddress || !deliveryAddress.name || !deliveryAddress.phoneNumber ||
      !deliveryAddress.addressLine1 || !deliveryAddress.city ||
      !deliveryAddress.state || !deliveryAddress.pincode) {
    throw new ValidationError([{ field: "deliveryAddress", message: "Complete delivery address is required" }]);
  }

  // Find user
  const user = await User.findById(userId);
  if (!user) throw new UserNotFoundError(userId);

  // Get referrer info
  let referrer = null;
  let commissionPercentage = 10;
  if (user.referredBy) {
    referrer = await User.findById(user.referredBy);
  }

  // Validate all items first
  console.log("🔍 Validating all items...");
  const validationResults = await Promise.all(
    items.map((item, index) => validateBulkOrderItem(item, index, user))
  );

  const validItems = validationResults.filter((r) => r.valid);
  const invalidItems = validationResults.filter((r) => !r.valid);

  // If all items failed validation, throw error
  if (validItems.length === 0) {
    throw new BulkOrderError(
      "All items failed validation",
      [],
      invalidItems.map((i) => ({ index: i.itemIndex, error: i.error }))
    );
  }

  // Log validation results
  console.log(`✅ Valid items: ${validItems.length}`);
  console.log(`❌ Invalid items: ${invalidItems.length}`);

  // Calculate total first payment amount
  const totalFirstPayment = validItems.reduce(
    (sum, item) => sum + item.data.calculatedDailyAmount,
    0
  );

  console.log(`💰 Total first payment: ₹${totalFirstPayment}`);

  // For WALLET payment, check balance upfront
  if (paymentMethod === "WALLET") {
    const Wallet = require("../models/Wallet");
    const wallet = await Wallet.findOne({ user: userId });
    const walletBalance = wallet?.balance || 0;

    if (walletBalance < totalFirstPayment) {
      throw new BulkOrderError(
        `Insufficient wallet balance. Required: ₹${totalFirstPayment}, Available: ₹${walletBalance}`,
        [],
        [{ error: "INSUFFICIENT_BALANCE", required: totalFirstPayment, available: walletBalance }]
      );
    }
  }

  // Generate bulk order ID
  const bulkOrderId = generateBulkOrderId();
  console.log(`🆔 Bulk Order ID: ${bulkOrderId}`);

  // Create orders for valid items
  const createdOrders = [];
  const createdPayments = [];
  const failedOrders = [];

  for (let i = 0; i < validItems.length; i++) {
    const validItem = validItems[i];
    const itemData = validItem.data;
    const originalItem = items[validItem.itemIndex];

    try {
      console.log(`\n📦 Creating order ${i + 1}/${validItems.length}: ${itemData.product.name}`);

      // Generate payment schedule
      const couponInfo =
        itemData.couponType === "REDUCE_DAYS"
          ? { type: "REDUCE_DAYS", discount: itemData.couponDiscount }
          : null;

      const paymentSchedule = generatePaymentSchedule(
        itemData.totalDays,
        itemData.calculatedDailyAmount,
        new Date(),
        couponInfo
      );

      // Product snapshot
      const productSnapshot = {
        productId: itemData.product.productId,
        name: itemData.product.name,
        description: itemData.product.description,
        pricing: itemData.product.pricing,
        images: itemData.product.images,
        brand: itemData.product.brand,
        category: itemData.product.category,
      };

      // Create order (status will be PENDING for RAZORPAY, ACTIVE for WALLET after payment)
      const generatedOrderId = generateOrderId();

      const orderDataForModel = {
        orderId: generatedOrderId,
        user: userId,
        product: itemData.product._id,
        bulkOrderId: bulkOrderId, // Link to bulk order

        quantity: itemData.quantity,
        pricePerUnit: itemData.pricePerUnit,
        totalProductPrice: itemData.totalProductPrice,
        productPrice: itemData.productPrice,
        productName: itemData.product.name,
        productSnapshot,

        variantId: itemData.variantId || null,
        variantDetails: itemData.variantDetails,

        couponCode: itemData.couponCode || null,
        couponDiscount: itemData.couponDiscount,
        ...(itemData.couponType && { couponType: itemData.couponType }),
        originalPrice: itemData.couponDiscount > 0 ? itemData.originalPrice : null,
        milestonePaymentsRequired: itemData.milestonePaymentsRequired,
        milestoneFreeDays: itemData.milestoneFreeDays,
        milestoneRewardApplied: false,
        milestoneRewardAppliedAt: null,

        totalDays: itemData.totalDays,
        dailyPaymentAmount: itemData.calculatedDailyAmount,
        paidInstallments: 0,
        totalPaidAmount: 0,
        remainingAmount: itemData.productPrice,
        paymentSchedule,
        status: "PENDING", // Will be updated after payment verification
        deliveryAddress,
        deliveryStatus: "PENDING",

        referrer: referrer?._id || null,
        productCommissionPercentage: commissionPercentage,
        commissionPercentage,

        firstPaymentMethod: paymentMethod,
        lastPaymentDate: null,
      };

      const order = new InstallmentOrder(orderDataForModel);
      await order.save();

      // Create first payment record (PENDING status)
      const firstPaymentIdempotencyKey = generateIdempotencyKey(
        order._id.toString(),
        userId,
        1
      );

      const paymentData = {
        order: order._id,
        user: userId,
        amount: itemData.calculatedDailyAmount,
        installmentNumber: 1,
        paymentMethod,
        razorpayOrderId: null, // Will be set after Razorpay order creation
        status: "PENDING",
        walletTransactionId: null,
        idempotencyKey: firstPaymentIdempotencyKey,
        bulkOrderId: bulkOrderId, // Link to bulk order
      };

      const firstPayment = new PaymentRecord(paymentData);
      await firstPayment.save();

      // Link payment to order
      order.firstPaymentId = firstPayment._id;
      await order.save();

      createdOrders.push({
        order: order,
        orderId: order.orderId,
        _id: order._id,
        productName: order.productName,
        quantity: order.quantity,
        totalDays: order.totalDays,
        dailyPaymentAmount: order.dailyPaymentAmount,
        productPrice: order.productPrice,
        status: order.status,
      });

      createdPayments.push({
        payment: firstPayment,
        paymentId: firstPayment._id,
        orderId: order._id,
        amount: firstPayment.amount,
      });

      console.log(`✅ Order created: ${order.orderId}`);
    } catch (orderError) {
      console.error(`❌ Failed to create order for item ${validItem.itemIndex + 1}:`, orderError.message);
      failedOrders.push({
        itemIndex: validItem.itemIndex,
        productId: originalItem.productId,
        error: orderError.message,
      });
    }
  }

  // If no orders were created, throw error
  if (createdOrders.length === 0) {
    throw new BulkOrderError(
      "Failed to create any orders",
      [],
      [...invalidItems.map((i) => ({ index: i.itemIndex, error: i.error })), ...failedOrders]
    );
  }

  // Calculate total amount for created orders
  const totalAmount = createdPayments.reduce((sum, p) => sum + p.amount, 0);

  let razorpayOrder = null;
  let walletTransactionIds = [];

  if (paymentMethod === "RAZORPAY") {
    // Create single Razorpay order for combined amount
    console.log(`\n💳 Creating Razorpay order for ₹${totalAmount}...`);

    razorpayOrder = await razorpay.orders.create({
      amount: totalAmount * 100, // In paise
      currency: "INR",
      receipt: `bulk_${bulkOrderId}`,
      payment_capture: 1,
      notes: {
        type: "BULK_FIRST_PAYMENT",
        bulkOrderId: bulkOrderId,
        orderCount: createdOrders.length,
        orderIds: createdOrders.map((o) => o.orderId).join(","),
      },
    });

    // Update all payment records with Razorpay order ID
    for (const paymentInfo of createdPayments) {
      await PaymentRecord.findByIdAndUpdate(paymentInfo.paymentId, {
        razorpayOrderId: razorpayOrder.id,
        bulkRazorpayOrderId: razorpayOrder.id,
      });
    }

    console.log(`✅ Razorpay order created: ${razorpayOrder.id}`);
  } else if (paymentMethod === "WALLET") {
    // Process wallet payments for all orders
    console.log(`\n👛 Processing wallet payments...`);

    for (let i = 0; i < createdOrders.length; i++) {
      const orderInfo = createdOrders[i];
      const paymentInfo = createdPayments[i];

      try {
        // Deduct from wallet
        const walletDeduction = await deductFromWallet(
          userId,
          paymentInfo.amount,
          `First installment for ${orderInfo.productName} (Bulk: ${bulkOrderId})`,
          null,
          {
            productId: orderInfo.order.product,
            installmentNumber: 1,
            bulkOrderId: bulkOrderId,
          }
        );

        walletTransactionIds.push(walletDeduction.walletTransaction._id);

        // Update payment record
        await PaymentRecord.findByIdAndUpdate(paymentInfo.paymentId, {
          status: "COMPLETED",
          walletTransactionId: walletDeduction.walletTransaction._id,
          processedAt: new Date(),
          completedAt: new Date(),
        });

        // Update order
        const order = orderInfo.order;
        order.status = "ACTIVE";
        order.paidInstallments = 1;
        order.totalPaidAmount = paymentInfo.amount;
        order.remainingAmount = order.productPrice - paymentInfo.amount;
        order.firstPaymentCompletedAt = new Date();
        order.lastPaymentDate = new Date();
        order.paymentSchedule[0].status = "PAID";
        order.paymentSchedule[0].paidDate = new Date();
        order.paymentSchedule[0].paymentId = paymentInfo.paymentId;
        await order.save();

        // Update order info for response
        orderInfo.status = "ACTIVE";

        // Process commission
        if (referrer && commissionPercentage > 0) {
          const commissionAmount = (paymentInfo.amount * commissionPercentage) / 100;

          try {
            const commissionResult = await creditCommissionToWallet(
              referrer._id,
              commissionAmount,
              order._id.toString(),
              paymentInfo.paymentId.toString(),
              null
            );

            const payment = await PaymentRecord.findById(paymentInfo.paymentId);
            await payment.recordCommission(
              commissionAmount,
              commissionPercentage,
              commissionResult.walletTransaction._id
            );

            order.totalCommissionPaid = commissionAmount;
            await order.save();

            console.log(`✅ Commission credited: ₹${commissionAmount}`);
          } catch (commissionError) {
            console.error(`⚠️ Failed to credit commission:`, commissionError.message);
          }
        }

        console.log(`✅ Wallet payment processed for: ${orderInfo.orderId}`);
      } catch (walletError) {
        console.error(`❌ Wallet payment failed for ${orderInfo.orderId}:`, walletError.message);
        // Order remains in PENDING status
      }
    }
  }

  // Prepare response
  const response = {
    bulkOrderId,
    success: true,
    summary: {
      totalItems: items.length,
      successfulOrders: createdOrders.length,
      failedItems: invalidItems.length + failedOrders.length,
      totalFirstPayment: totalAmount,
      paymentMethod,
    },
    orders: createdOrders.map((o) => ({
      orderId: o.orderId,
      _id: o._id,
      productName: o.productName,
      quantity: o.quantity,
      totalDays: o.totalDays,
      dailyPaymentAmount: o.dailyPaymentAmount,
      productPrice: o.productPrice,
      status: o.status,
    })),
    payments: createdPayments.map((p) => ({
      paymentId: p.paymentId,
      orderId: p.orderId,
      amount: p.amount,
    })),
    failedItems: [
      ...invalidItems.map((i) => ({ index: i.itemIndex, error: i.error })),
      ...failedOrders,
    ],
  };

  if (paymentMethod === "RAZORPAY" && razorpayOrder) {
    response.razorpayOrder = {
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    };
    response.message = "Bulk order created. Please complete payment via Razorpay.";
  } else if (paymentMethod === "WALLET") {
    response.walletTransactionIds = walletTransactionIds;
    response.message = "Bulk order created and paid successfully via wallet.";
  }

  console.log("\n========================================");
  console.log("✅ BULK ORDER: Completed successfully");
  console.log(`📦 Orders created: ${createdOrders.length}`);
  console.log(`❌ Failed items: ${response.failedItems.length}`);
  console.log("========================================\n");

  return response;
}

/**
 * Verify bulk order first payment (Razorpay)
 *
 * Verifies single Razorpay payment and activates all orders in the bulk order
 *
 * @param {Object} data
 * @param {string} data.bulkOrderId - Bulk order ID
 * @param {string} data.userId - User ID
 * @param {string} data.razorpayOrderId - Razorpay order ID
 * @param {string} data.razorpayPaymentId - Razorpay payment ID
 * @param {string} data.razorpaySignature - Razorpay signature
 * @returns {Promise<Object>}
 */
async function verifyBulkOrderPayment(data) {
  const {
    bulkOrderId,
    userId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  } = data;

  console.log("\n========================================");
  console.log("🔐 BULK ORDER: Verifying payment");
  console.log(`🆔 Bulk Order ID: ${bulkOrderId}`);
  console.log("========================================");

  // Find all orders with this bulk order ID
  const orders = await InstallmentOrder.find({
    bulkOrderId: bulkOrderId,
    user: userId,
    status: "PENDING",
  });

  if (!orders || orders.length === 0) {
    throw new BulkOrderNotFoundError(bulkOrderId);
  }

  console.log(`📦 Found ${orders.length} orders to verify`);

  // Find all payment records
  const payments = await PaymentRecord.find({
    bulkOrderId: bulkOrderId,
    user: userId,
    status: "PENDING",
    installmentNumber: 1,
  });

  if (!payments || payments.length === 0) {
    throw new Error("Payment records not found for bulk order");
  }

  // Verify Razorpay order ID matches
  const firstPayment = payments[0];
  if (firstPayment.razorpayOrderId !== razorpayOrderId &&
      firstPayment.bulkRazorpayOrderId !== razorpayOrderId) {
    throw new Error("Razorpay order ID mismatch");
  }

  // Verify Razorpay signature
  const crypto = require("crypto");
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expectedSignature !== razorpaySignature) {
    throw new Error("Invalid payment signature. Payment verification failed.");
  }

  console.log("✅ Razorpay signature verified");

  // Get referrer info for commission
  const user = await User.findById(userId);
  let referrer = null;
  let commissionPercentage = 10;
  if (user.referredBy) {
    referrer = await User.findById(user.referredBy);
  }

  // Activate all orders and update payments
  const activatedOrders = [];
  const processedPayments = [];

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    const payment = payments.find((p) => p.order.toString() === order._id.toString());

    if (!payment) {
      console.error(`⚠️ Payment not found for order: ${order.orderId}`);
      continue;
    }

    try {
      // Update payment record
      payment.status = "COMPLETED";
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.razorpaySignature = razorpaySignature;
      payment.processedAt = new Date();
      payment.completedAt = new Date();
      await payment.save();

      // Update order
      order.status = "ACTIVE";
      order.paidInstallments = 1;
      order.totalPaidAmount = order.dailyPaymentAmount;
      order.remainingAmount = order.productPrice - order.dailyPaymentAmount;
      order.firstPaymentCompletedAt = new Date();
      order.lastPaymentDate = new Date();
      order.paymentSchedule[0].status = "PAID";
      order.paymentSchedule[0].paidDate = new Date();
      order.paymentSchedule[0].paymentId = payment._id;
      await order.save();

      // Process commission
      if (referrer && commissionPercentage > 0) {
        const commissionAmount = (payment.amount * commissionPercentage) / 100;

        try {
          const commissionResult = await creditCommissionToWallet(
            referrer._id,
            commissionAmount,
            order._id.toString(),
            payment._id.toString(),
            null
          );

          await payment.recordCommission(
            commissionAmount,
            commissionPercentage,
            commissionResult.walletTransaction._id
          );

          order.totalCommissionPaid = commissionAmount;
          await order.save();

          console.log(`✅ Commission credited for ${order.orderId}: ₹${commissionAmount}`);
        } catch (commissionError) {
          console.error(`⚠️ Commission failed for ${order.orderId}:`, commissionError.message);
        }
      }

      // Process referral tracking
      if (referrer) {
        try {
          const referralController = require("../controllers/referralController");
          const product = await Product.findById(order.product);

          const installmentDetails = {
            productId: order.product,
            orderId: order._id,
            totalAmount: order.productPrice,
            dailyAmount: order.dailyPaymentAmount,
            days: order.totalDays,
            commissionPercentage: commissionPercentage,
            name: `${product?.name || order.productName} - ${order.totalDays} days installment`,
          };

          await referralController.processReferral(
            referrer._id,
            userId,
            installmentDetails
          );
        } catch (referralError) {
          console.error(`⚠️ Referral tracking failed:`, referralError.message);
        }
      }

      activatedOrders.push({
        orderId: order.orderId,
        _id: order._id,
        productName: order.productName,
        status: order.status,
        dailyPaymentAmount: order.dailyPaymentAmount,
      });

      processedPayments.push({
        paymentId: payment._id,
        amount: payment.amount,
        status: payment.status,
      });

      console.log(`✅ Order activated: ${order.orderId}`);
    } catch (orderError) {
      console.error(`❌ Failed to activate order ${order.orderId}:`, orderError.message);
    }
  }

  console.log("\n========================================");
  console.log("✅ BULK ORDER: Payment verification completed");
  console.log(`📦 Orders activated: ${activatedOrders.length}`);
  console.log("========================================\n");

  return {
    success: true,
    bulkOrderId,
    ordersActivated: activatedOrders.length,
    totalOrdersInBulk: orders.length,
    orders: activatedOrders,
    payments: processedPayments,
    message: `Payment verified. ${activatedOrders.length} orders are now ACTIVE.`,
  };
}

/**
 * Get bulk order details
 *
 * @param {string} bulkOrderId - Bulk order ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>}
 */
async function getBulkOrderDetails(bulkOrderId, userId) {
  const orders = await InstallmentOrder.find({
    bulkOrderId: bulkOrderId,
    user: userId,
  }).populate("product", "name images pricing");

  if (!orders || orders.length === 0) {
    throw new BulkOrderNotFoundError(bulkOrderId);
  }

  const payments = await PaymentRecord.find({
    bulkOrderId: bulkOrderId,
    user: userId,
    installmentNumber: 1,
  });

  const totalAmount = orders.reduce((sum, o) => sum + o.productPrice, 0);
  const totalPaid = orders.reduce((sum, o) => sum + o.totalPaidAmount, 0);
  const totalFirstPayment = orders.reduce((sum, o) => sum + o.dailyPaymentAmount, 0);

  const statusCounts = {
    PENDING: orders.filter((o) => o.status === "PENDING").length,
    ACTIVE: orders.filter((o) => o.status === "ACTIVE").length,
    COMPLETED: orders.filter((o) => o.status === "COMPLETED").length,
    CANCELLED: orders.filter((o) => o.status === "CANCELLED").length,
  };

  return {
    bulkOrderId,
    summary: {
      totalOrders: orders.length,
      totalAmount,
      totalPaid,
      totalFirstPayment,
      remainingAmount: totalAmount - totalPaid,
      statusCounts,
    },
    orders: orders.map((o) => ({
      orderId: o.orderId,
      _id: o._id,
      productName: o.productName,
      productImage: o.product?.images?.[0] || null,
      quantity: o.quantity,
      totalDays: o.totalDays,
      dailyPaymentAmount: o.dailyPaymentAmount,
      productPrice: o.productPrice,
      totalPaidAmount: o.totalPaidAmount,
      remainingAmount: o.remainingAmount,
      paidInstallments: o.paidInstallments,
      status: o.status,
      createdAt: o.createdAt,
    })),
    payments: payments.map((p) => ({
      paymentId: p._id,
      orderId: p.order,
      amount: p.amount,
      status: p.status,
      razorpayOrderId: p.razorpayOrderId,
      completedAt: p.completedAt,
    })),
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
  verifyFirstPayment,
  // Bulk Order Functions
  createBulkOrder,
  verifyBulkOrderPayment,
  getBulkOrderDetails,
  generateBulkOrderId,
};
