/**
 * Installment Order Controller
 *
 * Handles HTTP requests for order management.
 * All controller methods are wrapped with asyncHandler for automatic error handling.
 */

const orderService = require('../services/installmentOrderService');
const { asyncHandler, successResponse } = require('../middlewares/errorHandler');
const { OrderNotFoundError, UnauthorizedOrderAccessError } = require('../utils/customErrors');

/**
 * @route   POST /api/installment-orders
 * @desc    Create new installment order with first payment
 * @access  Private (User must be authenticated)
 *
 * @body {
 *   productId: string (required),
 *   totalDays: number (required, min: 5),
 *   dailyAmount: number (optional, min: 50),
 *   paymentMethod: 'RAZORPAY' | 'WALLET' (required),
 *   deliveryAddress: object (required)
 * }
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: {
 *     order: object,
 *     firstPayment: object,
 *     razorpayOrder?: object (if paymentMethod === 'RAZORPAY')
 *   }
 * }
 */
const createOrder = asyncHandler(async (req, res) => {
  const userId = req.user._id; // Set by auth middleware

  const orderData = {
    userId,
    ...req.body
  };

  const result = await orderService.createOrder(orderData);

  // Determine message based on payment method
  const message = req.body.paymentMethod === 'WALLET'
    ? 'Order created successfully. First payment completed via wallet.'
    : 'Order created successfully. Please complete payment via Razorpay.';

  successResponse(res, result, message, 201);
});

/**
 * @route   GET /api/installment-orders/:orderId
 * @desc    Get order details by ID
 * @access  Private (User must own the order)
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: { order: object }
 * }
 */
const getOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user._id;

  const order = await orderService.getOrderById(orderId, userId);

  if (!order) {
    throw new OrderNotFoundError(orderId);
  }

  successResponse(res, { order }, 'Order retrieved successfully');
});

/**
 * @route   GET /api/installment-orders
 * @desc    Get user's orders
 * @access  Private
 *
 * @query {
 *   status?: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED',
 *   limit?: number (default: 50, max: 100),
 *   skip?: number (default: 0),
 *   page?: number
 * }
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: { orders: array, count: number }
 * }
 */
const getUserOrders = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { status, limit = 50, skip = 0, page } = req.query;

  // Calculate skip from page if provided
  const actualSkip = page ? (page - 1) * limit : skip;

  const options = {
    status,
    limit: Math.min(limit, 100), // Cap at 100
    skip: actualSkip
  };

  const orders = await orderService.getUserOrders(userId, options);

  successResponse(res, {
    orders,
    count: orders.length,
    page: page || Math.floor(actualSkip / limit) + 1,
    limit
  }, 'Orders retrieved successfully');
});

/**
 * @route   POST /api/installment-orders/:orderId/cancel
 * @desc    Cancel an order
 * @access  Private (User must own the order)
 *
 * @body {
 *   reason: string (required, min: 10 chars)
 * }
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: { order: object }
 * }
 */
const cancelOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;
  const userId = req.user._id;

  const order = await orderService.cancelOrder(orderId, userId, reason);

  successResponse(res, { order }, 'Order cancelled successfully');
});

/**
 * @route   GET /api/installment-orders/stats
 * @desc    Get user's order statistics
 * @access  Private
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: { stats: array }
 * }
 */
const getOrderStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const stats = await orderService.getOrderStats(userId);

  // Transform stats for better readability
  const transformedStats = {
    total: 0,
    totalValue: 0,
    totalPaid: 0,
    byStatus: {}
  };

  stats.forEach(stat => {
    transformedStats.total += stat.count;
    transformedStats.totalValue += stat.totalValue;
    transformedStats.totalPaid += stat.totalPaid;
    transformedStats.byStatus[stat._id] = {
      count: stat.count,
      totalValue: stat.totalValue,
      totalPaid: stat.totalPaid
    };
  });

  successResponse(res, { stats: transformedStats }, 'Order statistics retrieved successfully');
});

