/**
 * Installment Admin Dashboard Controller
 *
 * Handles admin operations for installment orders.
 * All endpoints require admin role verification.
 */

const mongoose = require("mongoose");
const orderService = require("../services/installmentOrderService");
const paymentService = require("../services/installmentPaymentService");
const InstallmentOrder = require("../models/InstallmentOrder");
const PaymentRecord = require("../models/PaymentRecord");
const {
  asyncHandler,
  successResponse,
} = require("../middlewares/errorHandler");

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
    skip: actualSkip,
  };

  const orders = await orderService.getCompletedOrders(options);

  successResponse(
    res,
    {
      orders,
      count: orders.length,
      page: page || Math.floor(actualSkip / limit) + 1,
      limit,
    },
    "Completed orders retrieved successfully"
  );
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

  successResponse(res, { order }, "Delivery approved successfully");
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
  const { status, deliveryStatus, limit = 50, skip = 0, page } = req.query;

  // Calculate skip from page if provided
  const actualSkip = page ? (page - 1) * limit : skip;

  const query = {};
  if (status) query.status = status;
  if (deliveryStatus) query.deliveryStatus = deliveryStatus;

  const orders = await InstallmentOrder.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 100))
    .skip(actualSkip)
    .populate("user", "name email phoneNumber")
    .populate("product", "name images pricing")
    .populate("referrer", "name email");

  const totalCount = await InstallmentOrder.countDocuments(query);

  successResponse(
    res,
    {
      orders,
      count: orders.length,
      totalCount,
      page: page || Math.floor(actualSkip / limit) + 1,
      limit,
      hasMore: actualSkip + orders.length < totalCount,
    },
    "Orders retrieved successfully"
  );
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
    throw new Error("Order not found");
  }

  // Get payment history for this order
  const payments = await paymentService.getPaymentHistory(orderId);

  successResponse(
    res,
    {
      order,
      payments,
    },
    "Order details retrieved successfully"
  );
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
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  // Get delivery status counts
  const deliveryStatusCounts = await InstallmentOrder.aggregate([
    {
      $match: { status: "COMPLETED" },
    },
    {
      $group: {
        _id: "$deliveryStatus",
        count: { $sum: 1 },
      },
    },
  ]);

  // Get total revenue and commission
  const revenueStats = await PaymentRecord.aggregate([
    {
      $match: { status: "COMPLETED" },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$amount" },
        totalCommission: { $sum: "$commissionAmount" },
        totalPayments: { $sum: 1 },
      },
    },
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
        status: "COMPLETED",
        createdAt: { $gte: startOfMonth },
      },
    },
    {
      $group: {
        _id: null,
        amount: { $sum: "$amount" },
      },
    },
  ]);

  // Get revenue for this week
  const weekRevenue = await PaymentRecord.aggregate([
    {
      $match: {
        status: "COMPLETED",
        createdAt: { $gte: startOfWeek },
      },
    },
    {
      $group: {
        _id: null,
        amount: { $sum: "$amount" },
      },
    },
  ]);

  // Get revenue for today
  const todayRevenue = await PaymentRecord.aggregate([
    {
      $match: {
        status: "COMPLETED",
        createdAt: { $gte: startOfToday },
      },
    },
    {
      $group: {
        _id: null,
        amount: { $sum: "$amount" },
      },
    },
  ]);

  // Get payment counts and totals
  const paymentTotals = await PaymentRecord.aggregate([
    {
      $match: { status: "COMPLETED" },
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
      },
    },
  ]);

  // Get active orders count
  const activeOrdersCount = await InstallmentOrder.countDocuments({
    status: "ACTIVE",
  });

  // Get completed orders count
  const completedOrdersCount = await InstallmentOrder.countDocuments({
    status: "COMPLETED",
  });

  // Get cancelled orders count
  const cancelledOrdersCount = await InstallmentOrder.countDocuments({
    status: "CANCELLED",
  });

  // Get pending delivery count
  const pendingDeliveryCount = await InstallmentOrder.countDocuments({
    status: "COMPLETED",
    deliveryStatus: "PENDING",
  });

  const stats = {
    orders: {
      total: statusCounts.reduce((sum, s) => sum + s.count, 0),
      active: activeOrdersCount,
      completed: completedOrdersCount,
      cancelled: cancelledOrdersCount,
      pendingDelivery: pendingDeliveryCount,
    },
    payments: {
      total: paymentTotals[0]?.total || 0,
      totalAmount: paymentTotals[0]?.totalAmount || 0,
      todayAmount: todayRevenue[0]?.amount || 0,
    },
    revenue: {
      total: revenueStats[0]?.totalRevenue || 0,
      thisMonth: monthRevenue[0]?.amount || 0,
      thisWeek: weekRevenue[0]?.amount || 0,
    },
  };

  successResponse(res, stats, "Dashboard statistics retrieved successfully");
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
    status: "COMPLETED",
    deliveryStatus: "PENDING",
  })
    .sort({ completedAt: -1 })
    .populate("user", "name email phoneNumber addresses")
    .populate("product", "name images pricing");

  successResponse(
    res,
    {
      orders,
      count: orders.length,
    },
    "Pending approval orders retrieved successfully"
  );
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
    throw new Error("Invalid order ID format");
  }

  const order = await InstallmentOrder.findOne({
    $or: [{ _id: orderId }, { orderId }],
  });

  if (!order) {
    throw new Error("Order not found");
  }

  order.adminNotes = notes;
  await order.save();

  successResponse(res, { order }, "Admin notes added successfully");
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
  const { status, paymentMethod, limit = 50, skip = 0, page } = req.query;

  const actualSkip = page ? (page - 1) * limit : skip;

  const query = {};
  if (status) query.status = status;
  if (paymentMethod) query.paymentMethod = paymentMethod;

  const payments = await PaymentRecord.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 100))
    .skip(actualSkip)
    .populate("user", "name email")
    .populate("order", "orderId productName");

  const totalCount = await PaymentRecord.countDocuments(query);

  successResponse(
    res,
    {
      payments,
      count: payments.length,
      totalCount,
      page: page || Math.floor(actualSkip / limit) + 1,
      limit,
      hasMore: actualSkip + payments.length < totalCount,
    },
    "Payments retrieved successfully"
  );
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
      message: "Either userId or orderId is required",
    });
  }

  const query = { status: "ACTIVE" };
  if (orderId) {
    query.orderId = orderId;
  } else if (userId) {
    query.user = userId;
  }

  const orders = await InstallmentOrder.find(query);

  if (orders.length === 0) {
    return res.status(404).json({
      success: false,
      message: "No active orders found",
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

      if (installment.status === "PENDING") {
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

  successResponse(
    res,
    {
      ordersUpdated: totalUpdated,
      paymentsAdjusted: totalPendingAdjusted,
      adjustedTo:
        adjustDays === 0
          ? "today"
          : adjustDays < 0
          ? `${Math.abs(adjustDays)} day(s) ago`
          : `${adjustDays} day(s) from now`,
    },
    "Payment dates adjusted successfully"
  );
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
    paymentMethod = "WALLET",
    couponCode,
    variantId,
    autoPayFirstInstallment = true,
  } = req.body;

  const adminId = req.user._id;
  const adminEmail = req.user.email;

  // Validation
  if (!userId || !productId || !totalDays || !shippingAddress) {
    return res.status(400).json({
      success: false,
      message:
        "Missing required fields: userId, productId, totalDays, shippingAddress",
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
    createdByAdminEmail: adminEmail,
  };

  // Create order using the service
  const result = await orderService.createOrder(orderData);

  // If admin wants to auto-mark first payment as done
  if (autoPayFirstInstallment && result.firstPayment) {
    try {
      // Mark first payment as completed
      const firstPayment = result.firstPayment;
      await paymentService.markPaymentAsCompleted(firstPayment._id, {
        method: "ADMIN_MARKED",
        transactionId: `ADMIN_${Date.now()}`,
        note: `Marked as paid by admin ${adminEmail}`,
        markedBy: adminId,
      });

      console.log(`[Admin] First payment marked as completed by ${adminEmail}`);
    } catch (error) {
      console.error("[Admin] Error marking first payment as completed:", error);
      // Continue anyway, order is created
    }
  }

  successResponse(
    res,
    {
      order: result.order,
      firstPayment: result.firstPayment,
      note: autoPayFirstInstallment
        ? "Order created and first payment marked as completed"
        : "Order created successfully",
    },
    "Order created successfully on behalf of user",
    201
  );
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
  const { transactionId, note, paymentMethod = "ADMIN_MARKED" } = req.body;

  const adminId = req.user._id;
  const adminEmail = req.user.email;

  console.log(`[Admin] ${adminEmail} marking payment ${paymentId} as paid`);

  // Mark payment as completed
  const payment = await paymentService.markPaymentAsCompleted(paymentId, {
    method: paymentMethod,
    transactionId: transactionId || `ADMIN_${Date.now()}`,
    note: note || `Marked as paid by admin ${adminEmail}`,
    markedBy: adminId,
    markedByEmail: adminEmail,
  });

  successResponse(res, { payment }, "Payment marked as paid successfully");
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

  console.log(
    `[Admin] ${adminEmail} marking all payments as paid for order ${orderId}`
  );

  // Get order
  const order = await InstallmentOrder.findById(orderId);
  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  // Get all pending PaymentRecord documents
  const pendingPayments = await PaymentRecord.find({
    order: orderId,
    status: "PENDING",
  });

  let markedCount = 0;

  // Mark each existing pending PaymentRecord as completed
  for (const payment of pendingPayments) {
    try {
      await paymentService.markPaymentAsCompleted(payment._id, {
        method: "ADMIN_MARKED",
        transactionId: `ADMIN_BULK_${Date.now()}_${markedCount}`,
        note: note || `Bulk marked as paid by admin ${adminEmail}`,
        markedBy: adminId,
        markedByEmail: adminEmail,
      });
      markedCount++;
    } catch (error) {
      console.error(`[Admin] Error marking payment ${payment._id}:`, error);
    }
  }

  // Handle installments in paymentSchedule that have no PaymentRecord yet
  const existingPaymentNums = await PaymentRecord.find(
    { order: orderId },
    { installmentNumber: 1 }
  );
  const existingNums = new Set(existingPaymentNums.map((p) => p.installmentNumber));

  const pendingScheduleItems = (order.paymentSchedule || []).filter(
    (item) =>
      item.status !== "COMPLETED" &&
      item.status !== "PAID" &&
      !existingNums.has(item.installmentNumber)
  );

  for (const item of pendingScheduleItems) {
    try {
      const now = new Date();
      const paymentRecord = new PaymentRecord({
        order: order._id,
        user: order.user,
        amount: item.amount || order.dailyPaymentAmount,
        installmentNumber: item.installmentNumber,
        paymentMethod: "ADMIN_MARKED",
        status: "COMPLETED",
        processedAt: now,
        completedAt: now,
        paidAt: now,
        adminMarked: true,
        markedBy: adminId,
        markedByEmail: adminEmail,
        adminNote:
          note || `Bulk marked as paid by admin ${adminEmail}`,
        transactionId: `ADMIN_BULK_${Date.now()}_${markedCount}`,
      });
      await paymentRecord.save();

      // Update the paymentSchedule entry on the order
      const scheduleIndex = order.paymentSchedule.findIndex(
        (p) => p.installmentNumber === item.installmentNumber
      );
      if (scheduleIndex !== -1) {
        order.paymentSchedule[scheduleIndex].status = "COMPLETED";
        order.paymentSchedule[scheduleIndex].paidDate = now;
        order.paymentSchedule[scheduleIndex].paymentId = paymentRecord._id;
        order.paymentSchedule[scheduleIndex].transactionId =
          paymentRecord.transactionId;
      }

      markedCount++;
    } catch (error) {
      console.error(
        `[Admin] Error creating payment for installment ${item.installmentNumber}:`,
        error
      );
    }
  }

  // Update order totals if we marked any schedule-only installments
  if (pendingScheduleItems.length > 0) {
    const allPayments = await PaymentRecord.find({
      order: orderId,
      status: "COMPLETED",
    });
    order.paidInstallments = allPayments.length;
    order.totalPaidAmount = allPayments.reduce((sum, p) => sum + p.amount, 0);
    order.remainingAmount = Math.max(
      0,
      order.productPrice - order.totalPaidAmount
    );
    order.lastPaymentDate = new Date();

    // Check if order is fully paid
    if (order.paidInstallments >= order.totalDays || order.remainingAmount <= 0) {
      order.status = "COMPLETED";
      order.completedAt = new Date();
      console.log(`[Admin] Order ${order.orderId} marked as COMPLETED`);
    }

    await order.save();
  }

  // Refresh order
  const updatedOrder = await InstallmentOrder.findById(orderId)
    .populate("user", "name email phoneNumber")
    .populate("product", "name images pricing");

  successResponse(
    res,
    {
      order: updatedOrder,
      paymentsMarked: markedCount,
      totalPending: pendingPayments.length + pendingScheduleItems.length,
    },
    `Successfully marked ${markedCount} payment(s) as paid`
  );
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
      message: "Cancellation reason is required",
    });
  }

  console.log(`[Admin] ${adminEmail} cancelling payment ${paymentId}`);

  // Get payment
  const payment = await PaymentRecord.findById(paymentId);
  if (!payment) {
    return res.status(404).json({
      success: false,
      message: "Payment not found",
    });
  }

  // Update payment status
  payment.status = "CANCELLED";
  payment.cancelledBy = adminId;
  payment.cancelledByEmail = adminEmail;
  payment.cancellationReason = reason;
  payment.cancelledAt = new Date();
  await payment.save();

  successResponse(res, { payment }, "Payment cancelled successfully");
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
  if (status === "COMPLETED") return "completed";
  if (status === "CANCELLED") return "cancelled";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(lastDueDate);
  dueDate.setHours(0, 0, 0, 0);

  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "due-today";
  if (diffDays <= 7) return "1-7-days";
  if (diffDays <= 30) return "8-30-days";
  return "30+-days";
};

/**
 * Helper function to derive order completion metadata
 * @param {Object} order - InstallmentOrder document
 * @returns {Object} Derived metadata
 */
const deriveOrderMetadata = (order) => {
  // Only installments that actually require payment
  const payableSchedule = order.paymentSchedule.filter((i) => i.amount > 0);

  const pendingPayable = payableSchedule.filter((i) => i.status === "PENDING");

  const remainingInstallments = pendingPayable.length;

  // Last payable due date determines completion timing
  const lastDueDate =
    pendingPayable.length > 0
      ? pendingPayable[pendingPayable.length - 1].dueDate
      : null;

  // Days left to complete (only if not effectively completed/cancelled)
  let daysToComplete = null;
  if (lastDueDate && order.status !== "CANCELLED") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(lastDueDate);
    dueDate.setHours(0, 0, 0, 0);

    daysToComplete = Math.ceil(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  // Progress based on money (not installment count)
  const progressPercentage =
    order.productPrice > 0
      ? Math.round((order.totalPaidAmount / order.productPrice) * 100)
      : 0;

  // 🔑 Effective status derived from schedule, not stored field
  const effectiveStatus =
    pendingPayable.length === 0 ? "COMPLETED" : order.status;

  const completionBucket = getCompletionBucket(lastDueDate, effectiveStatus);

  const remainingAmount = Math.max(
    0,
    order.productPrice - order.totalPaidAmount
  );

  return {
    remainingInstallments,
    lastDueDate,
    daysToComplete,
    completionBucket,
    progressPercentage,
    remainingAmount,
    paidInstallments: order.paidInstallments || 0, // kept for backward compatibility
    totalInstallments: order.paymentSchedule.length,
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
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  const actualLimit = Math.min(parseInt(limit), 100);
  const actualPage = parseInt(page);
  const skip = (actualPage - 1) * actualLimit;

  // Build query
  const query = {};
  if (status) query.status = status;

  // Get orders
  let orders = await InstallmentOrder.find(query)
    .sort({
      [sortBy === "createdAt" ? "createdAt" : "createdAt"]:
        sortOrder === "asc" ? 1 : -1,
    })
    .populate("user", "name email phoneNumber")
    .populate("product", "name images pricing")
    .populate("referrer", "name email")
    .lean();

  // Add derived metadata to each order
  orders = orders.map((order) => ({
    ...order,
    metadata: deriveOrderMetadata(order),
  }));

  // Filter by completion bucket if specified
  if (completionBucket) {
    orders = orders.filter(
      (order) => order.metadata.completionBucket === completionBucket
    );
  }

  // Sort by derived fields if needed
  if (sortBy === "daysToComplete") {
    orders.sort((a, b) => {
      const aVal = a.metadata.daysToComplete ?? Infinity;
      const bVal = b.metadata.daysToComplete ?? Infinity;
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    });
  } else if (sortBy === "progressPercentage") {
    orders.sort((a, b) => {
      return sortOrder === "asc"
        ? a.metadata.progressPercentage - b.metadata.progressPercentage
        : b.metadata.progressPercentage - a.metadata.progressPercentage;
    });
  } else if (sortBy === "remainingAmount") {
    orders.sort((a, b) => {
      return sortOrder === "asc"
        ? a.metadata.remainingAmount - b.metadata.remainingAmount
        : b.metadata.remainingAmount - a.metadata.remainingAmount;
    });
  }

  const totalCount = orders.length;

  // Apply pagination after filtering
  const paginatedOrders = orders.slice(skip, skip + actualLimit);

  successResponse(
    res,
    {
      orders: paginatedOrders,
      totalCount,
      page: actualPage,
      limit: actualLimit,
      hasMore: skip + paginatedOrders.length < totalCount,
    },
    "Orders with metadata retrieved successfully"
  );
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
    overdue: { count: 0, totalRemainingAmount: 0, orderIds: [] },
    "due-today": { count: 0, totalRemainingAmount: 0, orderIds: [] },
    "1-7-days": { count: 0, totalRemainingAmount: 0, orderIds: [] },
    "8-30-days": { count: 0, totalRemainingAmount: 0, orderIds: [] },
    "30+-days": { count: 0, totalRemainingAmount: 0, orderIds: [] },
    completed: { count: 0, totalRevenue: 0 },
    cancelled: { count: 0 },
  };

  // Process each order
  for (const order of orders) {
    const metadata = deriveOrderMetadata(order);
    const bucket = metadata.completionBucket;

    if (buckets[bucket]) {
      buckets[bucket].count++;

      if (bucket === "completed") {
        buckets[bucket].totalRevenue += order.totalPaidAmount || 0;
      } else if (bucket !== "cancelled") {
        buckets[bucket].totalRemainingAmount += metadata.remainingAmount || 0;
      }
    }
  }

  // Remove orderIds from response (only used for debugging)
  Object.keys(buckets).forEach((key) => {
    delete buckets[key].orderIds;
  });

  const summary = {
    totalActive:
      buckets["overdue"].count +
      buckets["due-today"].count +
      buckets["1-7-days"].count +
      buckets["8-30-days"].count +
      buckets["30+-days"].count,
    totalCompleted: buckets["completed"].count,
    totalCancelled: buckets["cancelled"].count,
    totalOrders: orders.length,
  };

  successResponse(
    res,
    {
      buckets,
      summary,
    },
    "Completion buckets summary retrieved successfully"
  );
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
  const { startDate, endDate, groupBy = "day" } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      message: "startDate and endDate are required",
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
      message: "Invalid date format. Use ISO date string (YYYY-MM-DD)",
    });
  }

  // Build aggregation pipeline based on groupBy
  let dateFormat;
  switch (groupBy) {
    case "week":
      dateFormat = { $isoWeek: "$completedAt" };
      break;
    case "month":
      dateFormat = { $month: "$completedAt" };
      break;
    default: // day
      dateFormat = {
        $dateToString: { format: "%Y-%m-%d", date: "$completedAt" },
      };
  }

  // Get revenue grouped by period
  const revenueByPeriod = await PaymentRecord.aggregate([
    {
      $match: {
        status: "COMPLETED",
        completedAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id:
          groupBy === "day"
            ? { $dateToString: { format: "%Y-%m-%d", date: "$completedAt" } }
            : groupBy === "week"
            ? {
                year: { $isoWeekYear: "$completedAt" },
                week: { $isoWeek: "$completedAt" },
              }
            : {
                year: { $year: "$completedAt" },
                month: { $month: "$completedAt" },
              },
        revenue: { $sum: "$amount" },
        paymentCount: { $sum: 1 },
        commissionPaid: { $sum: "$commissionAmount" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Get totals
  const totals = await PaymentRecord.aggregate([
    {
      $match: {
        status: "COMPLETED",
        completedAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$amount" },
        totalPayments: { $sum: 1 },
        totalCommission: { $sum: "$commissionAmount" },
      },
    },
  ]);

  const totalData = totals[0] || {
    totalRevenue: 0,
    totalPayments: 0,
    totalCommission: 0,
  };
  const averagePayment =
    totalData.totalPayments > 0
      ? Math.round(totalData.totalRevenue / totalData.totalPayments)
      : 0;

  // Format revenue by period for better readability
  const formattedRevenueByPeriod = revenueByPeriod.map((item) => {
    let period;
    if (groupBy === "day") {
      period = item._id;
    } else if (groupBy === "week") {
      period = `${item._id.year}-W${item._id.week}`;
    } else {
      period = `${item._id.year}-${String(item._id.month).padStart(2, "0")}`;
    }

    return {
      period,
      revenue: item.revenue,
      paymentCount: item.paymentCount,
      commissionPaid: item.commissionPaid || 0,
    };
  });

  successResponse(
    res,
    {
      dateRange: { startDate: start, endDate: end },
      groupBy,
      totalRevenue: totalData.totalRevenue,
      totalPayments: totalData.totalPayments,
      totalCommission: totalData.totalCommission,
      averagePayment,
      revenueByPeriod: formattedRevenueByPeriod,
    },
    "Revenue data retrieved successfully"
  );
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
    $or: [{ _id: orderId }, { orderId }],
  })
    .populate("user", "name email phoneNumber")
    .populate("product", "name images pricing")
    .populate("referrer", "name email")
    .lean();

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  const metadata = deriveOrderMetadata(order);

  successResponse(
    res,
    {
      order,
      metadata,
    },
    "Order metadata retrieved successfully"
  );
});

// ============================================
// ANALYTICS APIs - Extended (7 New APIs)
// ============================================

/**
 * @route   GET /api/installments/admin/analytics/users
 * @desc    Get user analytics - top users, overdue users, new users
 * @access  Private (Admin only)
 */
const getUserAnalytics = asyncHandler(async (req, res) => {
  const { limit = 10, period = "all" } = req.query;
  const actualLimit = Math.min(parseInt(limit), 50);

  let dateFilter = {};
  const now = new Date();
  if (period === "week") {
    dateFilter = {
      createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
    };
  } else if (period === "month") {
    dateFilter = {
      createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
    };
  }

  // Top users by total payments
  const topUsersByPayments = await PaymentRecord.aggregate([
    { $match: { status: "COMPLETED", ...dateFilter } },
    {
      $group: {
        _id: "$user",
        totalPaid: { $sum: "$amount" },
        paymentCount: { $sum: 1 },
      },
    },
    { $sort: { totalPaid: -1 } },
    { $limit: actualLimit },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "userDetails",
      },
    },
    { $unwind: "$userDetails" },
    {
      $project: {
        userId: "$_id",
        name: "$userDetails.name",
        email: "$userDetails.email",
        phoneNumber: "$userDetails.phoneNumber",
        totalPaid: 1,
        paymentCount: 1,
      },
    },
  ]);

  // Users with most overdue orders
  const allOrders = await InstallmentOrder.find({ status: "ACTIVE" })
    .populate("user", "name email phoneNumber")
    .lean();
  const overdueByUser = {};
  for (const order of allOrders) {
    const metadata = deriveOrderMetadata(order);
    if (metadata.completionBucket === "overdue" && order.user) {
      const oderId = order.user._id.toString();
      if (!overdueByUser[oderId]) {
        overdueByUser[oderId] = {
          userId: order.user._id,
          name: order.user.name,
          email: order.user.email,
          phoneNumber: order.user.phoneNumber,
          overdueOrders: 0,
          totalOverdueAmount: 0,
        };
      }
      overdueByUser[oderId].overdueOrders++;
      overdueByUser[oderId].totalOverdueAmount += metadata.remainingAmount;
    }
  }
  const usersWithOverdue = Object.values(overdueByUser)
    .sort((a, b) => b.overdueOrders - a.overdueOrders)
    .slice(0, actualLimit);

  // User retention stats
  const totalUniqueUsers = await InstallmentOrder.distinct("user");
  const usersWithMultipleOrders = await InstallmentOrder.aggregate([
    { $group: { _id: "$user", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: "total" },
  ]);

  successResponse(
    res,
    {
      topUsersByPayments,
      usersWithOverdue,
      summary: {
        totalUniqueUsers: totalUniqueUsers.length,
        usersWithMultipleOrders: usersWithMultipleOrders[0]?.total || 0,
        retentionRate:
          totalUniqueUsers.length > 0
            ? Math.round(
                ((usersWithMultipleOrders[0]?.total || 0) /
                  totalUniqueUsers.length) *
                  100
              )
            : 0,
      },
    },
    "User analytics retrieved successfully"
  );
});

