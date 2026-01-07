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

  // introduce updatedDailyAmount (was requested)
  let updatedDailyAmount = dailyAmount;

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
      message: `Minimum order value of ₹${coupon.minOrderValue} required. Current order value: ₹${totalProductPrice}`,
    });
  }

  // Max usage check
  if (
    coupon.maxUsageCount !== null &&
    coupon.currentUsageCount >= coupon.maxUsageCount
  ) {
    return res.status(400).json({
      success: false,
      message: `Coupon usage limit reached`,
    });
  }

  // Get coupon type
  const couponType = coupon.couponType || "INSTANT";

  // Calculate base discount (for INSTANT and REDUCE_DAYS)
  let discountAmount = 0;
  if (couponType === "INSTANT" || couponType === "REDUCE_DAYS") {
    if (coupon.discountType === "flat") {
      discountAmount = coupon.discountValue;
    } else if (coupon.discountType === "percentage") {
      discountAmount = Math.round((totalProductPrice * coupon.discountValue) / 100);
    }
    discountAmount = Math.min(discountAmount, totalProductPrice);
  }

  // Apply coupon based on type
  let finalPrice = totalProductPrice;
  let freeDays = 0;
  let reducedDays = 0;
  let milestoneDetails = null;
  let savingsMessage = "";
  let howItWorksMessage = "";

  switch (couponType) {
    case "INSTANT":
      finalPrice = totalProductPrice - discountAmount;
      updatedDailyAmount = Math.ceil(finalPrice / totalDays);

      savingsMessage = `You will save ₹${discountAmount} instantly!`;
      howItWorksMessage = `The product price will be reduced from ₹${originalPrice} to ₹${finalPrice}. You will pay ₹${updatedDailyAmount} per day for ${totalDays} days.`;
      break;

    case "REDUCE_DAYS":
      finalPrice = totalProductPrice;

      freeDays = Math.floor(discountAmount / dailyAmount);
      reducedDays = totalDays - freeDays;

      savingsMessage = `You will get ${freeDays} FREE days! Pay for only ${reducedDays} days instead of ${totalDays} days.`;
      howItWorksMessage = `Your last ${freeDays} installment payment(s) will be marked as FREE. You pay ₹${dailyAmount}/day for ${reducedDays} days, and get ${freeDays} days free (worth ₹${freeDays * dailyAmount}).`;
      break;

    case "MILESTONE_REWARD":
      const milestonePaymentsRequired = coupon.rewardCondition || coupon.milestonePaymentsRequired;
      const milestoneFreeDays = coupon.rewardValue || coupon.milestoneFreeDays;

      if (!milestonePaymentsRequired || !milestoneFreeDays) {
        return res.status(500).json({
          success: false,
          message: `Invalid milestone coupon configuration`,
        });
      }

      finalPrice = totalProductPrice;
      freeDays = milestoneFreeDays;

      milestoneDetails = {
        paymentsRequired: milestonePaymentsRequired,
        freeDaysReward: milestoneFreeDays,
        milestoneValue: milestoneFreeDays * dailyAmount,
      };

      savingsMessage = `Complete ${milestonePaymentsRequired} payments and get ${milestoneFreeDays} FREE days (worth ₹${milestoneDetails.milestoneValue})!`;
      howItWorksMessage = `After you successfully pay ${milestonePaymentsRequired} installments, you will receive ${milestoneFreeDays} free day(s) as a reward. The total reward value is ₹${milestoneDetails.milestoneValue}.`;
      break;
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
      dailyAmount: updatedDailyAmount,
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
      name: product.name || product.productName,
      variant: selectedVariant
        ? {
            id: selectedVariant.variantId,
            attributes: selectedVariant.attributes,
          }
        : null,
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
 * @route   POST /api/installment-orders/verify-first-payment
 * @desc    Verify first Razorpay payment and activate the order
 * @access  Private
 *
 * @body {
 *   orderId: string (required) - The order ID (MongoDB _id or orderId)
 *   razorpayOrderId: string (required) - Razorpay order ID
 *   razorpayPaymentId: string (required) - Razorpay payment ID
 *   razorpaySignature: string (required) - Razorpay signature for verification
 * }
 *
 * @returns { success, order, payment, message }
 */
const verifyFirstPayment = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  // Validate required fields
  if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(400).json({
      success: false,
      message: "orderId, razorpayOrderId, razorpayPaymentId, and razorpaySignature are required",
    });
  }

  console.log('🔍 DEBUG: verifyFirstPayment called');
  console.log('🔍 DEBUG: Order ID:', orderId);
  console.log('🔍 DEBUG: Razorpay Order ID:', razorpayOrderId);

  const result = await orderService.verifyFirstPayment({
    orderId,
    userId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });

  console.log('✅ First payment verified successfully!');

  successResponse(res, result, result.message, 200);
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