/**
 * @route   GET /api/installment-orders/:orderId/summary
 * @desc    Get order summary with payment progress
 * @access  Private (User must own the order)
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: { summary: object }
 * }
 */
const getOrderSummary = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user._id;

  const order = await orderService.getOrderById(orderId, userId);

  if (!order) {
    throw new OrderNotFoundError(orderId);
  }

  const summary = order.getSummary();

  successResponse(res, { summary }, 'Order summary retrieved successfully');
});

/**
 * @route   GET /api/installment-orders/:orderId/schedule
 * @desc    Get payment schedule for order
 * @access  Private (User must own the order)
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: { schedule: array, summary: object }
 * }
 */
const getPaymentSchedule = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user._id;

  const order = await orderService.getOrderById(orderId, userId);

  if (!order) {
    throw new OrderNotFoundError(orderId);
  }

  const summary = {
    totalInstallments: order.paymentSchedule.length,
    paidInstallments: order.paymentSchedule.filter(s => s.status === 'PAID').length,
    pendingInstallments: order.paymentSchedule.filter(s => s.status === 'PENDING').length,
    skippedInstallments: order.paymentSchedule.filter(s => s.status === 'SKIPPED').length
  };

  successResponse(res, {
    schedule: order.paymentSchedule,
    summary
  }, 'Payment schedule retrieved successfully');
});

/**
 * @route   POST /api/installment/validate-coupon
 * @desc    Validate coupon and calculate discount
 * @access  Public
 *
 * @body {
 *   couponCode: string (required),
 *   productPrice: number (required)
 * }
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: {
 *     coupon: {
 *       code: string,
 *       discountType: string,
 *       discountValue: number,
 *       discountAmount: number,
 *       originalPrice: number,
 *       finalPrice: number
 *     }
 *   }
 * }
 */
const validateCoupon = asyncHandler(async (req, res) => {
  const { couponCode, productPrice } = req.body;

  if (!couponCode || productPrice === undefined) {
    return res.status(400).json({
      success: false,
      message: 'couponCode and productPrice are required'
    });
  }

  if (productPrice < 0) {
    return res.status(400).json({
      success: false,
      message: 'productPrice must be a positive number'
    });
  }

  // Load Coupon model
  const Coupon = require('../models/Coupon');
  const coupon = await Coupon.findOne({ couponCode: couponCode.toUpperCase() });

  if (!coupon) {
    return res.status(404).json({
      success: false,
      message: `Coupon '${couponCode}' not found`
    });
  }

  // Validate coupon is active
  if (!coupon.isActive) {
    return res.status(400).json({
      success: false,
      message: `Coupon '${couponCode}' is not active`
    });
  }

  // Validate coupon not expired
  const now = new Date();
  if (now > coupon.expiryDate) {
    return res.status(400).json({
      success: false,
      message: `Coupon '${couponCode}' has expired`
    });
  }

  // Validate minimum order value
  if (productPrice < coupon.minOrderValue) {
    return res.status(400).json({
      success: false,
      message: `Minimum order value of ₹${coupon.minOrderValue} is required for this coupon`,
      minOrderValue: coupon.minOrderValue
    });
  }

  // Calculate discount
  let discountAmount = 0;
  if (coupon.discountType === 'flat') {
    discountAmount = coupon.discountValue;
  } else if (coupon.discountType === 'percentage') {
    discountAmount = Math.round((productPrice * coupon.discountValue) / 100);
  }

  // Ensure discount doesn't exceed order amount
  discountAmount = Math.min(discountAmount, productPrice);

  const finalPrice = productPrice - discountAmount;

  successResponse(res, {
    coupon: {
      code: coupon.couponCode,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount: discountAmount,
      originalPrice: productPrice,
      finalPrice: finalPrice
    }
  }, 'Coupon is valid');
});

module.exports = {
  createOrder,
  getOrder,
  getUserOrders,
  cancelOrder,
  getOrderStats,
  getOrderSummary,
  getPaymentSchedule,
  validateCoupon
};