/**
 * @route   GET /api/installments/admin/analytics/products
 * @desc    Get product performance analytics
 * @access  Private (Admin only)
 */
const getProductAnalytics = asyncHandler(async (req, res) => {
  const { limit = 10, period = "all" } = req.query;
  const actualLimit = Math.min(parseInt(limit), 50);

  let dateFilter = {};
  const now = new Date();
  if (period === "week") {
    dateFilter = {
      createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
    };
  } else if (period === "month") {
    dateFilter = {
      createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
    };
  }

  // Best selling products by order count
  const bestSellingByCount = await InstallmentOrder.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: "$product",
        orderCount: { $sum: 1 },
        totalRevenue: { $sum: "$totalPaidAmount" },
        totalValue: { $sum: "$productPrice" },
      },
    },
    { $sort: { orderCount: -1 } },
    { $limit: actualLimit },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "productDetails",
      },
    },
    { $unwind: { path: "$productDetails", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        productId: "$_id",
        name: { $ifNull: ["$productDetails.name", "Unknown Product"] },
        orderCount: 1,
        totalRevenue: 1,
        totalValue: 1,
        image: { $arrayElemAt: ["$productDetails.images.url", 0] },
      },
    },
  ]);

  // Products by revenue
  const bestSellingByRevenue = await InstallmentOrder.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: "$product",
        orderCount: { $sum: 1 },
        totalRevenue: { $sum: "$totalPaidAmount" },
        totalValue: { $sum: "$productPrice" },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: actualLimit },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "productDetails",
      },
    },
    { $unwind: { path: "$productDetails", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        productId: "$_id",
        name: { $ifNull: ["$productDetails.name", "Unknown Product"] },
        orderCount: 1,
        totalRevenue: 1,
        totalValue: 1,
      },
    },
  ]);

  // Products with overdue analysis
  const allOrders = await InstallmentOrder.find(dateFilter)
    .populate("product", "name")
    .lean();
  const productIssues = {};
  for (const order of allOrders) {
    const metadata = deriveOrderMetadata(order);
    const productId = order.product?._id?.toString() || "unknown";
    const productName = order.product?.name || order.productName || "Unknown";
    if (!productIssues[productId]) {
      productIssues[productId] = {
        productId,
        name: productName,
        overdueCount: 0,
        cancelledCount: 0,
        completedCount: 0,
        totalOrders: 0,
      };
    }
    productIssues[productId].totalOrders++;
    if (metadata.completionBucket === "overdue")
      productIssues[productId].overdueCount++;
    if (order.status === "CANCELLED") productIssues[productId].cancelledCount++;
    if (order.status === "COMPLETED") productIssues[productId].completedCount++;
  }

  const productsWithIssues = Object.values(productIssues)
    .map((p) => ({
      ...p,
      completionRate:
        p.totalOrders > 0
          ? Math.round((p.completedCount / p.totalOrders) * 100)
          : 0,
      overdueRate:
        p.totalOrders > 0
          ? Math.round((p.overdueCount / p.totalOrders) * 100)
          : 0,
    }))
    .sort((a, b) => b.overdueCount - a.overdueCount)
    .slice(0, actualLimit);

  successResponse(
    res,
    {
      bestSellingByCount,
      bestSellingByRevenue,
      productsWithIssues,
      summary: {
        totalProducts: Object.keys(productIssues).length,
        totalOrders: allOrders.length,
      },
    },
    "Product analytics retrieved successfully"
  );
});

