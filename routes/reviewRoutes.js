/**
 * Review Routes
 *
 * All routes for product review management.
 * Includes user, public, and admin routes.
 */

const express = require("express");
const router = express.Router();

// Import middleware
const { verifyToken, isAdmin } = require("../middlewares/auth");
const { uploadMultiple } = require("../middlewares/uploadMiddleware");

// Import controller
const reviewController = require("../controllers/reviewController");

// ============================================
// USER ROUTES (requires authentication)
// ============================================

/**
 * @route   POST /api/reviews/upload-images
 * @desc    Upload review images to S3 (max 5 images)
 * @access  Private
 *
 * Flow: Upload images here first → get S3 URLs → pass URLs in POST /api/reviews
 *
 * @formData images - Image files (max 5, accepts jpg/png/webp, max 10MB each)
 *
 * @returns {
 *   images: [{ url: string, thumbnail: null, caption: "" }],
 *   count: number
 * }
 */
router.post(
  "/upload-images",
  verifyToken,
  uploadMultiple,
  reviewController.uploadReviewImages
);

/**
 * @route   POST /api/reviews
 * @desc    Create a new review
 * @access  Private
 *
 * @body {
 *   productId: string (required) - Product ID or MongoDB _id
 *   rating: number (required) - Rating 1-5
 *   title: string (required) - Review title (max 200 chars)
 *   comment: string (required) - Review comment (max 2000 chars)
 *   images: array (optional) - Array of image objects [{url, caption}]
 *   detailedRatings: object (optional) - {quality, valueForMoney, delivery, accuracy}
 * }
 */
router.post("/", verifyToken, reviewController.createReview);

/**
 * @route   GET /api/reviews/my-reviews
 * @desc    Get current user's reviews
 * @access  Private
 *
 * @query {
 *   page: number (default: 1)
 *   limit: number (default: 10)
 * }
 */
router.get("/my-reviews", verifyToken, reviewController.getUserReviews);

/**
 * @route   GET /api/reviews/can-review/:productId
 * @desc    Check if user can review a product
 * @access  Private
 */
router.get(
  "/can-review/:productId",
  verifyToken,
  reviewController.canUserReviewProduct
);

/**
 * @route   PUT /api/reviews/:id
 * @desc    Update user's own review (max 3 edits)
 * @access  Private
 *
 * @body {
 *   rating: number (optional)
 *   title: string (optional)
 *   comment: string (optional)
 *   images: array (optional)
 *   detailedRatings: object (optional)
 * }
 */
router.put("/:id", verifyToken, reviewController.updateReview);

/**
 * @route   DELETE /api/reviews/:id
 * @desc    Soft delete user's own review
 * @access  Private
 */
router.delete("/:id", verifyToken, reviewController.deleteReview);

/**
 * @route   POST /api/reviews/:id/vote
 * @desc    Vote on a review (upvote/downvote)
 * @access  Private
 *
 * @body {
 *   vote: 'up' | 'down' (required)
 * }
 */
router.post("/:id/vote", verifyToken, reviewController.voteReview);

/**
 * @route   POST /api/reviews/:id/report
 * @desc    Report a review
 * @access  Private
 *
 * @body {
 *   reportType: 'spam' | 'fake' | 'inappropriate' | 'offensive' (required)
 *   reason: string (optional) - Additional details
 * }
 */
router.post("/:id/report", verifyToken, reviewController.reportReview);

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * @route   GET /api/reviews/admin/all
 * @desc    Get all reviews with filters
 * @access  Private (Admin)
 *
 * @query {
 *   page: number (default: 1)
 *   limit: number (default: 20)
 *   status: 'published' | 'unpublished' | 'draft' | 'flagged' (optional)
 *   rating: number 1-5 (optional)
 *   productId: string (optional)
 *   userId: string (optional)
 *   includeDeleted: 'true' | 'false' (default: false)
 *   flagged: 'true' (optional) - Show auto-flagged reviews
 *   sortBy: 'createdAt' | 'rating' | 'helpfulness.score' (default: createdAt)
 *   sortOrder: 'asc' | 'desc' (default: desc)
 * }
 */
router.get("/admin/all", verifyToken, isAdmin, reviewController.getAllReviews);

/**
 * @route   GET /api/reviews/admin/stats
 * @desc    Get review statistics for dashboard
 * @access  Private (Admin)
 */
router.get("/admin/stats", verifyToken, isAdmin, reviewController.getReviewStats);

/**
 * @route   GET /api/reviews/admin/flagged
 * @desc    Get auto-flagged reviews pending moderation
 * @access  Private (Admin)
 *
 * @query {
 *   page: number (default: 1)
 *   limit: number (default: 20)
 * }
 */
router.get(
  "/admin/flagged",
  verifyToken,
  isAdmin,
  reviewController.getFlaggedReviews
);

/**
 * @route   GET /api/reviews/admin/:id
 * @desc    Get single review details (admin view)
 * @access  Private (Admin)
 */
router.get(
  "/admin/:id",
  verifyToken,
  isAdmin,
  reviewController.getReviewDetails
);

/**
 * @route   PATCH /api/reviews/admin/:id/unpublish
 * @desc    Unpublish a review
 * @access  Private (Admin)
 *
 * @body {
 *   moderationNote: string (optional) - Reason for unpublishing
 * }
 */
router.patch(
  "/admin/:id/unpublish",
  verifyToken,
  isAdmin,
  reviewController.unpublishReview
);

/**
 * @route   PATCH /api/reviews/admin/:id/publish
 * @desc    Publish a review
 * @access  Private (Admin)
 */
router.patch(
  "/admin/:id/publish",
  verifyToken,
  isAdmin,
  reviewController.publishReview
);

/**
 * @route   POST /api/reviews/admin/:id/respond
 * @desc    Add seller/admin response to a review
 * @access  Private (Admin)
 *
 * @body {
 *   message: string (required) - Response message
 * }
 */
router.post(
  "/admin/:id/respond",
  verifyToken,
  isAdmin,
  reviewController.respondToReview
);

/**
 * @route   DELETE /api/reviews/admin/:id
 * @desc    Admin delete a review
 * @access  Private (Admin)
 *
 * @body {
 *   reason: string (optional) - Reason for deletion
 * }
 */
router.delete(
  "/admin/:id",
  verifyToken,
  isAdmin,
  reviewController.adminDeleteReview
);

module.exports = router;
