/**
 * Installment Admin Dashboard Controller
 *
 * Handles admin operations for installment orders.
 * All endpoints require admin role verification.
 */

const mongoose = require('mongoose');
const orderService = require('../services/installmentOrderService');
const paymentService = require('../services/installmentPaymentService');
const InstallmentOrder = require('../models/InstallmentOrder');
const PaymentRecord = require('../models/PaymentRecord');
const { asyncHandler, successResponse } = require('../middlewares/errorHandler');

/**
 * @route   GET /api/admin/installment-orders/completed
 * @desc    Get all completed orders (awaiting delivery approval)
 * @access  Private (Admin only)
 *
 * @query {
 *   deliveryStatus?: 'PENDING' | 'APPROVED' | 'SHIPPED' | 'DELIVERED',
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
const getCompletedOrders = asyncHandler(async (req, res) => {
  const { deliveryStatus, limit = 50, skip = 0, page } = req.query;

  // Calculate skip from page if provided
  const actualSkip = page ? (page - 1) * limit : skip;

  const options = {
    deliveryStatus,
    limit: Math.min(limit, 100), // Cap at 100
    skip: actualSkip
  };

  const orders = await orderService.getCompletedOrders(options);

  successResponse(res, {
    orders,
    count: orders.length,
    page: page || Math.floor(actualSkip / limit) + 1,
    limit
  }, 'Completed orders retrieved successfully');
});

/**
 * @route   POST /api/admin/installment-orders/:orderId/approve-delivery
 * @desc    Approve delivery for completed order
 * @access  Private (Admin only)
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: { order: object }
 * }
 */
const approveDelivery = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const adminId = req.user._id; // Admin ID from auth middleware

  const order = await orderService.approveDelivery(orderId, adminId);

  successResponse(res, { order }, 'Delivery approved successfully');
});

/**
 * @route   PUT /api/admin/installment-orders/:orderId/delivery-status
 * @desc    Update delivery status
 * @access  Private (Admin only)
 *
 * @body {
 *   status: 'PENDING' | 'APPROVED' | 'SHIPPED' | 'DELIVERED' (required)
 * }
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: { order: object }
 * }
 */
const updateDeliveryStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  const order = await orderService.updateDeliveryStatus(orderId, status);

  successResponse(res, { order }, `Delivery status updated to ${status}`);
});

/**
 * @route   GET /api/admin/installment-orders/all
 * @desc    Get all orders (with filters)
 * @access  Private (Admin only)
 *
 * @query {
 *   status?: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED',
 *   deliveryStatus?: string,
 *   limit?: number,
 *   skip?: number,
 *   page?: number
 * }
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: { orders: array, count: number }
 * }
 */
const getAllOrders = asyncHandler(async (req, res) => {
  const {
    status,
    deliveryStatus,
    limit = 50,
    skip = 0,
    page
  } = req.query;

  // Calculate skip from page if provided
  const actualSkip = page ? (page - 1) * limit : skip;

  const query = {};
  if (status) query.status = status;
  if (deliveryStatus) query.deliveryStatus = deliveryStatus;

  const orders = await InstallmentOrder.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 100))
    .skip(actualSkip)
    .populate('user', 'name email phoneNumber')
    .populate('product', 'name images pricing')
    .populate('referrer', 'name email');

  const totalCount = await InstallmentOrder.countDocuments(query);

  successResponse(res, {
    orders,
    count: orders.length,
    totalCount,
    page: page || Math.floor(actualSkip / limit) + 1,
    limit,
    hasMore: actualSkip + orders.length < totalCount
  }, 'Orders retrieved successfully');
});

/**
 * @route   GET /api/admin/installment-orders/:orderId
 * @desc    Get order details (admin view with full information)
 * @access  Private (Admin only)
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: { order: object, payments: array }
 * }
 */
