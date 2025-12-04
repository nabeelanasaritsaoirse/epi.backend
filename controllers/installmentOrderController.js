/**
 * Installment Order Controller
 *
 * Handles HTTP requests for order management.
 * All controller methods are wrapped with asyncHandler for automatic error handling.
 */

const orderService = require("../services/installmentOrderService");
const {
  asyncHandler,
  successResponse,
} = require("../middlewares/errorHandler");
const { OrderNotFoundError } = require("../utils/customErrors");

/**
 * @route   POST /api/installment-orders
 * @desc    Create new installment order with first payment
 * @access  Private
 */
const createOrder = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  console.log('🔍 DEBUG: Controller - createOrder called');
  console.log('🔍 DEBUG: User ID:', userId);
  console.log('🔍 DEBUG: Request body:', JSON.stringify(req.body, null, 2));

  const orderData = {
    userId,
    ...req.body,
  };

  console.log('🔍 DEBUG: Calling orderService.createOrder...');
  const result = await orderService.createOrder(orderData);
  console.log('🔍 DEBUG: Service returned successfully!');
  console.log('🔍 DEBUG: Result structure:', {
    hasOrder: !!result.order,
    hasFirstPayment: !!result.firstPayment,
    hasRazorpayOrder: !!result.razorpayOrder,
    orderId: result.order?.orderId,
    paymentId: result.firstPayment?.paymentId
  });

  const message =
    req.body.paymentMethod === "WALLET"
      ? "Order created successfully. First payment completed via wallet."
      : "Order created successfully. Please complete payment via Razorpay.";

  // Format response with all fields properly structured
  const responseData = {
    order: result.order,
    firstPayment: result.firstPayment,
    razorpayOrder: result.razorpayOrder,
  };

  console.log('🔍 DEBUG: Sending response to client...');
  successResponse(res, responseData, message, 201);
  console.log('✅ Response sent successfully!\n');
});

/**
 * @route   GET /api/installment-orders/:orderId
 * @desc    Get order details
 * @access  Private
 */
const getOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user._id;

  const order = await orderService.getOrderById(orderId, userId);

  if (!order) throw new OrderNotFoundError(orderId);

  successResponse(res, { order }, "Order retrieved successfully");
});

/**
 * @route   GET /api/installment-orders
 * @desc    Get user's orders
 * @access  Private
 */
const getUserOrders = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { status, limit = 50, skip = 0, page } = req.query;

  const actualSkip = page ? (page - 1) * limit : skip;

  const options = {
    status,
    limit: Math.min(limit, 100),
    skip: actualSkip,
  };

  const orders = await orderService.getUserOrders(userId, options);

  successResponse(
    res,
    {
      orders,
      count: orders.length,
      page: page || Math.floor(actualSkip / limit) + 1,
      limit,
    },
    "Orders retrieved successfully"
  );
});

/**
 * @route   POST /api/installment-orders/:orderId/cancel
 * @desc    Cancel order
 * @access  Private
 */
const cancelOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;
  const userId = req.user._id;

  const order = await orderService.cancelOrder(orderId, userId, reason);

  successResponse(res, { order }, "Order cancelled successfully");
});

/**
 * @route   GET /api/installment-orders/stats
 * @desc    Get user's statistics
 * @access  Private
 */
const getOrderStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const stats = await orderService.getOrderStats(userId);

  const transformedStats = {
    total: 0,
    totalValue: 0,
    totalPaid: 0,
    byStatus: {},
  };

  stats.forEach((stat) => {
    transformedStats.total += stat.count;
    transformedStats.totalValue += stat.totalValue;
    transformedStats.totalPaid += stat.totalPaid;
    transformedStats.byStatus[stat._id] = {
      count: stat.count,
      totalValue: stat.totalValue,
      totalPaid: stat.totalPaid,
    };
  });

  successResponse(
    res,
    { stats: transformedStats },
    "Order statistics retrieved successfully"
  );
});

/**
 * @route   GET /api/installment-orders/:orderId/summary
 * @desc    Get order progress summary
 * @access  Private
 */
