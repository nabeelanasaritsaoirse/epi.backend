const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const auth = require('../middlewares/auth');

/**
 * PUBLIC ROUTE
 * GET all coupons
 */
router.get('/', couponController.getCoupons);

/**
 * ADMIN ROUTES
 */
router.post('/admin/create', auth.verifyToken, auth.isAdmin, couponController.createCoupon);
router.get('/admin/all', auth.verifyToken, auth.isAdmin, couponController.getCoupons);
router.delete('/admin/delete/:id', auth.verifyToken, auth.isAdmin, couponController.deleteCoupon);

/**
 * USER ROUTE
 */
router.post('/validate', couponController.validateCoupon);

module.exports = router;
