const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const auth = require('../middlewares/auth');

/**
 * POST /api/admin/coupon/create
 * Create a new coupon (admin only)
 */
router.post('/admin/coupon/create', auth.verifyToken, auth.isAdmin, couponController.createCoupon);

/**
 * GET /api/admin/coupon/all
 * Get all coupons (admin only)
 */
router.get('/admin/coupon/all', auth.verifyToken, auth.isAdmin, couponController.getCoupons);

/**
 * POST /api/coupon/validate
 * Validate and calculate discount for a coupon (user)
 */
router.post('/coupon/validate', couponController.validateCoupon);

/**
 * DELETE /api/admin/coupon/delete/:id
 * Delete a coupon by ID (admin only)
 */
router.delete('/admin/coupon/delete/:id', auth.verifyToken, auth.isAdmin, couponController.deleteCoupon);

module.exports = router;
