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
const autopayController = require("../controllers/autopayController");

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

// ============================================
// BULK ORDER ROUTES
// ============================================

/**
 * @route   POST /api/installments/orders/bulk
 * @desc    Create bulk order with multiple products (single Razorpay payment)
 * @access  Private
 *
 * @body {
 *   items: [
 *     { productId: string, variantId?: string, quantity?: number, totalDays: number, couponCode?: string }
 *   ],
 *   paymentMethod: 'RAZORPAY' | 'WALLET',
 *   deliveryAddress: { name, phoneNumber, addressLine1, city, state, pincode }
 * }
 */
router.post(
  "/orders/bulk",
  verifyToken,
  sanitizeInput,
  orderController.createBulkOrder
);

/**
 * @route   POST /api/installments/orders/bulk/verify-payment
 * @desc    Verify Razorpay payment for bulk order
 * @access  Private
 */
router.post(
  "/orders/bulk/verify-payment",
  verifyToken,
  sanitizeInput,
  orderController.verifyBulkOrderPayment
);

/**
 * @route   GET /api/installments/orders/my-bulk-orders
 * @desc    Get user's bulk orders list
 * @access  Private
 */
router.get(
  "/orders/my-bulk-orders",
  verifyToken,
  orderController.getMyBulkOrders
);

/**
 * @route   GET /api/installments/orders/bulk/:bulkOrderId
 * @desc    Get bulk order details
 * @access  Private
 */
