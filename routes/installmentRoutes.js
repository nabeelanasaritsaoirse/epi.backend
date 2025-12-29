/**
 * Installment Order & Payment Routes
 *
 * All routes for installment-based order management and payment processing.
 * Includes user routes and admin routes.
 */

const express = require("express");
const router = express.Router();

// Import middleware
const { verifyToken, isAdmin } = require("../middlewares/auth");
const {
  validateCreateOrder,
  validateProcessPayment,
  validateGetOrder,
  validateApproveDelivery,
  validateUpdateDeliveryStatus,
  validateCancelOrder,
  validateQueryParams,
  sanitizeInput,
} = require("../middlewares/installmentValidation");

// Import controllers
const orderController = require("../controllers/installmentOrderController");
const paymentController = require("../controllers/installmentPaymentController");
const adminController = require("../controllers/installmentAdminController");

// ============================================
// USER ROUTES - Order Management
// ============================================

/**
 * @route   POST /api/installment-orders
 * @desc    Create new installment order
 * @access  Private
 */
router.post(
  "/orders",
  verifyToken,
  sanitizeInput,
  validateCreateOrder,
  orderController.createOrder
);

/**
 * @route   POST /api/installment-orders/verify-first-payment
 * @desc    Verify first Razorpay payment and activate the order
 * @access  Private
 *
 * Frontend should call this after Razorpay payment success callback
 */
router.post(
  "/orders/verify-first-payment",
  verifyToken,
  sanitizeInput,
  orderController.verifyFirstPayment
);

/**
 * @route   GET /api/installment-orders
 * @desc    Get user's orders
 * @access  Private
 */
router.get(
  "/orders",
  verifyToken,
  validateQueryParams,
  orderController.getUserOrders
);

/**
 * @route   GET /api/installment-orders/stats
 * @desc    Get user's order statistics
 * @access  Private
 */
router.get("/orders/stats", verifyToken, orderController.getOrderStats);

/**
  * @route   GET /api/installment-orders/orders/overall-status
 * @desc    Get overall investment status across ALL installment orders
 * @access  Private
 */
router.get(
  "/orders/overall-status",
  verifyToken,
  orderController.getOverallInvestmentStatus
);

/**
 * @route   POST /api/installment/validate-coupon
 * @desc    Validate coupon and calculate discount for installment orders
 * @access  Public
 */
router.post("/validate-coupon", sanitizeInput, orderController.validateCoupon);

/**
 * @route   GET /api/installment-orders/:orderId
 * @desc    Get order details
 * @access  Private
 */
router.get(
  "/orders/:orderId",
  verifyToken,
  validateGetOrder,
  orderController.getOrder
);

/**
 * @route   GET /api/installment-orders/:orderId/summary
 * @desc    Get order summary with progress
 * @access  Private
 */
router.get(
  "/orders/:orderId/summary",
  verifyToken,
  validateGetOrder,
  orderController.getOrderSummary
);

/**
 * @route   GET /api/installment-orders/:orderId/schedule
 * @desc    Get payment schedule
 * @access  Private
 */
router.get(
  "/orders/:orderId/schedule",
  verifyToken,
  validateGetOrder,
  orderController.getPaymentSchedule
);

/**
 * @route   POST /api/installment-orders/:orderId/cancel
 * @desc    Cancel order
 * @access  Private
 */
router.post(
  "/orders/:orderId/cancel",
  verifyToken,
  sanitizeInput,
  validateCancelOrder,
  orderController.cancelOrder
);

/**
 * @route   GET /api/installments/dashboard/overview
 * @desc    Get comprehensive dashboard overview
 * @access  Private
 */
router.get(
  "/dashboard/overview",
  verifyToken,
  orderController.getDashboardOverview
);

// ============================================
// USER ROUTES - Payment Processing
// ============================================

/**
 * @route   POST /api/installment-payments/create-razorpay-order
 * @desc    Create Razorpay order for next installment
 * @access  Private
 */
router.post(
  "/payments/create-razorpay-order",
  verifyToken,
  sanitizeInput,
  paymentController.createRazorpayOrder
);

/**
 * @route   POST /api/installment-payments/process
 * @desc    Process installment payment
 * @access  Private
 */
router.post(
  "/payments/process",
  verifyToken,
  sanitizeInput,
  validateProcessPayment,
  paymentController.processPayment
);

