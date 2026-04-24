// routes/adminReferralRoutes.js
const express = require("express");
const router = express.Router();
const adminReferralController = require("../controllers/adminReferralController");
const { verifyToken, isAdmin } = require("../middlewares/auth");

/**
 * @route   GET /api/admin/referrals/user
 * @desc    Get user referral details by phone number or email
 * @access  Admin
 * @query   phone or email
 * @example /api/admin/referrals/user?phone=1234567890
 * @example /api/admin/referrals/user?email=user@example.com
 */
router.get(
  "/user",
  verifyToken,
  isAdmin,
  adminReferralController.getUserReferralDetails
);

/**
 * @route   GET /api/admin/referrals/user/:userId
 * @desc    Get user referral details by user ID
 * @access  Admin
 * @param   userId - MongoDB ObjectId of the user
 */
router.get(
  "/user/:userId",
  verifyToken,
  isAdmin,
  adminReferralController.getUserReferralDetailsById
);

/**
 * @route   GET /api/admin/referrals/all-users
 * @desc    Get all users with referral statistics
 * @access  Admin
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 20)
 * @query   search - Search by name, email, phone, or referral code
 * @example /api/admin/referrals/all-users?page=1&limit=20
 * @example /api/admin/referrals/all-users?search=john
 */
router.get(
  "/all-users",
  verifyToken,
  isAdmin,
  adminReferralController.getAllUsersWithReferrals
);

/**
 * @route   PUT /api/admin/referrals/user/:userId/referrer
 * @desc    Update user's referral relationship (change who referred them)
 * @access  Admin
 * @param   userId - MongoDB ObjectId of the user whose referrer needs to be changed
 * @body    newReferrerId - MongoDB ObjectId of the new referrer (or null to remove)
 * @body    reason - Reason for changing the referrer (optional, for audit logging)
 * @example PUT /api/admin/referrals/user/507f1f77bcf86cd799439011/referrer
 *          Body: { "newReferrerId": "507f1f77bcf86cd799439012", "reason": "Correcting user mistake" }
 */
router.put(
  "/user/:userId/referrer",
  verifyToken,
  isAdmin,
  adminReferralController.updateUserReferrer
);

module.exports = router;
