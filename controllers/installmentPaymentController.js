/**
 * Installment Payment Controller
 *
 * Handles HTTP requests for payment processing.
 * All controller methods are wrapped with asyncHandler for automatic error handling.
 */

const paymentService = require('../services/installmentPaymentService');
const { asyncHandler, successResponse } = require('../middlewares/errorHandler');

/**
 * @route   POST /api/installment-payments/create-razorpay-order
 * @desc    Create Razorpay order for next installment payment
 * @access  Private
 *
 * @body {
 *   orderId: string (required)
 * }
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: {
 *     razorpayOrderId: string,
 *     amount: number,
 *     currency: string,
 *     keyId: string,
 *     installmentNumber: number,
 *     orderDetails: object
 *   }
 * }
 */
const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  const userId = req.user._id;

  const razorpayOrder = await paymentService.createRazorpayOrderForPayment(orderId, userId);

  successResponse(
    res,
    razorpayOrder,
    'Razorpay order created successfully. Proceed with payment.',
    200
  );
});

/**
 * @route   POST /api/installment-payments/process
 * @desc    Process installment payment (Razorpay or Wallet)
 * @access  Private
 *
 * @body {
 *   orderId: string (required),
 *   paymentMethod: 'RAZORPAY' | 'WALLET' (required),
 *   razorpayOrderId?: string (required if RAZORPAY),
 *   razorpayPaymentId?: string (required if RAZORPAY),
 *   razorpaySignature?: string (required if RAZORPAY)
 * }
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: {
 *     payment: object,
 *     order: object,
 *     commission?: object (if referrer exists)
 *   }
 * }
 */
const processPayment = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const paymentData = {
    userId,
    ...req.body
  };

  const result = await paymentService.processPayment(paymentData);

  // Determine message based on order completion status
  let message = 'Payment processed successfully.';

  if (result.order.isCompleted) {
    message = 'Payment processed successfully. Order is now complete! Awaiting admin approval for delivery.';
  } else {
    const remaining = result.order.remainingInstallments || 0;
    message = `Payment processed successfully. ${remaining} installment(s) remaining.`;
  }

  if (result.commission) {
    message += ` Commission credited to referrer: ₹${result.commission.amount}`;
  }

  successResponse(res, result, message, 200);
});

/**
 * @route   GET /api/installment-payments/history/:orderId
 * @desc    Get payment history for specific order
 * @access  Private (User must own the order)
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: { payments: array, count: number }
 * }
 */
const getPaymentHistory = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user._id;

  const payments = await paymentService.getPaymentHistory(orderId, userId);

  successResponse(res, {
    payments,
    count: payments.length
  }, 'Payment history retrieved successfully');
});

/**
 * @route   GET /api/installment-payments/my-payments
 * @desc    Get user's all payment history
 * @access  Private
 *
 * @query {
 *   status?: 'PENDING' | 'COMPLETED' | 'FAILED',
 *   limit?: number (default: 50, max: 100),
 *   skip?: number (default: 0),
 *   page?: number
 * }
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: { payments: array, count: number }
 * }
 */
const getMyPayments = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { status, limit = 50, skip = 0, page } = req.query;

  // Calculate skip from page if provided
  const actualSkip = page ? (page - 1) * limit : skip;

  const options = {
    status,
    limit: Math.min(limit, 100), // Cap at 100
    skip: actualSkip
  };

  const payments = await paymentService.getUserPaymentHistory(userId, options);

  successResponse(res, {
    payments,
    count: payments.length,
    page: page || Math.floor(actualSkip / limit) + 1,
    limit
  }, 'Payment history retrieved successfully');
});

/**
 * @route   GET /api/installment-payments/stats
 * @desc    Get payment statistics for user
 * @access  Private
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: { stats: object }
 * }
 */
const getPaymentStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const stats = await paymentService.getPaymentStats(userId);

  // Transform stats for better readability
  const transformedStats = {
    total: 0,
    totalAmount: 0,
    byMethod: {}
  };

  stats.forEach(stat => {
    transformedStats.total += stat.count;
    transformedStats.totalAmount += stat.totalAmount;
    transformedStats.byMethod[stat._id] = {
      count: stat.count,
      totalAmount: stat.totalAmount,
      totalCommission: stat.totalCommission
    };
  });

  successResponse(res, { stats: transformedStats }, 'Payment statistics retrieved successfully');
});

/**
 * @route   POST /api/installment-payments/:paymentId/retry
 * @desc    Retry failed payment
 * @access  Private
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: { payment: object }
 * }
 */
const retryPayment = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;

  const payment = await paymentService.retryFailedPayment(paymentId);

  successResponse(res, { payment }, 'Payment retry initiated successfully');
});

/**
 * @route   GET /api/installment-payments/next-due/:orderId
 * @desc    Get next due payment details for order
 * @access  Private
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: { nextDue: object }
 * }
 */
const getNextDuePayment = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user._id;

  const orderService = require('../services/installmentOrderService');
  const order = await orderService.getOrderById(orderId, userId);

  if (!order) {
    throw new Error('Order not found');
  }

  const nextInstallment = order.getNextPendingInstallment();

  if (!nextInstallment) {
    return successResponse(res, {
      nextDue: null,
      message: 'No pending payments'
    }, 'All installments paid');
  }

  successResponse(res, {
    nextDue: {
      installmentNumber: nextInstallment.installmentNumber,
      amount: nextInstallment.amount,
      dueDate: nextInstallment.dueDate,
      status: nextInstallment.status
    }
  }, 'Next due payment retrieved successfully');
});

module.exports = {
  createRazorpayOrder,
  processPayment,
  getPaymentHistory,
  getMyPayments,
  getPaymentStats,
  retryPayment,
  getNextDuePayment
};