/**
 * ============================================
 * BULK ORDER APIS
 * ============================================
 */

/**
 * @route   POST /api/installments/orders/bulk
 * @desc    Create bulk order with multiple products (single payment)
 * @access  Private
 *
 * @body {
 *   items: [
 *     { productId, variantId?, quantity?, totalDays, couponCode? },
 *     ...
 *   ],
 *   paymentMethod: 'RAZORPAY' | 'WALLET',
 *   deliveryAddress: { name, phoneNumber, addressLine1, city, state, pincode, country? }
 * }
 */
const createBulkOrder = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { items, paymentMethod, deliveryAddress } = req.body;

  console.log('🛒 BULK ORDER: Controller - createBulkOrder called');
  console.log('🛒 Items count:', items?.length);
  console.log('🛒 Payment method:', paymentMethod);

  // Basic validation
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'items array is required and must not be empty'
    });
  }

  if (!paymentMethod || !['RAZORPAY', 'WALLET'].includes(paymentMethod)) {
    return res.status(400).json({
      success: false,
      message: 'paymentMethod must be RAZORPAY or WALLET'
    });
  }

  if (!deliveryAddress) {
    return res.status(400).json({
      success: false,
      message: 'deliveryAddress is required'
    });
  }

  const bulkOrderData = {
    userId,
    items,
    paymentMethod,
    deliveryAddress
  };

  const result = await orderService.createBulkOrder(bulkOrderData);

  console.log('✅ BULK ORDER: Created successfully');
  console.log('✅ Bulk Order ID:', result.bulkOrderId);

  successResponse(res, result, result.message, 201);
});

/**
 * @route   POST /api/installments/orders/bulk/verify-payment
 * @desc    Verify Razorpay payment for bulk order and activate all orders
 * @access  Private
 *
 * @body {
 *   bulkOrderId: string,
 *   razorpayOrderId: string,
 *   razorpayPaymentId: string,
 *   razorpaySignature: string
 * }
 */
const verifyBulkOrderPayment = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { bulkOrderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  console.log('🔐 BULK ORDER: Controller - verifyBulkOrderPayment called');
  console.log('🔐 Bulk Order ID:', bulkOrderId);

  // Validation
  if (!bulkOrderId) {
    return res.status(400).json({
      success: false,
      message: 'bulkOrderId is required'
    });
  }

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(400).json({
      success: false,
      message: 'razorpayOrderId, razorpayPaymentId, and razorpaySignature are required'
    });
  }

  const result = await orderService.verifyBulkOrderPayment({
    bulkOrderId,
    userId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature
  });

  console.log('✅ BULK ORDER: Payment verified successfully');

  successResponse(res, result, result.message, 200);
});

/**
 * @route   GET /api/installments/orders/bulk/:bulkOrderId
 * @desc    Get bulk order details
 * @access  Private
 */
const getBulkOrderDetails = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { bulkOrderId } = req.params;

  if (!bulkOrderId) {
    return res.status(400).json({
      success: false,
      message: 'bulkOrderId is required'
    });
  }

  const result = await orderService.getBulkOrderDetails(bulkOrderId, userId);

  successResponse(res, result, 'Bulk order details retrieved successfully', 200);
});

/**
 * @route   GET /api/installments/orders/my-bulk-orders
 * @desc    Get user's bulk orders list
 * @access  Private
 */