const getOrderDetails = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  // Get order without user restriction
  const order = await orderService.getOrderById(orderId);

  if (!order) {
    throw new Error('Order not found');
  }

  // Get payment history for this order
  const payments = await paymentService.getPaymentHistory(orderId);

  successResponse(res, {
    order,
    payments
  }, 'Order details retrieved successfully');
});

/**
 * @route   GET /api/admin/installment-orders/dashboard/stats
 * @desc    Get dashboard statistics
 * @access  Private (Admin only)
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: { stats: object }
 * }
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  // Get order statistics
  const orderStats = await orderService.getOrderStats();

  // Get payment statistics
  const paymentStats = await paymentService.getPaymentStats();

  // Get counts by status
  const statusCounts = await InstallmentOrder.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  // Get delivery status counts
  const deliveryStatusCounts = await InstallmentOrder.aggregate([
    {
      $match: { status: 'COMPLETED' }
    },
    {
      $group: {
        _id: '$deliveryStatus',
        count: { $sum: 1 }
      }
    }
  ]);

  // Get total revenue and commission
  const revenueStats = await PaymentRecord.aggregate([
    {
      $match: { status: 'COMPLETED' }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' },
        totalCommission: { $sum: '$commissionAmount' },
        totalPayments: { $sum: 1 }
      }
    }
  ]);

  // Calculate date ranges
  const now = new Date();
  const startOfToday = new Date(now.setHours(0, 0, 0, 0));
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())); // Start of this week (Sunday)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get revenue for this month
  const monthRevenue = await PaymentRecord.aggregate([
    {
      $match: {
        status: 'COMPLETED',
        createdAt: { $gte: startOfMonth }
      }
    },
    {
      $group: {
        _id: null,
        amount: { $sum: '$amount' }
      }
    }
  ]);

  // Get revenue for this week
  const weekRevenue = await PaymentRecord.aggregate([
    {
      $match: {
        status: 'COMPLETED',
        createdAt: { $gte: startOfWeek }
      }
    },
    {
      $group: {
        _id: null,
        amount: { $sum: '$amount' }
      }
    }
  ]);

  // Get revenue for today
  const todayRevenue = await PaymentRecord.aggregate([
    {
      $match: {
        status: 'COMPLETED',
        createdAt: { $gte: startOfToday }
      }
    },
    {
      $group: {
        _id: null,
        amount: { $sum: '$amount' }
      }
    }
  ]);

  // Get payment counts and totals
  const paymentTotals = await PaymentRecord.aggregate([
    {
      $match: { status: 'COMPLETED' }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);

  // Get active orders count
  const activeOrdersCount = await InstallmentOrder.countDocuments({
    status: 'ACTIVE'
  });

  // Get completed orders count
  const completedOrdersCount = await InstallmentOrder.countDocuments({
    status: 'COMPLETED'
  });

  // Get cancelled orders count
  const cancelledOrdersCount = await InstallmentOrder.countDocuments({
    status: 'CANCELLED'
  });

  // Get pending delivery count
  const pendingDeliveryCount = await InstallmentOrder.countDocuments({
    status: 'COMPLETED',
    deliveryStatus: 'PENDING'
  });

  const stats = {
    orders: {
      total: statusCounts.reduce((sum, s) => sum + s.count, 0),
      active: activeOrdersCount,
      completed: completedOrdersCount,
      cancelled: cancelledOrdersCount,
      pendingDelivery: pendingDeliveryCount
    },
    payments: {
      total: paymentTotals[0]?.total || 0,
      totalAmount: paymentTotals[0]?.totalAmount || 0,
      todayAmount: todayRevenue[0]?.amount || 0
    },
    revenue: {
      total: revenueStats[0]?.totalRevenue || 0,
      thisMonth: monthRevenue[0]?.amount || 0,
      thisWeek: weekRevenue[0]?.amount || 0
    }
  };

  successResponse(res, stats, 'Dashboard statistics retrieved successfully');
});

/**
 * @route   GET /api/admin/installment-orders/pending-approval
 * @desc    Get orders pending delivery approval
 * @access  Private (Admin only)
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: { orders: array, count: number }
 * }
 */