/**
 * @route   GET /api/installments/admin/analytics/commissions
 * @desc    Get commission analytics
 * @access  Private (Admin only)
 */
const getCommissionAnalytics = asyncHandler(async (req, res) => {
  const { limit = 10, period = "all" } = req.query;
  const actualLimit = Math.min(parseInt(limit), 50);

  let dateFilter = {};
  const now = new Date();
  if (period === "week") {
    dateFilter = {
      completedAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
    };
  } else if (period === "month") {
    dateFilter = {
      completedAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
    };
  }

  // Total commission stats
  const totalCommissionStats = await PaymentRecord.aggregate([
    {
      $match: {
        status: "COMPLETED",
        commissionCalculated: true,
        ...dateFilter,
      },
    },
    {
      $group: {
        _id: null,
        totalCommissionPaid: { $sum: "$commissionAmount" },
        totalPaymentsWithCommission: { $sum: 1 },
        avgCommissionPerPayment: { $avg: "$commissionAmount" },
      },
    },
  ]);

  // Top referrers
  const topReferrers = await PaymentRecord.aggregate([
    {
      $match: {
        status: "COMPLETED",
        commissionCalculated: true,
        commissionAmount: { $gt: 0 },
        ...dateFilter,
      },
    },
    {
      $lookup: {
        from: "installmentorders",
        localField: "order",
        foreignField: "_id",
        as: "orderDetails",
      },
    },
    { $unwind: "$orderDetails" },
    { $match: { "orderDetails.referrer": { $ne: null } } },
    {
      $group: {
        _id: "$orderDetails.referrer",
        totalCommission: { $sum: "$commissionAmount" },
        referralCount: { $sum: 1 },
      },
    },
    { $sort: { totalCommission: -1 } },
    { $limit: actualLimit },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "referrerDetails",
      },
    },
    { $unwind: "$referrerDetails" },
    {
      $project: {
        referrerId: "$_id",
        name: "$referrerDetails.name",
        email: "$referrerDetails.email",
        totalCommission: 1,
        referralCount: 1,
      },
    },
  ]);

  // Commission trends (last 30 days)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const commissionTrends = await PaymentRecord.aggregate([
    {
      $match: {
        status: "COMPLETED",
        commissionCalculated: true,
        completedAt: { $gte: thirtyDaysAgo },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$completedAt" } },
        dailyCommission: { $sum: "$commissionAmount" },
        paymentCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Referral stats
  const ordersWithReferrers = await InstallmentOrder.countDocuments({
    referrer: { $ne: null },
  });
  const totalOrders = await InstallmentOrder.countDocuments({});

  successResponse(
    res,
    {
      totalStats: totalCommissionStats[0] || {
        totalCommissionPaid: 0,
        totalPaymentsWithCommission: 0,
        avgCommissionPerPayment: 0,
      },
      topReferrers,
      commissionTrends,
      referralStats: {
        ordersWithReferrers,
        ordersWithoutReferrers: totalOrders - ordersWithReferrers,
        referralRate:
          totalOrders > 0
            ? Math.round((ordersWithReferrers / totalOrders) * 100)
            : 0,
      },
    },
    "Commission analytics retrieved successfully"
  );
});

