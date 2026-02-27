/**
 * Admin Payment Intelligence Routes
 *
 * All routes require JWT authentication + admin role.
 * Mount in index.js:
 *   app.use('/api/admin/payments', require('./routes/adminPayments'));
 *
 * Available Endpoints:
 *
 *   GET  /api/admin/payments/list
 *        List payments with filters: date, method, status, user search
 *        Query: page, limit, startDate, endDate, method, status, search, sortBy
 *
 *   GET  /api/admin/payments/analytics
 *        Aggregated stats: totals, fees, method breakdown, failure reasons
 *        Query: startDate, endDate
 *
 *   GET  /api/admin/payments/settlements
 *        Fetch settlement list from Razorpay API
 *        Query: count, skip
 *
 *   GET  /api/admin/payments/settlements/:settlementId
 *        Fetch settlement detail + recon items from Razorpay API
 *        Query: reconCount, reconSkip
 *
 *   GET  /api/admin/payments/:paymentId
 *        Full payment record (all Razorpay fields including card/UPI/acquirer data)
 *
 *   POST /api/admin/payments/:paymentId/refund
 *        Initiate a full or partial refund via Razorpay API
 *        Body: { amount?, reason?, speed? }
 */

const express = require('express');
const router  = express.Router();

const { verifyToken, isAdmin } = require('../middlewares/auth');
const { asyncHandler }         = require('../middlewares/errorHandler');
const ctrl = require('../controllers/adminPaymentController');

// Protect all routes in this file with JWT + admin role
router.use(verifyToken, isAdmin);

// Static routes first (must come before /:paymentId to avoid route conflicts)
router.get('/list',                    asyncHandler(ctrl.listPayments));
router.get('/analytics',               asyncHandler(ctrl.getAnalytics));
router.get('/settlements',             asyncHandler(ctrl.listSettlements));
router.get('/settlements/:settlementId', asyncHandler(ctrl.getSettlementDetail));

// Dynamic routes after static
router.get('/:paymentId',              asyncHandler(ctrl.getPaymentDetail));
router.post('/:paymentId/refund',      asyncHandler(ctrl.initiateRefund));

module.exports = router;