const getPendingApprovalOrders = asyncHandler(async (req, res) => {
  const orders = await InstallmentOrder.find({
    status: 'COMPLETED',
    deliveryStatus: 'PENDING'
  })
  .sort({ completedAt: -1 })
  .populate('user', 'name email phoneNumber addresses')
  .populate('product', 'name images pricing');

  successResponse(res, {
    orders,
    count: orders.length
  }, 'Pending approval orders retrieved successfully');
});

/**
 * @route   PUT /api/admin/installment-orders/:orderId/notes
 * @desc    Add admin notes to order
 * @access  Private (Admin only)
 *
 * @body {
 *   notes: string (required)
 * }
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: { order: object }
 * }
 */
const addAdminNotes = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { notes } = req.body;

  // Validate ObjectId only if it looks like one (24 hex chars)
  // Otherwise, treat it as a custom order ID
  if (orderId.length === 24 && !mongoose.Types.ObjectId.isValid(orderId)) {
    throw new Error('Invalid order ID format');
  }

  const order = await InstallmentOrder.findOne({
    $or: [{ _id: orderId }, { orderId }]
  });

  if (!order) {
    throw new Error('Order not found');
  }

  order.adminNotes = notes;
  await order.save();

  successResponse(res, { order }, 'Admin notes added successfully');
});

/**
 * @route   GET /api/admin/installment-payments/all
 * @desc    Get all payments
 * @access  Private (Admin only)
 *
 * @query {
 *   status?: string,
 *   paymentMethod?: string,
 *   limit?: number,
 *   skip?: number
 * }
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: { payments: array, count: number }
 * }
 */
const getAllPayments = asyncHandler(async (req, res) => {
  const {
    status,
    paymentMethod,
    limit = 50,
    skip = 0,
    page
  } = req.query;

  const actualSkip = page ? (page - 1) * limit : skip;

  const query = {};
  if (status) query.status = status;
  if (paymentMethod) query.paymentMethod = paymentMethod;

  const payments = await PaymentRecord.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 100))
    .skip(actualSkip)
    .populate('user', 'name email')
    .populate('order', 'orderId productName');

  const totalCount = await PaymentRecord.countDocuments(query);

  successResponse(res, {
    payments,
    count: payments.length,
    totalCount,
    page: page || Math.floor(actualSkip / limit) + 1,
    limit,
    hasMore: actualSkip + payments.length < totalCount
  }, 'Payments retrieved successfully');
});

/**
 * @route   POST /api/admin/installments/adjust-payment-dates
 * @desc    Adjust payment due dates for testing (Admin only)
 * @access  Private (Admin only)
 *
 * @body {
 *   userId?: string (optional, adjusts all user's active orders),
 *   orderId?: string (optional, adjusts specific order),
 *   adjustDays: number (negative = move to past, 0 = today, positive = future)
 * }
 */