/**
 * @route   GET /api/installments/admin/analytics/payment-methods
 * @desc    Get payment method analytics
 * @access  Private (Admin only)
 */
const getPaymentMethodAnalytics = asyncHandler(async (req, res) => {
  const { period = "all" } = req.query;

  let dateFilter = {};
  const now = new Date();
  if (period === "week") {
    dateFilter = {
      createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
    };
  } else if (period === "month") {
    dateFilter = {
      createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
    };
  }

  // Payment method breakdown
  const paymentMethodBreakdown = await PaymentRecord.aggregate([
    { $match: { status: "COMPLETED", ...dateFilter } },
    {
      $group: {
        _id: "$paymentMethod",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
      },
    },
    { $sort: { count: -1 } },
  ]);

  // Admin marked payments
  const adminMarkedStats = await PaymentRecord.aggregate([
    { $match: { adminMarked: true, ...dateFilter } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
      },
    },
  ]);

  // Failed payments stats
  const failedPaymentStats = await PaymentRecord.aggregate([
    { $match: { status: "FAILED", ...dateFilter } },
    {
      $group: {
        _id: null,
        totalFailed: { $sum: 1 },
        avgRetryCount: { $avg: "$retryCount" },
      },
    },
  ]);

  // Status breakdown
  const statusBreakdown = await PaymentRecord.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
      },
    },
    { $sort: { count: -1 } },
  ]);

  const totalPayments = statusBreakdown.reduce((sum, s) => sum + s.count, 0);
  const completedPayments =
    statusBreakdown.find((s) => s._id === "COMPLETED")?.count || 0;
  const failedPayments =
    statusBreakdown.find((s) => s._id === "FAILED")?.count || 0;
  const razorpayTotal = paymentMethodBreakdown.find(
    (p) => p._id === "RAZORPAY"
  ) || { count: 0, totalAmount: 0 };
  const walletTotal = paymentMethodBreakdown.find(
    (p) => p._id === "WALLET"
  ) || { count: 0, totalAmount: 0 };

  successResponse(
    res,
    {
      paymentMethodBreakdown,
      statusBreakdown,
      adminMarkedStats: adminMarkedStats[0] || { count: 0, totalAmount: 0 },
      failedPaymentStats: failedPaymentStats[0] || {
        totalFailed: 0,
        avgRetryCount: 0,
      },
      comparison: {
        razorpay: razorpayTotal,
        wallet: walletTotal,
        razorpayPercentage:
          totalPayments > 0
            ? Math.round((razorpayTotal.count / totalPayments) * 100)
            : 0,
        walletPercentage:
          totalPayments > 0
            ? Math.round((walletTotal.count / totalPayments) * 100)
            : 0,
      },
      rates: {
        successRate:
          totalPayments > 0
            ? Math.round((completedPayments / totalPayments) * 100)
            : 0,
        failureRate:
          totalPayments > 0
            ? Math.round((failedPayments / totalPayments) * 100)
            : 0,
        totalPayments,
      },
    },
    "Payment method analytics retrieved successfully"
  );
});

