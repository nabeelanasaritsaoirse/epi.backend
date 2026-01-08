const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");
const salesTeamController = require("../controllers/salesTeamController");

/**
 * Middleware: Require Sales Team or Admin role
 */
const isSalesAuthorized = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
      code: "NOT_AUTHENTICATED",
    });
  }

  // Sales team → always allowed
  if (req.user.role === "sales_team") {
    return next();
  }

  // Super admin → always allowed
  if (req.user.role === "super_admin") {
    return next();
  }

  // Sub-admin → ONLY if sales module is assigned
  if (
    req.user.role === "admin" &&
    Array.isArray(req.user.moduleAccess) &&
    (req.user.moduleAccess.includes("sales-dashboard") ||
      req.user.moduleAccess.includes("users"))
  ) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Sales module access required",
    code: "SALES_ACCESS_DENIED",
  });
};

/**
 * @route   GET /api/sales/dashboard-stats
 * @desc    Get dashboard statistics for sales team
 * @access  Sales Team, Admin, Super Admin
 */
router.get(
  "/dashboard-stats",
  verifyToken,
  isSalesAuthorized,
  salesTeamController.getDashboardStats
);

/**
 * @route   GET /api/sales/users
 * @desc    Get all users with Level 1 referral counts
 * @access  Sales Team, Admin, Super Admin
 */
router.get(
  "/users",
  verifyToken,
  isSalesAuthorized,
  salesTeamController.getAllUsersWithReferrals
);

/**
 * @route   GET /api/sales/users/:userId
 * @desc    Get user detail with Level 1 & Level 2 referrals, wishlist, cart, orders
 * @access  Sales Team, Admin, Super Admin
 */
router.get(
  "/users/:userId",
  verifyToken,
  isSalesAuthorized,
  salesTeamController.getUserDetail
);

/**
 * @route   GET /api/sales/users/:userId/orders
 * @desc    Get user's order history
 * @access  Sales Team, Admin, Super Admin
 */
router.get(
  "/users/:userId/orders",
  verifyToken,
  isSalesAuthorized,
  salesTeamController.getUserOrders
);

/**
 * @route   GET /api/sales/users/:userId/wishlist
 * @desc    Get user's wishlist
 * @access  Sales Team, Admin, Super Admin
 */
router.get(
  "/users/:userId/wishlist",
  verifyToken,
  isSalesAuthorized,
  salesTeamController.getUserWishlist
);

/**
 * @route   GET /api/sales/users/:userId/cart
 * @desc    Get user's cart
 * @access  Sales Team, Admin, Super Admin
 */
router.get(
  "/users/:userId/cart",
  verifyToken,
  isSalesAuthorized,
  salesTeamController.getUserCart
);

module.exports = router;