const adjustPaymentDates = asyncHandler(async (req, res) => {
  const { userId, orderId, adjustDays = -1 } = req.body;

  if (!userId && !orderId) {
    return res.status(400).json({
      success: false,
      message: 'Either userId or orderId is required'
    });
  }

  const query = { status: 'ACTIVE' };
  if (orderId) {
    query.orderId = orderId;
  } else if (userId) {
    query.user = userId;
  }

  const orders = await InstallmentOrder.find(query);

  if (orders.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'No active orders found'
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let totalUpdated = 0;
  let totalPendingAdjusted = 0;

  for (const order of orders) {
    let orderUpdated = false;

    for (let i = 0; i < order.paymentSchedule.length; i++) {
      const installment = order.paymentSchedule[i];

      if (installment.status === 'PENDING') {
        const newDate = new Date(today);
        newDate.setDate(newDate.getDate() + adjustDays);

        order.paymentSchedule[i].dueDate = newDate;
        orderUpdated = true;
        totalPendingAdjusted++;

        // Only adjust first 3 pending payments per order
        if (totalPendingAdjusted >= 3 * orders.length) break;
      }
    }

    if (orderUpdated) {
      await order.save();
      totalUpdated++;
    }
  }

  successResponse(res, {
    ordersUpdated: totalUpdated,
    paymentsAdjusted: totalPendingAdjusted,
    adjustedTo: adjustDays === 0 ? 'today' : adjustDays < 0 ? `${Math.abs(adjustDays)} day(s) ago` : `${adjustDays} day(s) from now`
  }, 'Payment dates adjusted successfully');
});

/**
 * @route   POST /api/installments/admin/orders/create-for-user
 * @desc    Admin creates installment order on behalf of a user
 * @access  Private (Admin only)
 *
 * @body {
 *   userId: string (required) - User's MongoDB ID
 *   productId: string (required) - Product ID
 *   totalDays: number (required) - Number of days for installment
 *   shippingAddress: object (required) - Shipping address
 *   paymentMethod?: string (optional) - 'WALLET' or 'RAZORPAY', default: 'WALLET'
 *   couponCode?: string (optional) - Coupon code to apply
 *   variantId?: string (optional) - Product variant ID
 *   autoPayFirstInstallment?: boolean (optional) - Auto mark first payment as done (default: true)
 * }
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: { order: object, firstPayment: object }
 * }
 */
const createOrderForUser = asyncHandler(async (req, res) => {
  const {
    userId,
    productId,
    totalDays,
    shippingAddress,
    paymentMethod = 'WALLET',
    couponCode,
    variantId,
    autoPayFirstInstallment = true
  } = req.body;

  const adminId = req.user._id;
  const adminEmail = req.user.email;

  // Validation
  if (!userId || !productId || !totalDays || !shippingAddress) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: userId, productId, totalDays, shippingAddress'
    });
  }

  console.log(`[Admin] ${adminEmail} creating order for user ${userId}`);

  // Prepare order data
  const orderData = {
    userId,
    productId,
    totalDays,
    shippingAddress,
    paymentMethod,
    couponCode,
    variantId,
    createdByAdmin: true,
    createdByAdminId: adminId,
    createdByAdminEmail: adminEmail
  };

  // Create order using the service
  const result = await orderService.createOrder(orderData);

  // If admin wants to auto-mark first payment as done
  if (autoPayFirstInstallment && result.firstPayment) {
    try {
      // Mark first payment as completed
      const firstPayment = result.firstPayment;
      await paymentService.markPaymentAsCompleted(
        firstPayment._id,
        {
          method: 'ADMIN_MARKED',
          transactionId: `ADMIN_${Date.now()}`,
          note: `Marked as paid by admin ${adminEmail}`,
          markedBy: adminId
        }
      );

      console.log(`[Admin] First payment marked as completed by ${adminEmail}`);
    } catch (error) {
      console.error('[Admin] Error marking first payment as completed:', error);
      // Continue anyway, order is created
    }
  }

  successResponse(res, {
    order: result.order,
    firstPayment: result.firstPayment,
    note: autoPayFirstInstallment ? 'Order created and first payment marked as completed' : 'Order created successfully'
  }, 'Order created successfully on behalf of user', 201);
});

/**
 * @route   POST /api/installments/admin/payments/:paymentId/mark-paid
 * @desc    Admin marks a payment as paid
 * @access  Private (Admin only)
 *
 * @body {
 *   transactionId?: string (optional) - Transaction reference
 *   note?: string (optional) - Admin note
 *   paymentMethod?: string (optional) - Payment method used
 * }
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: { payment: object }
 * }
 */