/**
 * @route   GET /api/installments/admin/analytics/trends
 * @desc    Get daily/weekly trends
 * @access  Private (Admin only)
 */
const getTrends = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const actualDays = Math.min(parseInt(days), 90);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - actualDays);
  startDate.setHours(0, 0, 0, 0);

  // Orders per day
  const ordersPerDay = await InstallmentOrder.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        orderCount: { $sum: 1 },
        totalValue: { $sum: "$productPrice" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Payments per day
  const paymentsPerDay = await PaymentRecord.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        totalPayments: { $sum: 1 },
        completedPayments: {
          $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] },
        },
        totalAmount: {
          $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, "$amount", 0] },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Weekly trends
  const weeklyTrends = await InstallmentOrder.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          year: { $isoWeekYear: "$createdAt" },
          week: { $isoWeek: "$createdAt" },
        },
        orderCount: { $sum: 1 },
        totalValue: { $sum: "$productPrice" },
        avgValue: { $avg: "$productPrice" },
      },
    },
    { $sort: { "_id.year": 1, "_id.week": 1 } },
  ]);

  successResponse(
    res,
    {
      ordersPerDay,
      paymentsPerDay,
      weeklyTrends: weeklyTrends.map((w) => ({
        week: `${w._id.year}-W${w._id.week}`,
        orderCount: w.orderCount,
        totalValue: w.totalValue,
        avgValue: Math.round(w.avgValue),
      })),
      summary: {
        totalDays: actualDays,
        totalOrders: ordersPerDay.reduce((sum, d) => sum + d.orderCount, 0),
        totalRevenue: paymentsPerDay.reduce((sum, d) => sum + d.totalAmount, 0),
      },
    },
    "Trends retrieved successfully"
  );
});