const getOrderSummary = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user._id;

  const order = await orderService.getOrderById(orderId, userId);
  if (!order) throw new OrderNotFoundError(orderId);

  const summary = order.getSummary();

  successResponse(res, { summary }, "Order summary retrieved successfully");
});

/**
 * @route   GET /api/installment-orders/:orderId/schedule
 * @desc    Get installment schedule
 * @access  Private
 */
const getPaymentSchedule = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user._id;

  const order = await orderService.getOrderById(orderId, userId);
  if (!order) throw new OrderNotFoundError(orderId);

  const summary = {
    totalInstallments: order.paymentSchedule.length,
    paidInstallments: order.paymentSchedule.filter((s) => s.status === "PAID")
      .length,
    pendingInstallments: order.paymentSchedule.filter(
      (s) => s.status === "PENDING"
    ).length,
    skippedInstallments: order.paymentSchedule.filter(
      (s) => s.status === "SKIPPED"
    ).length,
  };

  successResponse(
    res,
    { schedule: order.paymentSchedule, summary },
    "Payment schedule retrieved successfully"
  );
});

/**
 * @route   POST /api/installment/validate-coupon
 * @desc    Validate coupon
 * @access  Public
 */
/**
 * @route   POST /api/installments/validate-coupon
 * @desc    Validate coupon and calculate benefits for installment orders
 * @access  Public
 *
 * @body {
 *   couponCode: string (required) - The coupon code to validate
 *   productId: string (required) - Product ID
 *   variantId: string (optional) - Product variant ID
 *   quantity: number (optional, default: 1) - Product quantity
 *   totalDays: number (required) - Total installment days
 *   dailyAmount: number (required) - Daily installment amount
 * }
 *
 * @returns Detailed coupon benefits including discount, free days, and pricing breakdown
 */