/**
 * @route   GET /api/installment-payments/my-payments
 * @desc    Get user's payment history
 * @access  Private
 */
router.get(
  "/payments/my-payments",
  verifyToken,
  validateQueryParams,
  paymentController.getMyPayments
);

/**
 * @route   GET /api/installment-payments/stats
 * @desc    Get payment statistics
 * @access  Private
 */
router.get("/payments/stats", verifyToken, paymentController.getPaymentStats);

/**
 * @route   GET /api/installment-payments/history/:orderId
 * @desc    Get payment history for order
 * @access  Private
 */
router.get(
  "/payments/history/:orderId",
  verifyToken,
  validateGetOrder,
  paymentController.getPaymentHistory
);

/**
 * @route   GET /api/installment-payments/next-due/:orderId
 * @desc    Get next due payment
 * @access  Private
 */
router.get(
  "/payments/next-due/:orderId",
  verifyToken,
  validateGetOrder,
  paymentController.getNextDuePayment
);

/**
 * @route   GET /api/installment-payments/daily-pending
 * @desc    Get daily pending installment transactions
 * @access  Private
 */
router.get(
  "/payments/daily-pending",
  verifyToken,
  paymentController.getDailyPendingPayments
);

/**
 * @route   POST /api/installment-payments/create-combined-razorpay
 * @desc    Create Razorpay order for multiple installments
 * @access  Private
 */
router.post(
  "/payments/create-combined-razorpay",
  verifyToken,
  sanitizeInput,
  paymentController.createCombinedRazorpayOrder
);

/**
 * @route   POST /api/installment-payments/pay-daily-selected
 * @desc    Process daily payments for multiple orders in one transaction
 * @access  Private
 */
router.post(
  "/payments/pay-daily-selected",
  verifyToken,
  sanitizeInput,
  paymentController.processSelectedDailyPayments
);

/**
 * @route   POST /api/installment-payments/:paymentId/retry
 * @desc    Retry failed payment
 * @access  Private
 */
router.post(
  "/payments/:paymentId/retry",
  verifyToken,
  paymentController.retryPayment
);

// ============================================
// ADMIN ROUTES - Dashboard & Management
// ============================================

/**
 * @route   GET /api/admin/installment-orders/dashboard/stats
 * @desc    Get dashboard statistics
 * @access  Private (Admin)
 */
router.get(
  "/admin/orders/dashboard/stats",
  verifyToken,
  isAdmin,
  adminController.getDashboardStats
);

/**
 * @route   GET /api/admin/installment-orders/all
 * @desc    Get all orders (with filters)
 * @access  Private (Admin)
 */
router.get(
  "/admin/orders/all",
  verifyToken,
  isAdmin,
  validateQueryParams,
  adminController.getAllOrders
);

/**
 * @route   GET /api/admin/installment-orders/completed
 * @desc    Get completed orders
 * @access  Private (Admin)
 */
router.get(
  "/admin/orders/completed",
  verifyToken,
  isAdmin,
  validateQueryParams,
  adminController.getCompletedOrders
);

/**
 * @route   GET /api/admin/installment-orders/pending-approval
 * @desc    Get orders pending delivery approval
 * @access  Private (Admin)
 */
router.get(
  "/admin/orders/pending-approval",
  verifyToken,
  isAdmin,
  adminController.getPendingApprovalOrders
);

/**
 * @route   GET /api/admin/installment-orders/:orderId
 * @desc    Get order details (admin view)
 * @access  Private (Admin)
 */
router.get(
  "/admin/orders/:orderId",
  verifyToken,
  isAdmin,
  validateGetOrder,
  adminController.getOrderDetails
);

/**
 * @route   POST /api/admin/installment-orders/:orderId/approve-delivery
 * @desc    Approve delivery
 * @access  Private (Admin)
 */
router.post(
  "/admin/orders/:orderId/approve-delivery",
  verifyToken,
  isAdmin,
  validateApproveDelivery,
  adminController.approveDelivery
);

/**
 * @route   PUT /api/admin/installment-orders/:orderId/delivery-status
 * @desc    Update delivery status
 * @access  Private (Admin)
 */
router.put(
  "/admin/orders/:orderId/delivery-status",
  verifyToken,
  isAdmin,
  sanitizeInput,
  validateUpdateDeliveryStatus,
  adminController.updateDeliveryStatus
);

