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

// ========== MY TEAM ROUTES (Sales Person's Own Referral Data) ==========

/**
 * @route   GET /api/sales/my-team
 * @desc    Get logged-in user's direct referrals (L1 team members)
 * @access  Sales Team, Admin, Super Admin
 */
router.get('/my-team', verifyToken, isSalesTeamOrAdmin, salesTeamController.getMyTeam);

/**
 * @route   GET /api/sales/my-team/users
 * @desc    Get all users in logged-in user's referral chain (L1 + L2)
 * @access  Sales Team, Admin, Super Admin
 */
router.get('/my-team/users', verifyToken, isSalesTeamOrAdmin, salesTeamController.getMyTeamUsers);

/**
 * @route   GET /api/sales/my-stats
 * @desc    Get dashboard stats for logged-in user's team only
 * @access  Sales Team, Admin, Super Admin
 */
router.get('/my-stats', verifyToken, isSalesTeamOrAdmin, salesTeamController.getMyStats);

/**
 * @route   GET /api/sales/my-opportunities
 * @desc    Get hot leads from logged-in user's referral chain
 * @access  Sales Team, Admin, Super Admin
 */
router.get('/my-opportunities', verifyToken, isSalesTeamOrAdmin, salesTeamController.getMyOpportunities);

/**
 * @route   GET /api/sales/my-activity
 * @desc    Get recent activity feed from logged-in user's team
 * @access  Sales Team, Admin, Super Admin
 */
router.get('/my-activity', verifyToken, isSalesTeamOrAdmin, salesTeamController.getMyActivity);

/**
 * @route   GET /api/sales/my-leaderboard
 * @desc    Get top performers in logged-in user's team
 * @access  Sales Team, Admin, Super Admin
 */
router.get('/my-leaderboard', verifyToken, isSalesTeamOrAdmin, salesTeamController.getMyLeaderboard);

/**
 * @route   GET /api/sales/my-trends
 * @desc    Get time-series data for charts (logged-in user's team)
 * @access  Sales Team, Admin, Super Admin
 */
router.get('/my-trends', verifyToken, isSalesTeamOrAdmin, salesTeamController.getMyTrends);

/**
 * @route   GET /api/sales/my-team/:userId
 * @desc    Get detail view of specific team member (must be in L1/L2 chain)
 * @access  Sales Team, Admin, Super Admin
 */
router.get('/my-team/:userId', verifyToken, isSalesTeamOrAdmin, salesTeamController.getMyTeamMemberDetail);

// ========== GLOBAL ROUTES (All Users - Existing) ==========

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