const validateCoupon = asyncHandler(async (req, res) => {
  const {
    couponCode,
    productId,
    variantId,
    quantity = 1,
    totalDays,
    dailyAmount
  } = req.body;

  // Validation
  if (!couponCode) {
    return res.status(400).json({
      success: false,
      message: "couponCode is required",
    });
  }

  if (!productId || !totalDays || !dailyAmount) {
    return res.status(400).json({
      success: false,
      message: "productId, totalDays, and dailyAmount are required",
    });
  }

  if (quantity < 1 || quantity > 10) {
    return res.status(400).json({
      success: false,
      message: "quantity must be between 1 and 10",
    });
  }

  if (totalDays < 1) {
    return res.status(400).json({
      success: false,
      message: "totalDays must be at least 1",
    });
  }

  if (dailyAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: "dailyAmount must be greater than 0",
    });
  }

  // Get Product and calculate base price
  const Product = require("../models/Product");
  const mongoose = require("mongoose");

  let product;
  if (mongoose.Types.ObjectId.isValid(productId) && productId.length === 24) {
    product = await Product.findById(productId);
  }
  if (!product) {
    product = await Product.findOne({ productId });
  }

  if (!product) {
    return res.status(404).json({
      success: false,
      message: `Product '${productId}' not found`,
    });
  }

  // Calculate product price (with variant if provided)
  let pricePerUnit = product.pricing?.finalPrice || product.pricing?.regularPrice || 0;
  let selectedVariant = null;

  if (variantId && product.variants && product.variants.length > 0) {
    selectedVariant = product.variants.find((v) => v.variantId === variantId);

    if (!selectedVariant) {
      return res.status(404).json({
        success: false,
        message: `Variant '${variantId}' not found for this product`,
      });
    }

    if (!selectedVariant.isActive) {
      return res.status(400).json({
        success: false,
        message: `Variant '${variantId}' is not available`,
      });
    }

    pricePerUnit = selectedVariant.salePrice || selectedVariant.price;
  }

  const totalProductPrice = pricePerUnit * quantity;
  const originalPrice = totalProductPrice;

  // Find and validate coupon
  const Coupon = require("../models/Coupon");

  const coupon = await Coupon.findOne({
    couponCode: couponCode.toUpperCase(),
    isActive: true,
  });

  if (!coupon) {
    return res.status(404).json({
      success: false,
      message: `Coupon '${couponCode}' not found or inactive`,
    });
  }

  // Expiry check
  if (new Date() > coupon.expiryDate) {
    return res.status(400).json({
      success: false,
      message: `Coupon '${couponCode}' expired on ${coupon.expiryDate.toDateString()}`,
    });
  }

  // Minimum order value check
  if (totalProductPrice < coupon.minOrderValue) {
    return res.status(400).json({
      success: false,
      message: `Coupon '${couponCode}' has expired on ${coupon.expiryDate.toDateString()}`,
    });
  }

  if (totalProductPrice < coupon.minOrderValue) {
    return res.status(400).json({
      success: false,
      message: `Minimum order value of ₹${coupon.minOrderValue} is required for this coupon. Current order value: ₹${totalProductPrice}`,
    });
  }

  // Check usage limit
  if (coupon.maxUsageCount !== null && coupon.currentUsageCount >= coupon.maxUsageCount) {
    return res.status(400).json({
      success: false,
      message: `Coupon usage limit reached`,
    });
  }

  // Calculate discount based on coupon type
  let discountAmount = 0;
  let finalPrice = totalProductPrice;
  let freeDays = 0;
  let reducedDays = 0;
  let milestoneDetails = null;
  let savingsMessage = "";
  let howItWorksMessage = "";

  const couponType = coupon.couponType || "INSTANT";

  // Calculate base discount (for INSTANT and REDUCE_DAYS)
  if (couponType === "INSTANT" || couponType === "REDUCE_DAYS") {
    if (coupon.discountType === "flat") {
      discountAmount = coupon.discountValue;
    } else if (coupon.discountType === "percentage") {
      discountAmount = Math.round((totalProductPrice * coupon.discountValue) / 100);
    }
    discountAmount = Math.min(discountAmount, totalProductPrice);
  }

  // Apply coupon based on type
  if (couponType === "INSTANT") {
    // INSTANT: Reduce price immediately
    finalPrice = totalProductPrice - discountAmount;
    savingsMessage = `You will save ₹${discountAmount} instantly!`;
    howItWorksMessage = `The product price will be reduced from ₹${originalPrice} to ₹${finalPrice}. You will pay ₹${Math.round(finalPrice / totalDays)} per day for ${totalDays} days.`;

  } else if (couponType === "REDUCE_DAYS") {
    // REDUCE_DAYS: Convert discount to free days
    finalPrice = totalProductPrice; // Price stays same
    freeDays = Math.floor(discountAmount / dailyAmount);
    reducedDays = totalDays - freeDays;
    savingsMessage = `You will get ${freeDays} FREE days! Pay for only ${reducedDays} days instead of ${totalDays} days.`;
    howItWorksMessage = `Your last ${freeDays} installment payment(s) will be marked as FREE. You pay ₹${dailyAmount}/day for ${reducedDays} days, and get ${freeDays} days free (worth ₹${freeDays * dailyAmount}).`;

  } else if (couponType === "MILESTONE_REWARD") {
    // MILESTONE_REWARD: Free days after X payments
    const milestonePaymentsRequired = coupon.rewardCondition || coupon.milestonePaymentsRequired;
    const milestoneFreeDays = coupon.rewardValue || coupon.milestoneFreeDays;

    if (!milestonePaymentsRequired || !milestoneFreeDays) {
      return res.status(500).json({
        success: false,
        message: `Invalid milestone coupon configuration`,
      });
    }

    finalPrice = totalProductPrice; // Price stays same
    freeDays = milestoneFreeDays;

    milestoneDetails = {
      paymentsRequired: milestonePaymentsRequired,
      freeDaysReward: milestoneFreeDays,
      milestoneValue: milestoneFreeDays * dailyAmount,
    };

    savingsMessage = `Complete ${milestonePaymentsRequired} payments and get ${milestoneFreeDays} FREE days (worth ₹${milestoneDetails.milestoneValue})!`;
    howItWorksMessage = `After you successfully pay ${milestonePaymentsRequired} installments, you will receive ${milestoneFreeDays} free day(s) as a reward. The total reward value is ₹${milestoneDetails.milestoneValue}.`;
  }

  // Calculate savings percentage
  const savingsPercentage = originalPrice > 0
    ? Math.round((discountAmount / originalPrice) * 100)
    : 0;

  // Build detailed response
  const response = {
    valid: true,
    coupon: {
      code: coupon.couponCode,
      type: couponType,
      description: coupon.description || "",
      expiryDate: coupon.expiryDate,
      minOrderValue: coupon.minOrderValue,
    },
    pricing: {
      originalPrice,
      discountAmount,
      finalPrice,
      savingsPercentage,
      pricePerUnit,
      quantity,
    },
    installment: {
      totalDays,
      dailyAmount,
      freeDays,
      reducedDays: couponType === "REDUCE_DAYS" ? reducedDays : 0,
    },
    benefits: {
      savingsMessage,
      howItWorksMessage,
      totalSavings: couponType === "MILESTONE_REWARD"
        ? (milestoneDetails?.milestoneValue || 0)
        : discountAmount,
    },
    milestoneDetails,
    product: {
      id: product.productId || product._id,
      name: product.productName,
      variant: selectedVariant ? {
        id: selectedVariant.variantId,
        attributes: selectedVariant.attributes,
      } : null,
    },
  };

  successResponse(res, response, "Coupon is valid and can be applied");
});