/**
 * @route   PUT /api/admin/installment-orders/:orderId/notes
 * @desc    Add admin notes
 * @access  Private (Admin)
 */
router.put(
  "/admin/orders/:orderId/notes",
  verifyToken,
  isAdmin,
  sanitizeInput,
  adminController.addAdminNotes
);

/**
 * @route   GET /api/admin/installment-payments/all
 * @desc    Get all payments
 * @access  Private (Admin)
 */
router.get(
  "/admin/payments/all",
  verifyToken,
  isAdmin,
  validateQueryParams,
  adminController.getAllPayments
);

/**
 * @route   POST /api/installments/admin/adjust-payment-dates
 * @desc    Adjust payment due dates for testing
 * @access  Private (Admin)
 */
router.post(
  "/admin/adjust-payment-dates",
  verifyToken,
  isAdmin,
  sanitizeInput,
  adminController.adjustPaymentDates
);

/**
 * @route   POST /api/installments/admin/orders/create-for-user
 * @desc    Admin creates installment order on behalf of a user
 * @access  Private (Admin)
 */
router.post(
  "/admin/orders/create-for-user",
  verifyToken,
  isAdmin,
  sanitizeInput,
  adminController.createOrderForUser
);

/**
 * @route   POST /api/installments/admin/payments/:paymentId/mark-paid
 * @desc    Admin marks a payment as paid
 * @access  Private (Admin)
 */
router.post(
  "/admin/payments/:paymentId/mark-paid",
  verifyToken,
  isAdmin,
  sanitizeInput,
  adminController.markPaymentAsPaid
);

/**
 * @route   POST /api/installments/admin/orders/:orderId/mark-all-paid
 * @desc    Admin marks all pending payments for an order as paid
 * @access  Private (Admin)
 */
router.post(
  "/admin/orders/:orderId/mark-all-paid",
  verifyToken,
  isAdmin,
  sanitizeInput,
  adminController.markAllPaymentsAsPaid
);

/**
 * @route   POST /api/installments/admin/payments/:paymentId/cancel
 * @desc    Admin cancels/reverses a payment
 * @access  Private (Admin)
 */
router.post(
  "/admin/payments/:paymentId/cancel",
  verifyToken,
  isAdmin,
  sanitizeInput,
  adminController.cancelPayment
);

// ============================================
// ADMIN ROUTES - Analytics APIs
// ============================================

/**
 * @route   GET /api/installments/admin/analytics/orders
 * @desc    Get orders with derived completion metadata
 * @access  Private (Admin)
 *
 * @query {
 *   status?: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED',
 *   completionBucket?: 'overdue' | 'due-today' | '1-7-days' | '8-30-days' | '30+-days' | 'completed' | 'cancelled',
 *   limit?: number (default: 50),
 *   page?: number (default: 1),
 *   sortBy?: 'daysToComplete' | 'progressPercentage' | 'remainingAmount' | 'createdAt',
 *   sortOrder?: 'asc' | 'desc'
 * }
 */
router.get(
  "/admin/analytics/orders",
  verifyToken,
  isAdmin,
  adminController.getOrdersWithMetadata
);

/**
 * @route   GET /api/installments/admin/analytics/completion-buckets
 * @desc    Get aggregated completion bucket summary
 * @access  Private (Admin)
 */
router.get(
  "/admin/analytics/completion-buckets",
  verifyToken,
  isAdmin,
  adminController.getCompletionBucketsSummary
);

/**
 * @route   GET /api/installments/admin/analytics/revenue
 * @desc    Get revenue by date range
 * @access  Private (Admin)
 *
 * @query {
 *   startDate: string (required) - ISO date (YYYY-MM-DD),
 *   endDate: string (required) - ISO date (YYYY-MM-DD),
 *   groupBy?: 'day' | 'week' | 'month' (default: day)
 * }
 */
router.get(
  "/admin/analytics/revenue",
  verifyToken,
  isAdmin,
  adminController.getRevenueByDateRange
);

/**
 * @route   GET /api/installments/admin/analytics/orders/:orderId/metadata
 * @desc    Get derived metadata for a single order
 * @access  Private (Admin)
 */
router.get(
  "/admin/analytics/orders/:orderId/metadata",
  verifyToken,
  isAdmin,
  adminController.getOrderMetadata
);

module.exports = router;