const markPaymentAsPaid = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const { transactionId, note, paymentMethod = 'ADMIN_MARKED' } = req.body;

  const adminId = req.user._id;
  const adminEmail = req.user.email;

  console.log(`[Admin] ${adminEmail} marking payment ${paymentId} as paid`);

  // Mark payment as completed
  const payment = await paymentService.markPaymentAsCompleted(
    paymentId,
    {
      method: paymentMethod,
      transactionId: transactionId || `ADMIN_${Date.now()}`,
      note: note || `Marked as paid by admin ${adminEmail}`,
      markedBy: adminId,
      markedByEmail: adminEmail
    }
  );

  successResponse(res, { payment }, 'Payment marked as paid successfully');
});

/**
 * @route   POST /api/installments/admin/orders/:orderId/mark-all-paid
 * @desc    Admin marks all pending payments for an order as paid
 * @access  Private (Admin only)
 *
 * @body {
 *   note?: string (optional) - Admin note
 * }
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: { order: object, paymentsMarked: number }
 * }
 */
const markAllPaymentsAsPaid = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { note } = req.body;

  const adminId = req.user._id;
  const adminEmail = req.user.email;

  console.log(`[Admin] ${adminEmail} marking all payments as paid for order ${orderId}`);

  // Get order
  const order = await InstallmentOrder.findById(orderId);
  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }

  // Get all pending payments
  const pendingPayments = await PaymentRecord.find({
    order: orderId,
    status: 'PENDING'
  });

  let markedCount = 0;

  // Mark each pending payment as completed
  for (const payment of pendingPayments) {
    try {
      await paymentService.markPaymentAsCompleted(
        payment._id,
        {
          method: 'ADMIN_MARKED',
          transactionId: `ADMIN_BULK_${Date.now()}_${markedCount}`,
          note: note || `Bulk marked as paid by admin ${adminEmail}`,
          markedBy: adminId,
          markedByEmail: adminEmail
        }
      );
      markedCount++;
    } catch (error) {
      console.error(`[Admin] Error marking payment ${payment._id}:`, error);
    }
  }

  // Refresh order
  const updatedOrder = await InstallmentOrder.findById(orderId)
    .populate('user', 'name email phoneNumber')
    .populate('product', 'name images pricing');

  successResponse(res, {
    order: updatedOrder,
    paymentsMarked: markedCount,
    totalPending: pendingPayments.length
  }, `Successfully marked ${markedCount} payment(s) as paid`);
});

/**
 * @route   POST /api/installments/admin/payments/:paymentId/cancel
 * @desc    Admin cancels/reverses a payment
 * @access  Private (Admin only)
 *
 * @body {
 *   reason: string (required) - Reason for cancellation
 * }
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: { payment: object }
 * }
 */
const cancelPayment = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const { reason } = req.body;

  const adminId = req.user._id;
  const adminEmail = req.user.email;

  if (!reason) {
    return res.status(400).json({
      success: false,
      message: 'Cancellation reason is required'
    });
  }

  console.log(`[Admin] ${adminEmail} cancelling payment ${paymentId}`);

  // Get payment
  const payment = await PaymentRecord.findById(paymentId);
  if (!payment) {
    return res.status(404).json({
      success: false,
      message: 'Payment not found'
    });
  }

  // Update payment status
  payment.status = 'CANCELLED';
  payment.cancelledBy = adminId;
  payment.cancelledByEmail = adminEmail;
  payment.cancellationReason = reason;
  payment.cancelledAt = new Date();
  await payment.save();

  successResponse(res, { payment }, 'Payment cancelled successfully');
});

// ============================================
// ANALYTICS APIs - Derived Order Completion Metadata
// ============================================

/**
 * Helper function to calculate completion bucket
 * @param {Date} lastDueDate - Last due date of the order
 * @param {string} status - Order status
 * @returns {string} Completion bucket category
 */