/**
 * ✅ NEW API
 * @route   GET /api/installment-orders/:orderId/investment-status
 * @desc    Get investment status (amount left, days left, progress)
 * @access  Private
 */
const getInvestmentStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user._id;

  const order = await orderService.getOrderById(orderId, userId);
  if (!order) throw new OrderNotFoundError(orderId);

  const total = order.productPrice;
  const paid = order.totalPaidAmount;
  const remaining = order.remainingAmount;

  const totalDays = order.totalDays;
  const paidDays = order.paidInstallments;
  const daysLeft = totalDays - paidDays;

  const nextInstallment = order.getNextPendingInstallment();

  successResponse(
    res,
    {
      totalAmount: total,
      paidAmount: paid,
      remainingAmount: remaining,
      totalDays,
      paidDays,
      daysLeft,
      nextDue: nextInstallment || null,
    },
    "Investment status retrieved successfully"
  );
});
/**
 * ✅ NEW API
 * @route   GET /api/installments/orders/overall-status
 * @desc    Get overall investment status across ALL installment orders
 * @access  Private
 */
const getOverallInvestmentStatus = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const overview = await orderService.getOverallInvestmentStatus(userId);

  successResponse(
    res,
    { overview },
    "Overall investment status retrieved successfully"
  );
});

/**
 * @route   GET /api/installments/dashboard/overview
 * @desc    Get comprehensive dashboard overview for user
 * @access  Private
 *
 * @returns {
 *   todayPendingPayments: { count, totalAmount, orders: [...] },
 *   allPendingOrders: { count, totalPendingAmount, maxDays, orders: [...] },
 *   totalInvestment: { totalInvested, totalOrderValue, investmentPercentage },
 *   summary: { totalOrders, activeOrders, completedOrders, pendingOrders }
 * }
 */
