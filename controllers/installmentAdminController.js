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

  // Get active orders count
  const activeOrdersCount = await InstallmentOrder.countDocuments({
    status: 'ACTIVE'
  });

  // Get pending approval count
  const pendingApprovalCount = await InstallmentOrder.countDocuments({
    status: 'COMPLETED',
    deliveryStatus: 'PENDING'
  });

  const stats = {
    orders: {
      total: statusCounts.reduce((sum, s) => sum + s.count, 0),
      byStatus: statusCounts.reduce((obj, s) => {
        obj[s._id] = s.count;
        return obj;
      }, {}),
      active: activeOrdersCount,
      pendingApproval: pendingApprovalCount
    },
    deliveryStatus: deliveryStatusCounts.reduce((obj, s) => {
      obj[s._id] = s.count;
      return obj;
    }, {}),
    revenue: revenueStats[0] || {
      totalRevenue: 0,
      totalCommission: 0,
      totalPayments: 0
    },
    payments: {
      byMethod: paymentStats.reduce((obj, s) => {
        obj[s._id] = {
          count: s.count,
          totalAmount: s.totalAmount,
          totalCommission: s.totalCommission
        };
        return obj;
      }, {})
    }
  };

  successResponse(res, { stats }, 'Dashboard statistics retrieved successfully');
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

module.exports = {
  getCompletedOrders,
  approveDelivery,
  updateDeliveryStatus,
  getAllOrders,
  getOrderDetails,
  getDashboardStats,
  getPendingApprovalOrders,
  addAdminNotes,
  getAllPayments
};