const getMyBulkOrders = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const InstallmentOrder = require('../models/InstallmentOrder');

  // Get all orders with bulkOrderId
  const ordersWithBulk = await InstallmentOrder.find({
    user: userId,
    bulkOrderId: { $ne: null }
  })
    .select('bulkOrderId orderId productName status dailyPaymentAmount totalDays createdAt')
    .sort({ createdAt: -1 });

  // Group by bulkOrderId
  const bulkOrdersMap = {};
  ordersWithBulk.forEach(order => {
    if (!bulkOrdersMap[order.bulkOrderId]) {
      bulkOrdersMap[order.bulkOrderId] = {
        bulkOrderId: order.bulkOrderId,
        orders: [],
        totalOrders: 0,
        totalFirstPayment: 0,
        createdAt: order.createdAt,
        statuses: {}
      };
    }

    bulkOrdersMap[order.bulkOrderId].orders.push({
      orderId: order.orderId,
      productName: order.productName,
      status: order.status,
      dailyPaymentAmount: order.dailyPaymentAmount,
      totalDays: order.totalDays
    });

    bulkOrdersMap[order.bulkOrderId].totalOrders += 1;
    bulkOrdersMap[order.bulkOrderId].totalFirstPayment += order.dailyPaymentAmount;

    // Count statuses
    const status = order.status;
    bulkOrdersMap[order.bulkOrderId].statuses[status] =
      (bulkOrdersMap[order.bulkOrderId].statuses[status] || 0) + 1;
  });

  const bulkOrders = Object.values(bulkOrdersMap).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  successResponse(
    res,
    {
      bulkOrders,
      totalBulkOrders: bulkOrders.length
    },
    'Bulk orders retrieved successfully',
    200
  );
});

/**
 * @route   POST /api/installments/orders/preview
 * @desc    Preview order details without creating the order
 * @access  Private
 *
 * @body {
 *   productId: string (required) - Product ID or MongoDB _id
 *   variantId: string (optional) - Product variant ID
 *   quantity: number (optional, default: 1) - Product quantity (1-10)
 *   totalDays: number (required) - Total installment days
 *   couponCode: string (optional) - Coupon code to apply
 *   deliveryAddress: object (required) - Delivery address object
 * }
 *
 * @returns Order preview with all validations and calculations
 */