/**
 * @route   GET /api/installments/admin/analytics/overdue
 * @desc    Get detailed overdue analysis
 * @access  Private (Admin only)
 */
const getOverdueAnalysis = asyncHandler(async (req, res) => {
  const allActiveOrders = await InstallmentOrder.find({ status: "ACTIVE" })
    .populate("user", "name email phoneNumber")
    .populate("product", "name")
    .lean();

  const overdueOrders = [];
  let totalOverdueAmount = 0;
  let totalDaysOverdue = 0;

  const overdueByDays = {
    "1-3": { count: 0, amount: 0 },
    "4-7": { count: 0, amount: 0 },
    "8-14": { count: 0, amount: 0 },
    "15-30": { count: 0, amount: 0 },
    "30+": { count: 0, amount: 0 },
  };
  const usersWithMultipleOverdue = {};

  for (const order of allActiveOrders) {
    const metadata = deriveOrderMetadata(order);
    if (metadata.completionBucket === "overdue") {
      const daysOverdue = Math.abs(metadata.daysToComplete);
      totalOverdueAmount += metadata.remainingAmount;
      totalDaysOverdue += daysOverdue;

      overdueOrders.push({
        orderId: order.orderId,
        _id: order._id,
        user: order.user,
        product: order.product?.name || order.productName,
        remainingAmount: metadata.remainingAmount,
        daysOverdue,
        progressPercentage: metadata.progressPercentage,
        lastDueDate: metadata.lastDueDate,
      });

      let bucket =
        daysOverdue <= 3
          ? "1-3"
          : daysOverdue <= 7
          ? "4-7"
          : daysOverdue <= 14
          ? "8-14"
          : daysOverdue <= 30
          ? "15-30"
          : "30+";
      overdueByDays[bucket].count++;
      overdueByDays[bucket].amount += metadata.remainingAmount;

      if (order.user) {
        const oderId = order.user._id.toString();
        if (!usersWithMultipleOverdue[oderId]) {
          usersWithMultipleOverdue[oderId] = {
            user: order.user,
            overdueCount: 0,
            totalOverdueAmount: 0,
          };
        }
        usersWithMultipleOverdue[oderId].overdueCount++;
        usersWithMultipleOverdue[oderId].totalOverdueAmount +=
          metadata.remainingAmount;
      }
    }
  }

  overdueOrders.sort((a, b) => b.daysOverdue - a.daysOverdue);
  const multipleOverdueUsers = Object.values(usersWithMultipleOverdue)
    .filter((u) => u.overdueCount > 1)
    .sort((a, b) => b.overdueCount - a.overdueCount)
    .slice(0, 20);

  successResponse(
    res,
    {
      summary: {
        totalOverdueOrders: overdueOrders.length,
        totalOverdueAmount,
        avgDaysOverdue:
          overdueOrders.length > 0
            ? Math.round(totalDaysOverdue / overdueOrders.length)
            : 0,
        avgOverdueAmount:
          overdueOrders.length > 0
            ? Math.round(totalOverdueAmount / overdueOrders.length)
            : 0,
      },
      overdueByDays,
      topOverdueOrders: overdueOrders.slice(0, 20),
      usersWithMultipleOverdue: multipleOverdueUsers,
    },
    "Overdue analysis retrieved successfully"
  );
});