router.get(
  "/orders/bulk/:bulkOrderId",
  verifyToken,
  orderController.getBulkOrderDetails
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
 * @returns Complete order preview with validations, pricing, and calculations
 */
router.post(
  "/orders/preview",
  verifyToken,
  sanitizeInput,
  orderController.previewOrder
);

/**
 * @route   POST /api/installments/orders/bulk/preview
 * @desc    Preview bulk order with multiple products without creating orders
 * @access  Private
 *
 * @body {
 *   items: [
 *     { productId: string, variantId?: string, quantity?: number, totalDays: number, couponCode?: string }
 *   ],
 *   deliveryAddress: { name, phoneNumber, addressLine1, city, state, pincode }
 * }
 *
 * @returns Complete bulk order preview with all items validated and totals calculated
 */
router.post(
  "/orders/bulk/preview",
  verifyToken,
  sanitizeInput,
  orderController.previewBulkOrder
);

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
// USER ROUTES - Autopay Management
// ============================================

/**
 * @route   POST /api/installments/autopay/enable/:orderId
 * @desc    Enable autopay for a specific order
 * @access  Private
 */
router.post(
  "/autopay/enable/:orderId",
  verifyToken,
  sanitizeInput,
  autopayController.enableAutopay
);

/**
 * @route   POST /api/installments/autopay/disable/:orderId
 * @desc    Disable autopay for a specific order
 * @access  Private
 */
router.post(
  "/autopay/disable/:orderId",
  verifyToken,
  autopayController.disableAutopay
);

/**
 * @route   POST /api/installments/autopay/enable-all
 * @desc    Enable autopay for all active orders
 * @access  Private
 */
router.post(
  "/autopay/enable-all",
  verifyToken,
  autopayController.enableAutopayForAll
);

/**
 * @route   POST /api/installments/autopay/disable-all
 * @desc    Disable autopay for all orders
 * @access  Private
 */
router.post(
  "/autopay/disable-all",
  verifyToken,
  autopayController.disableAutopayForAll
);

/**
 * @route   POST /api/installments/autopay/pause/:orderId
 * @desc    Pause autopay for an order until a specific date
 * @access  Private
 * @body    { pauseUntil: Date }
 */
router.post(
  "/autopay/pause/:orderId",
  verifyToken,
  sanitizeInput,
  autopayController.pauseAutopay
);

/**
 * @route   POST /api/installments/autopay/resume/:orderId
 * @desc    Resume autopay for an order
 * @access  Private
 */
router.post(
  "/autopay/resume/:orderId",
  verifyToken,
  autopayController.resumeAutopay
);

/**
 * @route   POST /api/installments/autopay/skip-dates/:orderId
 * @desc    Add skip dates for autopay
 * @access  Private
 * @body    { dates: [Date] }
 */
router.post(
  "/autopay/skip-dates/:orderId",
  verifyToken,
  sanitizeInput,
  autopayController.addSkipDates
);

/**
 * @route   DELETE /api/installments/autopay/skip-dates/:orderId
 * @desc    Remove a skip date
 * @access  Private
 * @body    { date: Date }
 */
router.delete(
  "/autopay/skip-dates/:orderId",
  verifyToken,
  sanitizeInput,
  autopayController.removeSkipDate
);

/**
 * @route   PUT /api/installments/autopay/settings
 * @desc    Update autopay settings
 * @access  Private
 * @body    { enabled, timePreference, minimumBalanceLock, lowBalanceThreshold, sendDailyReminder, reminderHoursBefore }
 */
router.put(
  "/autopay/settings",
  verifyToken,
  sanitizeInput,
  autopayController.updateSettings
);

/**
 * @route   GET /api/installments/autopay/settings
 * @desc    Get autopay settings
 * @access  Private
 */
router.get(
  "/autopay/settings",
  verifyToken,
  autopayController.getSettings
);

/**
 * @route   GET /api/installments/autopay/status
 * @desc    Get autopay status for all orders
 * @access  Private
 */
router.get(
  "/autopay/status",
  verifyToken,
  autopayController.getStatus
);

/**
 * @route   PUT /api/installments/autopay/priority/:orderId
 * @desc    Set autopay priority for an order
 * @access  Private
 * @body    { priority: number (1-100) }
 */
router.put(
  "/autopay/priority/:orderId",
  verifyToken,
  sanitizeInput,
  autopayController.setPriority
);

/**
 * @route   GET /api/installments/autopay/dashboard
 * @desc    Get autopay dashboard data
 * @access  Private
 */
router.get(
  "/autopay/dashboard",
  verifyToken,
  autopayController.getDashboard
);

/**
 * @route   GET /api/installments/autopay/forecast
 * @desc    Get balance forecast
 * @access  Private
 * @query   { days?: number (1-90, default 30) }
 */
router.get(
  "/autopay/forecast",
  verifyToken,
  autopayController.getForecast
);

/**
 * @route   GET /api/installments/autopay/history
 * @desc    Get autopay payment history
 * @access  Private
 * @query   { page?: number, limit?: number }
 */
router.get(
  "/autopay/history",
  verifyToken,
  autopayController.getHistory
);

/**
 * @route   GET /api/installments/autopay/streak
 * @desc    Get payment streak information
 * @access  Private
 */
router.get(
  "/autopay/streak",
  verifyToken,
  autopayController.getStreak
);

/**
 * @route   GET /api/installments/autopay/suggested-topup
 * @desc    Get suggested wallet top-up amount
 * @access  Private
 * @query   { days?: number (default 7) }
 */
router.get(
  "/autopay/suggested-topup",
  verifyToken,
  autopayController.getSuggestedTopup
);

/**
 * @route   PUT /api/installments/autopay/notification-preferences
 * @desc    Update autopay notification preferences
 * @access  Private
 * @body    { autopaySuccess, autopayFailed, lowBalanceAlert, dailyReminder }
 */
router.put(
  "/autopay/notification-preferences",
  verifyToken,
  sanitizeInput,
  autopayController.updateNotificationPreferences
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

/**
 * @route   GET /api/installments/admin/analytics/users
 * @desc    Get user analytics - top users, overdue users, retention
 * @access  Private (Admin)
 *
 * @query {
 *   limit?: number (default: 10),
 *   period?: 'week' | 'month' | 'all' (default: all)
 * }
 */
router.get(
  "/admin/analytics/users",
  verifyToken,
  isAdmin,
  adminController.getUserAnalytics
);

/**
 * @route   GET /api/installments/admin/analytics/products
 * @desc    Get product performance analytics
 * @access  Private (Admin)
 *
 * @query {
 *   limit?: number (default: 10),
 *   period?: 'week' | 'month' | 'all' (default: all)
 * }
 */
router.get(
  "/admin/analytics/products",
  verifyToken,
  isAdmin,
  adminController.getProductAnalytics
);

/**
 * @route   GET /api/installments/admin/analytics/commissions
 * @desc    Get commission analytics - top referrers, trends
 * @access  Private (Admin)
 *
 * @query {
 *   limit?: number (default: 10),
 *   period?: 'week' | 'month' | 'all' (default: all)
 * }
 */
router.get(
  "/admin/analytics/commissions",
  verifyToken,
  isAdmin,
  adminController.getCommissionAnalytics
);

/**
 * @route   GET /api/installments/admin/analytics/payment-methods
 * @desc    Get payment method analytics - Razorpay vs Wallet, success rates
 * @access  Private (Admin)
 *
 * @query {
 *   period?: 'week' | 'month' | 'all' (default: all)
 * }
 */
router.get(
  "/admin/analytics/payment-methods",
  verifyToken,
  isAdmin,
  adminController.getPaymentMethodAnalytics
);

/**
 * @route   GET /api/installments/admin/analytics/trends
 * @desc    Get daily/weekly trends - orders, payments, revenue
 * @access  Private (Admin)
 *
 * @query {
 *   days?: number (default: 30, max: 90)
 * }
 */
router.get(
  "/admin/analytics/trends",
  verifyToken,
  isAdmin,
  adminController.getTrends
);

/**
 * @route   GET /api/installments/admin/analytics/overdue
 * @desc    Get detailed overdue analysis
 * @access  Private (Admin)
 */
router.get(
  "/admin/analytics/overdue",
  verifyToken,
  isAdmin,
  adminController.getOverdueAnalysis
);

/**
 * @route   GET /api/installments/admin/analytics/forecast
 * @desc    Get revenue and completion forecast
 * @access  Private (Admin)
 *
 * @query {
 *   days?: number (default: 30, max: 90)
 * }
 */
router.get(
  "/admin/analytics/forecast",
  verifyToken,
  isAdmin,
  adminController.getForecast
);

// ============================================
// ADMIN ROUTES - Autopay Management
// ============================================

/**
 * @route   POST /api/installments/admin/autopay/trigger
 * @desc    Manually trigger autopay processing for a time slot (for testing)
 * @access  Private (Admin)
 * @body    { timeSlot: 'MORNING_6AM' | 'AFTERNOON_12PM' | 'EVENING_6PM' }
 */
router.post(
  "/admin/autopay/trigger",
  verifyToken,
  isAdmin,
  sanitizeInput,
  async (req, res) => {
    try {
      const { timeSlot } = req.body;
      const { manualTriggerAutopay } = require("../jobs/autopayCron");

      if (!timeSlot) {
        return res.status(400).json({
          success: false,
          message: "timeSlot is required (MORNING_6AM, AFTERNOON_12PM, or EVENING_6PM)",
        });
      }

      const result = await manualTriggerAutopay(timeSlot);

      res.status(200).json({
        success: true,
        message: `Autopay triggered for ${timeSlot}`,
        data: result,
      });
    } catch (error) {
      console.error("[Admin] Autopay trigger error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to trigger autopay",
      });
    }
  }
);

/**
 * @route   GET /api/installments/admin/autopay/cron-status
 * @desc    Get autopay cron job status
 * @access  Private (Admin)
 */
router.get(
  "/admin/autopay/cron-status",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const { getCronStatus } = require("../jobs/autopayCron");
      const status = getCronStatus();

      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      console.error("[Admin] Cron status error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get cron status",
      });
    }
  }
);

