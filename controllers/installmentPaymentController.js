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
 * @desc    Process installment payment
 * @access  Private
 */
const processPayment = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const paymentData = {
    userId,
    ...req.body
  };

  const result = await paymentService.processPayment(paymentData);

  let message = 'Payment processed successfully.';

  if (result.order.isCompleted) {
    message =
      'Payment processed successfully. Order is now complete! Awaiting admin approval for delivery.';
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
 * @desc    Get payment history for an order
 * @access  Private
 */
const getPaymentHistory = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user._id;

  const payments = await paymentService.getPaymentHistory(orderId, userId);

  successResponse(
    res,
    {
      payments,
      count: payments.length
    },
    'Payment history retrieved successfully'
  );
});

/**
 * @route   GET /api/installment-payments/my-payments
 * @desc    Get all payments of user
 * @access  Private
 */
const getMyPayments = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { status, limit = 50, skip = 0, page } = req.query;

  const actualSkip = page ? (page - 1) * limit : skip;

  const options = {
    status,
    limit: Math.min(limit, 100),
    skip: actualSkip
  };

  const payments = await paymentService.getUserPaymentHistory(userId, options);

  successResponse(
    res,
    {
      payments,
      count: payments.length,
      page: page || Math.floor(actualSkip / limit) + 1,
      limit
    },
    'Payment history retrieved successfully'
  );
});

/**
 * @route   GET /api/installment-payments/stats
 * @desc    Get payment statistics
 * @access  Private
 */
const getPaymentStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const stats = await paymentService.getPaymentStats(userId);

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
 */
const retryPayment = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;

  const payment = await paymentService.retryFailedPayment(paymentId);

  successResponse(res, { payment }, 'Payment retry initiated successfully');
});

/**
 * @route   GET /api/installment-payments/next-due/:orderId
 * @desc    Get next due installment
 * @access  Private
 */
const getNextDuePayment = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user._id;

  const orderService = require('../services/installmentOrderService');
  const order = await orderService.getOrderById(orderId, userId);

  if (!order) throw new Error('Order not found');

  const nextInstallment = order.getNextPendingInstallment();

  if (!nextInstallment) {
    return successResponse(
      res,
      { nextDue: null, message: 'No pending payments' },
      'All installments paid'
    );
  }

  successResponse(
    res,
    {
      nextDue: {
        installmentNumber: nextInstallment.installmentNumber,
        amount: nextInstallment.amount,
        dueDate: nextInstallment.dueDate,
        status: nextInstallment.status
      }
    },
    'Next due payment retrieved successfully'
  );
});

/*  
|--------------------------------------------------------------------------
|  ✅ NEW API: DAILY PENDING TRANSACTIONS
|--------------------------------------------------------------------------
|  @route GET /api/installment-payments/daily-pending
|  @desc  Get all payments that are DUE TODAY and still PENDING
|  @access Private
|--------------------------------------------------------------------------
*/
const getDailyPendingPayments = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const result = await paymentService.getDailyPendingPayments(userId);

  successResponse(
    res,
    result,
    'Daily pending installment payments retrieved successfully'
  );
});

/*
|--------------------------------------------------------------------------
|  ✅ NEW API: CREATE COMBINED RAZORPAY ORDER
|--------------------------------------------------------------------------
|  @route POST /api/installment-payments/create-combined-razorpay
|  @desc  Create Razorpay order for multiple installments
|  @access Private
|--------------------------------------------------------------------------
*/
const createCombinedRazorpayOrder = asyncHandler(async (req, res) => {
  const { selectedOrders } = req.body;
  const userId = req.user._id;

  // Validate selectedOrders
  if (!selectedOrders || !Array.isArray(selectedOrders) || selectedOrders.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'selectedOrders array is required and must contain at least one order'
    });
  }

  const razorpayOrder = await paymentService.createCombinedRazorpayOrder(
    userId,
    selectedOrders
  );

  successResponse(
    res,
    razorpayOrder,
    'Combined Razorpay order created successfully. Proceed with payment.',
    200
  );
});

/*
|--------------------------------------------------------------------------
|  ✅ NEW API: PROCESS MULTIPLE DAILY PAYMENTS
|--------------------------------------------------------------------------
|  @route POST /api/installment-payments/pay-daily-selected
|  @desc  Process daily payments for multiple orders in one transaction
|  @access Private
|--------------------------------------------------------------------------
*/
const processSelectedDailyPayments = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const {
    selectedOrders,
    paymentMethod,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  } = req.body;

  // Validation
  if (!selectedOrders || !Array.isArray(selectedOrders) || selectedOrders.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'selectedOrders array is required and must not be empty',
    });
  }

  if (!paymentMethod || !['RAZORPAY', 'WALLET'].includes(paymentMethod)) {
    return res.status(400).json({
      success: false,
      message: 'paymentMethod must be either RAZORPAY or WALLET',
    });
  }

  const paymentData = {
    userId,
    selectedOrders,
    paymentMethod,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  };

  const result = await paymentService.processSelectedDailyPayments(paymentData);

  const message = `Successfully processed ${result.ordersProcessed} order payment(s). Total amount: ₹${result.totalAmount}`;

  successResponse(res, result, message, 200);
});

module.exports = {
  createRazorpayOrder,
  processPayment,
  getPaymentHistory,
  getMyPayments,
  getPaymentStats,
  retryPayment,
  getNextDuePayment,
  getDailyPendingPayments,
  createCombinedRazorpayOrder, // ⭐ NEW
  processSelectedDailyPayments, // ⭐ NEW
};