const getCompletionBucket = (lastDueDate, status) => {
  if (status === 'COMPLETED') return 'completed';
  if (status === 'CANCELLED') return 'cancelled';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(lastDueDate);
  dueDate.setHours(0, 0, 0, 0);

  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'due-today';
  if (diffDays <= 7) return '1-7-days';
  if (diffDays <= 30) return '8-30-days';
  return '30+-days';
};

/**
 * Helper function to derive order completion metadata
 * @param {Object} order - InstallmentOrder document
 * @returns {Object} Derived metadata
 */
const deriveOrderMetadata = (order) => {
  const pendingInstallments = order.paymentSchedule.filter(p => p.status === 'PENDING');
  const remainingInstallments = pendingInstallments.length;

  // Get last due date (last item in payment schedule)
  const lastDueDate = order.paymentSchedule.length > 0
    ? order.paymentSchedule[order.paymentSchedule.length - 1].dueDate
    : null;

  // Calculate days to complete
  let daysToComplete = null;
  if (lastDueDate && order.status !== 'COMPLETED' && order.status !== 'CANCELLED') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(lastDueDate);
    dueDate.setHours(0, 0, 0, 0);
    daysToComplete = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Calculate progress percentage
  const progressPercentage = order.productPrice > 0
    ? Math.round((order.totalPaidAmount / order.productPrice) * 100)
    : 0;

  // Get completion bucket
  const completionBucket = getCompletionBucket(lastDueDate, order.status);

  // Calculate remaining amount
  const remainingAmount = order.productPrice - order.totalPaidAmount;

  return {
    remainingInstallments,
    lastDueDate,
    daysToComplete,
    completionBucket,
    progressPercentage,
    remainingAmount,
    paidInstallments: order.paidInstallments || 0,
    totalInstallments: order.paymentSchedule.length
  };
};

/**
 * @route   GET /api/installments/admin/analytics/orders
 * @desc    Get orders with derived completion metadata
 * @access  Private (Admin only)
 *
 * @query {
 *   status?: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED',
 *   completionBucket?: 'overdue' | 'due-today' | '1-7-days' | '8-30-days' | '30+-days' | 'completed' | 'cancelled',
 *   limit?: number (default: 50, max: 100),
 *   page?: number (default: 1),
 *   sortBy?: 'daysToComplete' | 'progressPercentage' | 'remainingAmount' | 'createdAt' (default: createdAt),
 *   sortOrder?: 'asc' | 'desc' (default: desc)
 * }
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: {
 *     orders: array (with derived metadata),
 *     totalCount: number,
 *     page: number,
 *     hasMore: boolean
 *   }
 * }
 */