/**
 * @route   GET /api/installments/admin/autopay/users
 * @desc    Get all users with autopay enabled
 * @access  Private (Admin)
 */
router.get(
  "/admin/autopay/users",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const User = require("../models/User");
      const InstallmentOrder = require("../models/InstallmentOrder");

      const users = await User.find({
        "autopaySettings.enabled": true,
      }).select("name email autopaySettings wallet.balance");

      // Get order counts for each user
      const usersWithOrders = await Promise.all(
        users.map(async (user) => {
          const orderCount = await InstallmentOrder.countDocuments({
            user: user._id,
            status: "ACTIVE",
            "autopay.enabled": true,
          });

          return {
            _id: user._id,
            name: user.name,
            email: user.email,
            autopaySettings: user.autopaySettings,
            walletBalance: user.wallet?.balance || 0,
            autopayOrderCount: orderCount,
          };
        })
      );

      res.status(200).json({
        success: true,
        data: {
          totalUsers: usersWithOrders.length,
          users: usersWithOrders,
        },
      });
    } catch (error) {
      console.error("[Admin] Get autopay users error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get autopay users",
      });
    }
  }
);

/**
 * @route   GET /api/installments/admin/autopay/stats
 * @desc    Get autopay statistics
 * @access  Private (Admin)
 */