/**
 * @route   GET /api/installments/admin/analytics/forecast
 * @desc    Get revenue and completion forecast
 * @access  Private (Admin only)
 */
const getForecast = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const actualDays = Math.min(parseInt(days), 90);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + actualDays);

  const activeOrders = await InstallmentOrder.find({ status: "ACTIVE" })
    .populate("user", "name email")
    .populate("product", "name")
    .lean();

  const expectedRevenueByDay = {};
  const ordersCompletingSoon = [];

  for (const order of activeOrders) {
    const metadata = deriveOrderMetadata(order);

    if (metadata.lastDueDate) {
      const lastDue = new Date(metadata.lastDueDate);
      if (lastDue >= today && lastDue <= endDate) {
        ordersCompletingSoon.push({
          orderId: order.orderId,
          _id: order._id,
          user: order.user,
          product: order.product?.name || order.productName,
          completionDate: metadata.lastDueDate,
          daysToComplete: metadata.daysToComplete,
          remainingAmount: metadata.remainingAmount,
          progressPercentage: metadata.progressPercentage,
        });
      }
    }

    for (const payment of order.paymentSchedule) {
      if (payment.status === "PENDING" && payment.amount > 0) {
        const dueDate = new Date(payment.dueDate);
        if (dueDate >= today && dueDate <= endDate) {
          const dateKey = dueDate.toISOString().split("T")[0];
          if (!expectedRevenueByDay[dateKey]) {
            expectedRevenueByDay[dateKey] = { expected: 0, paymentCount: 0 };
          }
          expectedRevenueByDay[dateKey].expected += payment.amount;
          expectedRevenueByDay[dateKey].paymentCount++;
        }
      }
    }
  }

  const revenueForecast = Object.entries(expectedRevenueByDay)
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const totalExpectedRevenue = revenueForecast.reduce(
    (sum, d) => sum + d.expected,
    0
  );
  const totalExpectedPayments = revenueForecast.reduce(
    (sum, d) => sum + d.paymentCount,
    0
  );

  ordersCompletingSoon.sort((a, b) => a.daysToComplete - b.daysToComplete);

  const next7Days = new Date(today);
  next7Days.setDate(next7Days.getDate() + 7);
  const upcomingDuePayments = revenueForecast
    .filter((d) => new Date(d.date) <= next7Days)
    .reduce((sum, d) => sum + d.expected, 0);

  successResponse(
    res,
    {
      summary: {
        forecastDays: actualDays,
        totalExpectedRevenue,
        totalExpectedPayments,
        avgDailyExpected: Math.round(totalExpectedRevenue / actualDays),
        ordersCompletingInPeriod: ordersCompletingSoon.length,
        upcomingDuePayments7Days: upcomingDuePayments,
      },
      dailyForecast: revenueForecast,
      ordersCompletingSoon: ordersCompletingSoon.slice(0, 20),
    },
    "Forecast retrieved successfully"
  );
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
  // Analytics APIs - Core
  getOrdersWithMetadata,
  getCompletionBucketsSummary,
  getRevenueByDateRange,
  getOrderMetadata,
  // Analytics APIs - Extended (7 New)
  getUserAnalytics,
  getProductAnalytics,
  getCommissionAnalytics,
  getPaymentMethodAnalytics,
  getTrends,
  getOverdueAnalysis,
  getForecast,
};