const getOrdersWithMetadata = asyncHandler(async (req, res) => {
  const {
    status,
    completionBucket,
    limit = 50,
    page = 1,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const actualLimit = Math.min(parseInt(limit), 100);
  const actualPage = parseInt(page);
  const skip = (actualPage - 1) * actualLimit;

  // Build query
  const query = {};
  if (status) query.status = status;

  // Get orders
  let orders = await InstallmentOrder.find(query)
    .sort({ [sortBy === 'createdAt' ? 'createdAt' : 'createdAt']: sortOrder === 'asc' ? 1 : -1 })
    .populate('user', 'name email phoneNumber')
    .populate('product', 'name images pricing')
    .populate('referrer', 'name email')
    .lean();

  // Add derived metadata to each order
  orders = orders.map(order => ({
    ...order,
    metadata: deriveOrderMetadata(order)
  }));

  // Filter by completion bucket if specified
  if (completionBucket) {
    orders = orders.filter(order => order.metadata.completionBucket === completionBucket);
  }

  // Sort by derived fields if needed
  if (sortBy === 'daysToComplete') {
    orders.sort((a, b) => {
      const aVal = a.metadata.daysToComplete ?? Infinity;
      const bVal = b.metadata.daysToComplete ?? Infinity;
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
  } else if (sortBy === 'progressPercentage') {
    orders.sort((a, b) => {
      return sortOrder === 'asc'
        ? a.metadata.progressPercentage - b.metadata.progressPercentage
        : b.metadata.progressPercentage - a.metadata.progressPercentage;
    });
  } else if (sortBy === 'remainingAmount') {
    orders.sort((a, b) => {
      return sortOrder === 'asc'
        ? a.metadata.remainingAmount - b.metadata.remainingAmount
        : b.metadata.remainingAmount - a.metadata.remainingAmount;
    });
  }

  const totalCount = orders.length;

  // Apply pagination after filtering
  const paginatedOrders = orders.slice(skip, skip + actualLimit);

  successResponse(res, {
    orders: paginatedOrders,
    totalCount,
    page: actualPage,
    limit: actualLimit,
    hasMore: skip + paginatedOrders.length < totalCount
  }, 'Orders with metadata retrieved successfully');
});

/**
 * @route   GET /api/installments/admin/analytics/completion-buckets
 * @desc    Get aggregated completion bucket summary
 * @access  Private (Admin only)
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: {
 *     buckets: {
 *       overdue: { count, totalRemainingAmount },
 *       'due-today': { count, totalRemainingAmount },
 *       '1-7-days': { count, totalRemainingAmount },
 *       '8-30-days': { count, totalRemainingAmount },
 *       '30+-days': { count, totalRemainingAmount },
 *       completed: { count, totalRevenue },
 *       cancelled: { count }
 *     },
 *     summary: { totalActive, totalCompleted, totalCancelled }
 *   }
 * }
 */
const getCompletionBucketsSummary = asyncHandler(async (req, res) => {
  // Get all orders
  const orders = await InstallmentOrder.find({}).lean();

  // Initialize buckets
  const buckets = {
    'overdue': { count: 0, totalRemainingAmount: 0, orderIds: [] },
    'due-today': { count: 0, totalRemainingAmount: 0, orderIds: [] },
    '1-7-days': { count: 0, totalRemainingAmount: 0, orderIds: [] },
    '8-30-days': { count: 0, totalRemainingAmount: 0, orderIds: [] },
    '30+-days': { count: 0, totalRemainingAmount: 0, orderIds: [] },
    'completed': { count: 0, totalRevenue: 0 },
    'cancelled': { count: 0 }
  };

  // Process each order
  for (const order of orders) {
    const metadata = deriveOrderMetadata(order);
    const bucket = metadata.completionBucket;

    if (buckets[bucket]) {
      buckets[bucket].count++;

      if (bucket === 'completed') {
        buckets[bucket].totalRevenue += order.totalPaidAmount || 0;
      } else if (bucket !== 'cancelled') {
        buckets[bucket].totalRemainingAmount += metadata.remainingAmount || 0;
      }
    }
  }

  // Remove orderIds from response (only used for debugging)
  Object.keys(buckets).forEach(key => {
    delete buckets[key].orderIds;
  });

  const summary = {
    totalActive: buckets['overdue'].count + buckets['due-today'].count +
                 buckets['1-7-days'].count + buckets['8-30-days'].count +
                 buckets['30+-days'].count,
    totalCompleted: buckets['completed'].count,
    totalCancelled: buckets['cancelled'].count,
    totalOrders: orders.length
  };

  successResponse(res, {
    buckets,
    summary
  }, 'Completion buckets summary retrieved successfully');
});

/**
 * @route   GET /api/installments/admin/analytics/revenue
 * @desc    Get revenue by date range
 * @access  Private (Admin only)
 *
 * @query {
 *   startDate: string (required) - ISO date string,
 *   endDate: string (required) - ISO date string,
 *   groupBy?: 'day' | 'week' | 'month' (default: day)
 * }
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: {
 *     totalRevenue: number,
 *     totalPayments: number,
 *     averagePayment: number,
 *     revenueByPeriod: array
 *   }
 * }
 */
const getRevenueByDateRange = asyncHandler(async (req, res) => {
  const { startDate, endDate, groupBy = 'day' } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      message: 'startDate and endDate are required'
    });
  }

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // Validate dates
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({
      success: false,
      message: 'Invalid date format. Use ISO date string (YYYY-MM-DD)'
    });
  }

  // Build aggregation pipeline based on groupBy
  let dateFormat;
  switch (groupBy) {
    case 'week':
      dateFormat = { $isoWeek: '$completedAt' };
      break;
    case 'month':
      dateFormat = { $month: '$completedAt' };
      break;
    default: // day
      dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } };
  }

  // Get revenue grouped by period
  const revenueByPeriod = await PaymentRecord.aggregate([
    {
      $match: {
        status: 'COMPLETED',
        completedAt: { $gte: start, $lte: end }
      }
    },
    {
      $group: {
        _id: groupBy === 'day'
          ? { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } }
          : groupBy === 'week'
            ? { year: { $isoWeekYear: '$completedAt' }, week: { $isoWeek: '$completedAt' } }
            : { year: { $year: '$completedAt' }, month: { $month: '$completedAt' } },
        revenue: { $sum: '$amount' },
        paymentCount: { $sum: 1 },
        commissionPaid: { $sum: '$commissionAmount' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Get totals
  const totals = await PaymentRecord.aggregate([
    {
      $match: {
        status: 'COMPLETED',
        completedAt: { $gte: start, $lte: end }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' },
        totalPayments: { $sum: 1 },
        totalCommission: { $sum: '$commissionAmount' }
      }
    }
  ]);

  const totalData = totals[0] || { totalRevenue: 0, totalPayments: 0, totalCommission: 0 };
  const averagePayment = totalData.totalPayments > 0
    ? Math.round(totalData.totalRevenue / totalData.totalPayments)
    : 0;

  // Format revenue by period for better readability
  const formattedRevenueByPeriod = revenueByPeriod.map(item => {
    let period;
    if (groupBy === 'day') {
      period = item._id;
    } else if (groupBy === 'week') {
      period = `${item._id.year}-W${item._id.week}`;
    } else {
      period = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
    }

    return {
      period,
      revenue: item.revenue,
      paymentCount: item.paymentCount,
      commissionPaid: item.commissionPaid || 0
    };
  });

  successResponse(res, {
    dateRange: { startDate: start, endDate: end },
    groupBy,
    totalRevenue: totalData.totalRevenue,
    totalPayments: totalData.totalPayments,
    totalCommission: totalData.totalCommission,
    averagePayment,
    revenueByPeriod: formattedRevenueByPeriod
  }, 'Revenue data retrieved successfully');
});

/**
 * @route   GET /api/installments/admin/analytics/orders/:orderId/metadata
 * @desc    Get derived metadata for a single order
 * @access  Private (Admin only)
 *
 * @returns {
 *   success: true,
 *   message: string,
 *   data: { order, metadata }
 * }
 */
const getOrderMetadata = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await InstallmentOrder.findOne({
    $or: [{ _id: orderId }, { orderId }]
  })
  .populate('user', 'name email phoneNumber')
  .populate('product', 'name images pricing')
  .populate('referrer', 'name email')
  .lean();

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }

  const metadata = deriveOrderMetadata(order);

  successResponse(res, {
    order,
    metadata
  }, 'Order metadata retrieved successfully');
});

module.exports = {
  getCompletedOrders,
  approveDelivery,
  updateDeliveryStatus,
  getAllOrders,
  getOrderDetails,
  getDashboardStats,
  getPendingApprovalOrders,
  addAdminNotes,
  getAllPayments,
  adjustPaymentDates,
  createOrderForUser,
  markPaymentAsPaid,
  markAllPaymentsAsPaid,
  cancelPayment,
  // Analytics APIs
  getOrdersWithMetadata,
  getCompletionBucketsSummary,
  getRevenueByDateRange,
  getOrderMetadata
};