const previewOrder = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const {
    productId,
    variantId,
    quantity = 1,
    totalDays,
    couponCode,
    deliveryAddress,
  } = req.body;

  console.log('\n========================================');
  console.log('🔍 ORDER PREVIEW: Controller called');
  console.log('========================================');
  console.log(`🔍 Product ID: ${productId}, Variant ID: ${variantId}, Quantity: ${quantity}`);
  console.log(`🔍 Total Days: ${totalDays}, Coupon: ${couponCode || 'None'}`);

  // ===================================
  // VALIDATION
  // ===================================

  if (!productId) {
    return res.status(400).json({
      success: false,
      message: 'productId is required',
    });
  }

  if (!totalDays || isNaN(totalDays) || totalDays < 1) {
    return res.status(400).json({
      success: false,
      message: 'totalDays is required and must be a positive number',
    });
  }

  if (quantity < 1 || quantity > 10) {
    return res.status(400).json({
      success: false,
      message: 'quantity must be between 1 and 10',
    });
  }

  if (!deliveryAddress) {
    return res.status(400).json({
      success: false,
      message: 'deliveryAddress is required',
    });
  }

  // ===================================
  // GET USER
  // ===================================

  const User = require('../models/User');
  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // ===================================
  // GET PRODUCT
  // ===================================

  const Product = require('../models/Product');
  const mongoose = require('mongoose');

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

  // Check product availability
  if (
    product.availability?.stockStatus === 'out_of_stock' ||
    product.availability?.isAvailable === false
  ) {
    return res.status(400).json({
      success: false,
      message: `Product '${product.name}' is currently out of stock`,
    });
  }

  // ===================================
  // GET VARIANT & PRICE
  // ===================================

  let selectedVariant = null;
  let pricePerUnit = product.pricing?.finalPrice || product.pricing?.regularPrice || 0;
  let variantDetails = null;

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

    variantDetails = {
      variantId: selectedVariant.variantId,
      sku: selectedVariant.sku,
      attributes: selectedVariant.attributes,
      price: pricePerUnit,
    };
  }

  if (!pricePerUnit || pricePerUnit <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Product price is invalid or not configured properly',
    });
  }

  // ===================================
  // CALCULATE BASE PRICING
  // ===================================

  const {
    calculateTotalProductPrice,
    applyInstantCoupon,
    calculateDailyAmount,
    validateInstallmentDuration,
  } = require('../utils/installmentHelpers');

  const totalProductPrice = calculateTotalProductPrice(pricePerUnit, quantity);
  let productPrice = totalProductPrice;
  let originalPrice = totalProductPrice;

  let couponDiscount = 0;
  let appliedCouponCode = null;
  let couponType = null;
  let couponDetails = null;

  let milestonePaymentsRequired = null;
  let milestoneFreeDays = null;

  // ===================================
  // APPLY COUPON (IF PROVIDED)
  // ===================================

  if (couponCode) {
    const Coupon = require('../models/Coupon');

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
        message: `Minimum order value of ₹${coupon.minOrderValue} required. Current order value: ₹${totalProductPrice}`,
      });
    }

    // Max usage check
    if (
      coupon.maxUsageCount !== null &&
      coupon.currentUsageCount >= coupon.maxUsageCount
    ) {
      return res.status(400).json({
        success: false,
        message: 'Coupon usage limit reached',
      });
    }

    // Calculate discount
    if (coupon.discountType === 'flat') {
      couponDiscount = coupon.discountValue;
    } else if (coupon.discountType === 'percentage') {
      couponDiscount = Math.round((totalProductPrice * coupon.discountValue) / 100);
    }

    couponDiscount = Math.min(couponDiscount, totalProductPrice);
    couponType = coupon.couponType || 'INSTANT';
    appliedCouponCode = coupon.couponCode;

    // Apply coupon based on type
    if (couponType === 'INSTANT') {
      const result = applyInstantCoupon(totalProductPrice, couponDiscount);
      productPrice = result.finalPrice;
    } else if (couponType === 'REDUCE_DAYS') {
      productPrice = totalProductPrice;
    }

    if (couponType === 'MILESTONE_REWARD') {
      milestonePaymentsRequired = coupon.rewardCondition;
      milestoneFreeDays = coupon.rewardValue;

      if (!milestonePaymentsRequired || !milestoneFreeDays) {
        return res.status(400).json({
          success: false,
          message: 'Invalid milestone coupon configuration',
        });
      }
    }

    couponDetails = {
      code: coupon.couponCode,
      type: couponType,
      description: coupon.description || '',
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount: couponDiscount,
      expiryDate: coupon.expiryDate,
    };
  }

  // ===================================
  // VALIDATE INSTALLMENT DURATION
  // ===================================

  const durationValidation = validateInstallmentDuration(totalDays, productPrice);

  if (!durationValidation.valid) {
    return res.status(400).json({
      success: false,
      message: `Invalid installment duration. Must be between ${durationValidation.min} and ${durationValidation.max} days for product price ₹${productPrice}`,
      validRange: {
        min: durationValidation.min,
        max: durationValidation.max,
      },
    });
  }

  // ===================================
  // CALCULATE DAILY AMOUNT
  // ===================================

  let dailyAmount;

  if (couponType === 'INSTANT') {
    // For INSTANT coupons, recalculate based on discounted price
    dailyAmount = Math.ceil(productPrice / totalDays);
  } else {
    // Calculate normally
    dailyAmount = calculateDailyAmount(productPrice, totalDays);
  }

  if (dailyAmount < 50) {
    return res.status(400).json({
      success: false,
      message: 'Daily payment amount must be at least ₹50',
    });
  }

  // ===================================
  // CALCULATE COUPON BENEFITS
  // ===================================

  let freeDays = 0;
  let reducedDays = 0;
  let milestoneDetails = null;
  let savingsMessage = '';
  let howItWorksMessage = '';

  if (couponType === 'INSTANT') {
    savingsMessage = `You will save ₹${couponDiscount} instantly!`;
    howItWorksMessage = `The product price will be reduced from ₹${originalPrice} to ₹${productPrice}. You will pay ₹${dailyAmount} per day for ${totalDays} days.`;
  } else if (couponType === 'REDUCE_DAYS') {
    freeDays = Math.floor(couponDiscount / dailyAmount);
    reducedDays = totalDays - freeDays;

    savingsMessage = `You will get ${freeDays} FREE days! Pay for only ${reducedDays} days instead of ${totalDays} days.`;
    howItWorksMessage = `Your last ${freeDays} installment payment(s) will be marked as FREE. You pay ₹${dailyAmount}/day for ${reducedDays} days, and get ${freeDays} days free (worth ₹${freeDays * dailyAmount}).`;
  } else if (couponType === 'MILESTONE_REWARD') {
    const milestoneValue = milestoneFreeDays * dailyAmount;

    milestoneDetails = {
      paymentsRequired: milestonePaymentsRequired,
      freeDaysReward: milestoneFreeDays,
      milestoneValue: milestoneValue,
    };

    savingsMessage = `Complete ${milestonePaymentsRequired} payments and get ${milestoneFreeDays} FREE days (worth ₹${milestoneValue})!`;
    howItWorksMessage = `After you successfully pay ${milestonePaymentsRequired} installments, you will receive ${milestoneFreeDays} free day(s) as a reward. The total reward value is ₹${milestoneValue}.`;
  }

  // ===================================
  // CALCULATE TOTAL PAYABLE
  // ===================================

  const totalPayableAmount = dailyAmount * totalDays;
  const totalSavings = originalPrice - totalPayableAmount;

  // ===================================
  // GET REFERRER INFO
  // ===================================

  let referrerInfo = null;
  let commissionPercentage = 10; // Default 10%

  if (user.referredBy) {
    const referrer = await User.findById(user.referredBy).select('name email');

    if (referrer) {
      const commissionAmount = (dailyAmount * commissionPercentage) / 100;

      referrerInfo = {
        referrerName: referrer.name,
        referrerEmail: referrer.email,
        commissionPercentage: commissionPercentage,
        commissionPerPayment: commissionAmount,
        totalCommissionEstimate: commissionAmount * totalDays,
      };
    }
  }

  // ===================================
  // BUILD PREVIEW RESPONSE
  // ===================================

  const previewData = {
    // Product Info
    product: {
      id: product.productId || product._id,
      name: product.name,
      description: product.description?.short || product.description?.long || '',
      images: product.images || [],
      brand: product.brand,
      category: product.category,
      variant: variantDetails,
    },

    // Pricing Breakdown
    pricing: {
      pricePerUnit: pricePerUnit,
      quantity: quantity,
      totalProductPrice: totalProductPrice,
      originalPrice: originalPrice,
      couponDiscount: couponDiscount,
      finalProductPrice: productPrice,
      savingsPercentage: originalPrice > 0 ? Math.round((couponDiscount / originalPrice) * 100) : 0,
    },

    // Installment Details
    installment: {
      totalDays: totalDays,
      dailyAmount: dailyAmount,
      totalPayableAmount: totalPayableAmount,
      totalSavings: totalSavings > 0 ? totalSavings : 0,
      freeDays: freeDays,
      reducedDays: reducedDays > 0 ? reducedDays : totalDays,
      minimumDailyAmount: 50,
    },

    // Coupon Info (if applied)
    coupon: couponDetails ? {
      ...couponDetails,
      benefits: {
        savingsMessage: savingsMessage,
        howItWorksMessage: howItWorksMessage,
      },
      milestoneDetails: milestoneDetails,
    } : null,

    // Delivery Address
    deliveryAddress: deliveryAddress,

    // Referrer Commission Info
    referrer: referrerInfo,

    // Order Summary
    summary: {
      orderType: 'INSTALLMENT',
      status: 'PREVIEW',
      totalAmount: productPrice,
      dailyPayment: dailyAmount,
      duration: totalDays,
      firstPaymentAmount: dailyAmount,
      estimatedCompletionDate: new Date(Date.now() + totalDays * 24 * 60 * 60 * 1000),
    },

    // Validation Status
    validation: {
      isValid: true,
      productAvailable: true,
      durationValid: durationValidation.valid,
      dailyAmountValid: dailyAmount >= 50,
      couponValid: couponCode ? true : null,
    },
  };

  console.log('✅ ORDER PREVIEW: Generated successfully');
  console.log(`✅ Product: ${product.name}`);
  console.log(`✅ Total Days: ${totalDays}, Daily Amount: ₹${dailyAmount}`);
  console.log(`✅ Total Payable: ₹${totalPayableAmount}\n`);

  successResponse(
    res,
    previewData,
    'Order preview generated successfully',
    200
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
  verifyFirstPayment,
  getDashboardOverview,
  // Bulk Order APIs
  createBulkOrder,
  verifyBulkOrderPayment,
  getBulkOrderDetails,
  getMyBulkOrders,
  // Order Preview API
  previewOrder
};

