const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const auth = require('../middlewares/auth');

/**
 * PUBLIC ROUTE
 * GET all active coupons
 */
router.get('/', couponController.getCoupons);

/**
 * USER ROUTES (requires authentication)
 */
router.post('/validate', couponController.validateCoupon);
router.get('/user/my-coupons', auth.verifyToken, couponController.getUserCoupons);

/**
 * ADMIN ROUTES
 */

// Basic CRUD
router.post('/admin/create', auth.verifyToken, auth.isAdmin, couponController.createCoupon);
router.get('/admin/all', auth.verifyToken, auth.isAdmin, couponController.getCoupons);
router.get('/admin/:id', auth.verifyToken, auth.isAdmin, couponController.getCouponById);
router.put('/admin/update/:id', auth.verifyToken, auth.isAdmin, couponController.updateCoupon);
router.delete('/admin/delete/:id', auth.verifyToken, auth.isAdmin, couponController.deleteCoupon);

// Usage tracking
router.get('/admin/usage/:id', auth.verifyToken, auth.isAdmin, couponController.getCouponUsage);

// Referral coupons
router.post('/admin/create-referral-coupon', auth.verifyToken, auth.isAdmin, couponController.createReferralCoupon);

// Auto-generated codes
router.post('/admin/generate-personal-codes', auth.verifyToken, auth.isAdmin, couponController.generatePersonalCodes);
router.post('/admin/generate-bulk-codes', auth.verifyToken, auth.isAdmin, couponController.generateBulkCodes);
router.get('/admin/child-coupons/:id', auth.verifyToken, auth.isAdmin, couponController.getChildCoupons);

module.exports = router;