router.get(
  "/admin/autopay/stats",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const User = require("../models/User");
      const InstallmentOrder = require("../models/InstallmentOrder");

      // Count users with autopay enabled
      const usersWithAutopay = await User.countDocuments({
        "autopaySettings.enabled": true,
      });

      // Count orders with autopay enabled
      const ordersWithAutopay = await InstallmentOrder.countDocuments({
        status: "ACTIVE",
        "autopay.enabled": true,
      });

      // Get time preference distribution
      const timePreferences = await User.aggregate([
        { $match: { "autopaySettings.enabled": true } },
        { $group: { _id: "$autopaySettings.timePreference", count: { $sum: 1 } } },
      ]);

      // Get recent autopay history
      const recentOrders = await InstallmentOrder.find({
        "autopay.history.0": { $exists: true },
      })
        .select("orderId productName autopay.history autopay.successCount autopay.failedCount")
        .sort({ "autopay.history.0.date": -1 })
        .limit(20);

      res.status(200).json({
        success: true,
        data: {
          usersWithAutopay,
          ordersWithAutopay,
          timePreferences: timePreferences.reduce((acc, item) => {
            acc[item._id || "MORNING_6AM"] = item.count;
            return acc;
          }, {}),
          recentActivity: recentOrders.map((o) => ({
            orderId: o.orderId,
            productName: o.productName,
            successCount: o.autopay?.successCount || 0,
            failedCount: o.autopay?.failedCount || 0,
            lastActivity: o.autopay?.history?.[0] || null,
          })),
        },
      });
    } catch (error) {
      console.error("[Admin] Get autopay stats error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get autopay stats",
      });
    }
  }
);

// ============================================
// ADMIN ROUTES - Streak Configuration
// ============================================

/**
 * @route   GET /api/installments/admin/streak/config
 * @desc    Get streak configuration
 * @access  Private (Admin)
 */
router.get(
  "/admin/streak/config",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const StreakConfig = require("../models/StreakConfig");
      const config = await StreakConfig.getConfig();

      res.status(200).json({
        success: true,
        data: config,
      });
    } catch (error) {
      console.error("[Admin] Get streak config error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get streak config",
      });
    }
  }
);

/**
 * @route   PUT /api/installments/admin/streak/config
 * @desc    Update streak configuration (enable/disable, update all milestones)
 * @access  Private (Admin)
 * @body    { enabled: boolean, milestones: [{days, reward, badge, description, isActive}] }
 */
router.put(
  "/admin/streak/config",
  verifyToken,
  isAdmin,
  sanitizeInput,
  async (req, res) => {
    try {
      const StreakConfig = require("../models/StreakConfig");
      const { enabled, milestones } = req.body;

      const config = await StreakConfig.updateConfig(
        { enabled, milestones },
        req.user._id,
        req.user.email
      );

      res.status(200).json({
        success: true,
        message: "Streak configuration updated",
        data: {
          enabled: config.enabled,
          milestones: config.milestones,
          updatedAt: config.updatedAt,
        },
      });
    } catch (error) {
      console.error("[Admin] Update streak config error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update streak config",
      });
    }
  }
);

/**
 * @route   PUT /api/installments/admin/streak/enable
 * @desc    Enable or disable streak system
 * @access  Private (Admin)
 * @body    { enabled: boolean }
 */
router.put(
  "/admin/streak/enable",
  verifyToken,
  isAdmin,
  sanitizeInput,
  async (req, res) => {
    try {
      const StreakConfig = require("../models/StreakConfig");
      const { enabled } = req.body;

      if (enabled === undefined) {
        return res.status(400).json({
          success: false,
          message: "enabled field is required",
        });
      }

      const config = await StreakConfig.setEnabled(
        enabled,
        req.user._id,
        req.user.email
      );

      res.status(200).json({
        success: true,
        message: enabled ? "Streak system enabled" : "Streak system disabled",
        data: {
          enabled: config.enabled,
        },
      });
    } catch (error) {
      console.error("[Admin] Enable streak error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update streak status",
      });
    }
  }
);

/**
 * @route   POST /api/installments/admin/streak/milestone
 * @desc    Add a new milestone
 * @access  Private (Admin)
 * @body    { days: number, reward: number, badge: string, description?: string }
 */
router.post(
  "/admin/streak/milestone",
  verifyToken,
  isAdmin,
  sanitizeInput,
  async (req, res) => {
    try {
      const StreakConfig = require("../models/StreakConfig");
      const { days, reward, badge, description } = req.body;

      if (!days || reward === undefined || !badge) {
        return res.status(400).json({
          success: false,
          message: "days, reward, and badge are required",
        });
      }

      const config = await StreakConfig.addMilestone(
        { days, reward, badge, description: description || "", isActive: true },
        req.user._id,
        req.user.email
      );

      res.status(201).json({
        success: true,
        message: `Milestone for ${days} days added`,
        data: {
          milestones: config.milestones,
        },
      });
    } catch (error) {
      console.error("[Admin] Add milestone error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to add milestone",
      });
    }
  }
);

/**
 * @route   PUT /api/installments/admin/streak/milestone/:days
 * @desc    Update a specific milestone
 * @access  Private (Admin)
 * @body    { days?: number, reward?: number, badge?: string, description?: string, isActive?: boolean }
 */