const getDashboardOverview = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const InstallmentOrder = require('../models/InstallmentOrder');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get all user's orders
  const allOrders = await InstallmentOrder.find({ user: userId })
    .populate('product', 'name images')
    .sort({ createdAt: -1 });

  // 1. TODAY'S PENDING PAYMENTS
  const todayPendingOrders = allOrders.filter(order => {
    if (order.status !== 'ACTIVE') return false;

    return order.paymentSchedule.some(item => {
      if (item.status !== 'PENDING') return false;
      const dueDate = new Date(item.dueDate);
      return dueDate >= today && dueDate < tomorrow;
    });
  });

  const todayPendingPayments = [];
  let todayTotalAmount = 0;

  todayPendingOrders.forEach(order => {
    const todayPayments = order.paymentSchedule.filter(item => {
      if (item.status !== 'PENDING') return false;
      const dueDate = new Date(item.dueDate);
      return dueDate >= today && dueDate < tomorrow;
    });

    todayPayments.forEach(payment => {
      todayPendingPayments.push({
        orderId: order.orderId,
        productName: order.productName,
        productImage: order.product?.images?.[0] || '',
        installmentNumber: payment.installmentNumber,
        amount: payment.amount,
        dueDate: payment.dueDate
      });
      todayTotalAmount += payment.amount;
    });
  });

  // 2. ALL PENDING ORDERS (orders with status PENDING - not yet started)
  const pendingOrders = allOrders.filter(order => order.status === 'PENDING');

  const pendingOrdersData = pendingOrders.map(order => ({
    orderId: order.orderId,
    productName: order.productName,
    productImage: order.product?.images?.[0] || '',
    totalAmount: order.totalProductPrice,
    totalDays: order.totalDays,
    dailyAmount: order.dailyPaymentAmount,
    createdAt: order.createdAt
  }));

  const totalPendingAmount = pendingOrders.reduce((sum, order) => sum + order.totalProductPrice, 0);
  const maxDays = pendingOrders.length > 0
    ? Math.max(...pendingOrders.map(order => order.totalDays))
    : 0;

  // 3. TOTAL INVESTMENT (all orders - invested amount)
  const totalOrderValue = allOrders.reduce((sum, order) => sum + order.totalProductPrice, 0);
  const totalInvested = allOrders.reduce((sum, order) => sum + order.totalPaidAmount, 0);
  const investmentPercentage = totalOrderValue > 0
    ? Math.round((totalInvested / totalOrderValue) * 100)
    : 0;

  // 4. SUMMARY COUNTS
  const summary = {
    totalOrders: allOrders.length,
    activeOrders: allOrders.filter(o => o.status === 'ACTIVE').length,
    completedOrders: allOrders.filter(o => o.status === 'COMPLETED').length,
    pendingOrders: allOrders.filter(o => o.status === 'PENDING').length,
    cancelledOrders: allOrders.filter(o => o.status === 'CANCELLED').length
  };

  // 5. INVESTMENT BREAKDOWN BY STATUS
  const investmentByStatus = {
    active: {
      count: summary.activeOrders,
      totalValue: allOrders.filter(o => o.status === 'ACTIVE').reduce((sum, o) => sum + o.totalProductPrice, 0),
      totalPaid: allOrders.filter(o => o.status === 'ACTIVE').reduce((sum, o) => sum + o.totalPaidAmount, 0)
    },
    completed: {
      count: summary.completedOrders,
      totalValue: allOrders.filter(o => o.status === 'COMPLETED').reduce((sum, o) => sum + o.totalProductPrice, 0),
      totalPaid: allOrders.filter(o => o.status === 'COMPLETED').reduce((sum, o) => sum + o.totalPaidAmount, 0)
    },
    pending: {
      count: summary.pendingOrders,
      totalValue: totalPendingAmount,
      totalPaid: 0
    }
  };

  const responseData = {
    todayPendingPayments: {
      count: todayPendingPayments.length,
      totalAmount: todayTotalAmount,
      payments: todayPendingPayments
    },
    allPendingOrders: {
      count: pendingOrders.length,
      totalPendingAmount: totalPendingAmount,
      maxDays: maxDays,
      orders: pendingOrdersData
    },
    totalInvestment: {
      totalInvested: totalInvested,
      totalOrderValue: totalOrderValue,
      investmentPercentage: investmentPercentage,
      remainingAmount: totalOrderValue - totalInvested
    },
    summary: summary,
    investmentByStatus: investmentByStatus
  };

  successResponse(
    res,
    responseData,
    "Dashboard overview retrieved successfully"
  );
});

module.exports = {
  createOrder,
  getOrder,
  getUserOrders,
  cancelOrder,
  getOrderStats,
  getOrderSummary,
  getPaymentSchedule,
  validateCoupon,
  getInvestmentStatus,
  getOverallInvestmentStatus,
  getDashboardOverview
};

