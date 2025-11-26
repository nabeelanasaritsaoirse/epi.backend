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

  const orderData = {
    userId,
    ...req.body,
  };

  const result = await orderService.createOrder(orderData);

  const message =
    req.body.paymentMethod === "WALLET"
      ? "Order created successfully. First payment completed via wallet."
      : "Order created successfully. Please complete payment via Razorpay.";

  successResponse(res, result, message, 201);
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
const validateCoupon = asyncHandler(async (req, res) => {
  const { couponCode, productPrice } = req.body;

  if (!couponCode || productPrice === undefined) {
    return res.status(400).json({
      success: false,
      message: "couponCode and productPrice are required",
    });
  }

  if (productPrice < 0) {
    return res.status(400).json({
      success: false,
      message: "productPrice must be a positive number",
    });
  }

  const Coupon = require("../models/Coupon");
  const coupon = await Coupon.findOne({ couponCode: couponCode.toUpperCase() });

  if (!coupon) {
    return res.status(404).json({
      success: false,
      message: `Coupon '${couponCode}' not found`,
    });
  }

  if (!coupon.isActive) {
    return res.status(400).json({
      success: false,
      message: `Coupon '${couponCode}' is not active`,
    });
  }

  const now = new Date();
  if (now > coupon.expiryDate) {
    return res.status(400).json({
      success: false,
      message: `Coupon '${couponCode}' has expired`,
    });
  }

  if (productPrice < coupon.minOrderValue) {
    return res.status(400).json({
      success: false,
      message: `Minimum order value of ₹${coupon.minOrderValue} is required for this coupon`,
    });
  }

  let discountAmount = 0;
  if (coupon.discountType === "flat") discountAmount = coupon.discountValue;
  else discountAmount = Math.round((productPrice * coupon.discountValue) / 100);

  discountAmount = Math.min(discountAmount, productPrice);

  const finalPrice = productPrice - discountAmount;

  successResponse(
    res,
    {
      coupon: {
        code: coupon.couponCode,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount,
        originalPrice: productPrice,
        finalPrice,
      },
    },
    "Coupon is valid"
  );
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
  getOverallInvestmentStatus
};