router.put(
  "/admin/streak/milestone/:days",
  verifyToken,
  isAdmin,
  sanitizeInput,
  async (req, res) => {
    try {
      const StreakConfig = require("../models/StreakConfig");
      const targetDays = parseInt(req.params.days);
      const updates = req.body;

      if (isNaN(targetDays)) {
        return res.status(400).json({
          success: false,
          message: "Invalid days parameter",
        });
      }

      const config = await StreakConfig.updateMilestone(
        targetDays,
        updates,
        req.user._id,
        req.user.email
      );

      res.status(200).json({
        success: true,
        message: `Milestone for ${targetDays} days updated`,
        data: {
          milestones: config.milestones,
        },
      });
    } catch (error) {
      console.error("[Admin] Update milestone error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update milestone",
      });
    }
  }
);

/**
 * @route   DELETE /api/installments/admin/streak/milestone/:days
 * @desc    Delete a milestone
 * @access  Private (Admin)
 */
router.delete(
  "/admin/streak/milestone/:days",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const StreakConfig = require("../models/StreakConfig");
      const targetDays = parseInt(req.params.days);

      if (isNaN(targetDays)) {
        return res.status(400).json({
          success: false,
          message: "Invalid days parameter",
        });
      }

      const config = await StreakConfig.deleteMilestone(
        targetDays,
        req.user._id,
        req.user.email
      );

      res.status(200).json({
        success: true,
        message: `Milestone for ${targetDays} days deleted`,
        data: {
          milestones: config.milestones,
        },
      });
    } catch (error) {
      console.error("[Admin] Delete milestone error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to delete milestone",
      });
    }
  }
);

/**
 * @route   DELETE /api/installments/admin/streak/config
 * @desc    Delete all streak configuration (reset)
 * @access  Private (Admin)
 */
router.delete(
  "/admin/streak/config",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const StreakConfig = require("../models/StreakConfig");
      await StreakConfig.deleteConfig();

      res.status(200).json({
        success: true,
        message: "Streak configuration deleted",
      });
    } catch (error) {
      console.error("[Admin] Delete streak config error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to delete streak config",
      });
    }
  }
);

/**
 * @route   GET /api/installments/admin/streak/stats
 * @desc    Get streak statistics across all users
 * @access  Private (Admin)
 */
router.get(
  "/admin/streak/stats",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const User = require("../models/User");
      const StreakConfig = require("../models/StreakConfig");

      // Get streak config
      const config = await StreakConfig.getConfig();

      // Get users with active streaks
      const usersWithStreaks = await User.find({
        "paymentStreak.current": { $gt: 0 },
      })
        .select("name email paymentStreak")
        .sort({ "paymentStreak.current": -1 })
        .limit(50);

      // Aggregate stats
      const streakStats = await User.aggregate([
        { $match: { "paymentStreak.current": { $gt: 0 } } },
        {
          $group: {
            _id: null,
            totalUsersWithStreak: { $sum: 1 },
            totalRewardsGiven: { $sum: "$paymentStreak.totalRewardsEarned" },
            avgCurrentStreak: { $avg: "$paymentStreak.current" },
            maxCurrentStreak: { $max: "$paymentStreak.current" },
            maxLongestStreak: { $max: "$paymentStreak.longest" },
          },
        },
      ]);

      const stats = streakStats[0] || {
        totalUsersWithStreak: 0,
        totalRewardsGiven: 0,
        avgCurrentStreak: 0,
        maxCurrentStreak: 0,
        maxLongestStreak: 0,
      };

      res.status(200).json({
        success: true,
        data: {
          config: {
            isConfigured: config.isConfigured,
            enabled: config.enabled,
            milestonesCount: config.milestones?.length || 0,
          },
          stats: {
            totalUsersWithStreak: stats.totalUsersWithStreak,
            totalRewardsGiven: Math.round(stats.totalRewardsGiven || 0),
            avgCurrentStreak: Math.round(stats.avgCurrentStreak || 0),
            maxCurrentStreak: stats.maxCurrentStreak || 0,
            maxLongestStreak: stats.maxLongestStreak || 0,
          },
          topUsers: usersWithStreaks.map((u) => ({
            name: u.name,
            email: u.email,
            currentStreak: u.paymentStreak?.current || 0,
            longestStreak: u.paymentStreak?.longest || 0,
            totalRewardsEarned: u.paymentStreak?.totalRewardsEarned || 0,
            milestonesAchieved: u.paymentStreak?.milestonesAchieved?.length || 0,
          })),
        },
      });
    } catch (error) {
      console.error("[Admin] Get streak stats error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get streak stats",
      });
    }
  }
);

module.exports = router;
