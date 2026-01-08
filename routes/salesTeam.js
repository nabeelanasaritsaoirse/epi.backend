const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const salesTeamController = require('../controllers/salesTeamController');

/**
 * Middleware: Require Sales Team or Admin role
 */
const isSalesTeamOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'NOT_AUTHENTICATED'
    });
  }

  const allowedRoles = ['sales_team', 'admin', 'super_admin'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Sales team role required.',
      code: 'SALES_TEAM_REQUIRED'
    });
  }

  next();
};

/**
 * @route   GET /api/sales/dashboard-stats
 * @desc    Get dashboard statistics for sales team
 * @access  Sales Team, Admin, Super Admin
 */
router.get('/dashboard-stats', verifyToken, isSalesTeamOrAdmin, salesTeamController.getDashboardStats);

/**
 * @route   GET /api/sales/users
 * @desc    Get all users with Level 1 referral counts
 * @access  Sales Team, Admin, Super Admin
 */
router.get('/users', verifyToken, isSalesTeamOrAdmin, salesTeamController.getAllUsersWithReferrals);

/**
 * @route   GET /api/sales/users/:userId
 * @desc    Get user detail with Level 1 & Level 2 referrals, wishlist, cart, orders
 * @access  Sales Team, Admin, Super Admin
 */
router.get('/users/:userId', verifyToken, isSalesTeamOrAdmin, salesTeamController.getUserDetail);

/**
 * @route   GET /api/sales/users/:userId/orders
 * @desc    Get user's order history
 * @access  Sales Team, Admin, Super Admin
 */
router.get('/users/:userId/orders', verifyToken, isSalesTeamOrAdmin, salesTeamController.getUserOrders);

/**
 * @route   GET /api/sales/users/:userId/wishlist
 * @desc    Get user's wishlist
 * @access  Sales Team, Admin, Super Admin
 */
router.get('/users/:userId/wishlist', verifyToken, isSalesTeamOrAdmin, salesTeamController.getUserWishlist);

/**
 * @route   GET /api/sales/users/:userId/cart
 * @desc    Get user's cart
 * @access  Sales Team, Admin, Super Admin
 */
router.get('/users/:userId/cart', verifyToken, isSalesTeamOrAdmin, salesTeamController.getUserCart);

module.exports = router;
