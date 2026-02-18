/**
 * Review Controller
 *
 * Handles HTTP requests for product review management.
 * Includes user, public, and admin endpoints.
 */

const mongoose = require("mongoose");
const Review = require("../models/Review");
const Product = require("../models/Product");
const InstallmentOrder = require("../models/InstallmentOrder");
const {
  asyncHandler,
  successResponse,
} = require("../middlewares/errorHandler");
const {
  uploadMultipleFilesToS3,
} = require("../services/awsUploadService");
const {
  ReviewNotFoundError,
  DuplicateReviewError,
  NotDeliveredError,
  UnauthorizedReviewAccessError,
  ReviewEditLimitExceededError,
  AlreadyVotedError,
  AlreadyReportedError,
  ProductNotFoundError,
} = require("../utils/customErrors");
const {
  autoModerateReview,
  calculateQualityScore,
} = require("../services/reviewModerationService");

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Find product by ID or productId
 */
async function findProduct(productId) {
  let product;
  if (mongoose.Types.ObjectId.isValid(productId) && productId.length === 24) {
    product = await Product.findById(productId);
  }
  if (!product) {
    product = await Product.findOne({ productId });
  }
  return product;
}

// ============================================
// USER ROUTES
// ============================================

/**
 * @route   POST /api/reviews
 * @desc    Create a new review (user must have DELIVERED order)
 * @access  Private
 */
const createReview = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const {
    productId,
    rating,
    title,
    comment,
    images = [],
    detailedRatings,
  } = req.body;

  // Validate required fields
  if (!productId || !rating || !title || !comment) {
    return res.status(400).json({
      success: false,
      message: "productId, rating, title, and comment are required",
    });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({
      success: false,
      message: "Rating must be between 1 and 5",
    });
  }

  // Find product
  const product = await findProduct(productId);
  if (!product) {
    throw new ProductNotFoundError(productId);
  }

  // Check if user can review (has DELIVERED order and no existing review)
  const { canReview, reason, order } = await Review.canUserReview(
    userId,
    product._id
  );

  if (!canReview) {
    if (reason === "NO_DELIVERED_ORDER") {
      throw new NotDeliveredError(productId);
    }
    if (reason === "ALREADY_REVIEWED") {
      throw new DuplicateReviewError(productId);
    }
  }

  // Auto-moderate the review
  const moderationResult = autoModerateReview({ title, comment, rating });

  // Get variant info from order if available
  let variantInfo = {};
  if (order.variantId) {
    variantInfo = {
      variantId: order.variantId,
      variantName: order.variantDetails?.attributes
        ? Object.values(order.variantDetails.attributes).join(" - ")
        : null,
      color: order.variantDetails?.attributes?.color || null,
      size: order.variantDetails?.attributes?.size || null,
      sku: order.variantDetails?.sku || null,
      attributes: order.variantDetails?.attributes || {},
    };
  }

  // Create review
  const review = new Review({
    user: userId,
    product: product._id,
    order: order._id,
    rating,
    title,
    comment,
    images,
    detailedRatings,
    userName: req.user.name,
    userProfilePicture: req.user.profilePicture || "",
    productName: product.name,
    productId: product.productId || product._id.toString(),
    verifiedPurchase: true,
    purchaseDate: order.createdAt,
    orderValue: order.totalProductPrice,
    variantInfo,
    status: moderationResult.isFlagged ? "flagged" : "published",
    autoModeration: {
      isFlagged: moderationResult.isFlagged,
      flagReason: moderationResult.flagReason,
      confidence: moderationResult.confidence,
    },
    createdByEmail: req.user.email,
  });

  await review.save();

  // Get updated product stats
  const ratingStats = await Review.getProductRatingStats(product._id);

  successResponse(
    res,
    {
      review,
      productStats: {
        averageRating: ratingStats.averageRating,
        totalReviews: ratingStats.totalReviews,
      },
      autoModeration: moderationResult.isFlagged
        ? {
            isFlagged: true,
            message:
              "Your review has been flagged for moderation and will be reviewed by our team.",
          }
        : null,
    },
    "Review created successfully",
    201
  );
});

/**
 * @route   GET /api/reviews/my-reviews
 * @desc    Get current user's reviews
 * @access  Private
 */
const getUserReviews = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { page = 1, limit = 10 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [reviews, total] = await Promise.all([
    Review.find({ user: userId, isDeleted: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select("-__v"),
    Review.countDocuments({ user: userId, isDeleted: false }),
  ]);

  successResponse(
    res,
    {
      reviews,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    },
    "Reviews retrieved successfully"
  );
});

/**
 * @route   GET /api/reviews/can-review/:productId
 * @desc    Check if user can review a product
 * @access  Private
 */
const canUserReviewProduct = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { productId } = req.params;

  // Find product
  const product = await findProduct(productId);
  if (!product) {
    throw new ProductNotFoundError(productId);
  }

  const result = await Review.canUserReview(userId, product._id);

  successResponse(
    res,
    {
      canReview: result.canReview,
      reason: result.reason,
      hasDeliveredOrder: !!result.order,
      existingReviewId: result.existingReview?._id || null,
    },
    "Review eligibility checked"
  );
});

/**
 * @route   PUT /api/reviews/:id
 * @desc    Update user's own review (max 3 edits)
 * @access  Private
 */
const updateReview = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;
  const { rating, title, comment, images, detailedRatings } = req.body;

  const review = await Review.findById(id);
  if (!review || review.isDeleted) {
    throw new ReviewNotFoundError(id);
  }

  if (!review.canBeEditedBy(userId)) {
    if (review.editCount >= 3) {
      throw new ReviewEditLimitExceededError(id);
    }
    throw new UnauthorizedReviewAccessError(id);
  }

  // Store old values for edit history
  const oldRating = review.rating;
  const oldTitle = review.title;
  const oldComment = review.comment;

  // Add edit history
  review.addEditHistory(oldRating, oldTitle, oldComment);

  // Update fields
  if (rating !== undefined) review.rating = rating;
  if (title !== undefined) review.title = title;
  if (comment !== undefined) review.comment = comment;
  if (images !== undefined) review.images = images;
  if (detailedRatings !== undefined) review.detailedRatings = detailedRatings;
  review.updatedByEmail = req.user.email;

  // Re-moderate if content changed
  if (title !== undefined || comment !== undefined) {
    const moderationResult = autoModerateReview({
      title: review.title,
      comment: review.comment,
      rating: review.rating,
    });

    if (moderationResult.isFlagged) {
      review.status = "flagged";
      review.autoModeration = {
        isFlagged: true,
        flagReason: moderationResult.flagReason,
        confidence: moderationResult.confidence,
      };
    }
  }

  await review.save();

  successResponse(
    res,
    {
      review,
      editsRemaining: 3 - review.editCount,
    },
    "Review updated successfully"
  );
});

/**
 * @route   DELETE /api/reviews/:id
 * @desc    Soft delete user's own review
 * @access  Private
 */
const deleteReview = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;

  const review = await Review.findById(id);
  if (!review || review.isDeleted) {
    throw new ReviewNotFoundError(id);
  }

  if (!review.canBeDeletedBy(userId, false)) {
    throw new UnauthorizedReviewAccessError(id);
  }

  const oldRating = review.rating;
  const productId = review.product;

  await review.softDelete(userId, req.user.email);

  // Update product stats (decrement)
  await Review.updateProductStatsIncremental(productId, oldRating, null, false, true);

  successResponse(res, { reviewId: id }, "Review deleted successfully");
});

/**
 * @route   POST /api/reviews/:id/vote
 * @desc    Vote on review (upvote/downvote)
 * @access  Private
 */
const voteReview = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;
  const { vote } = req.body;

  if (!vote || !["up", "down"].includes(vote)) {
    return res.status(400).json({
      success: false,
      message: "vote must be 'up' or 'down'",
    });
  }

  const review = await Review.findById(id);
  if (!review || review.isDeleted) {
    throw new ReviewNotFoundError(id);
  }

  // Check if user is trying to vote on their own review
  if (review.user.toString() === userId.toString()) {
    return res.status(400).json({
      success: false,
      message: "You cannot vote on your own review",
    });
  }

  // Add vote
  review.addVote(userId, vote);
  await review.save();

  successResponse(
    res,
    {
      reviewId: id,
      helpfulness: {
        upvotes: review.helpfulness.upvotes,
        downvotes: review.helpfulness.downvotes,
        score: review.helpfulness.score,
      },
      yourVote: vote,
    },
    `Review ${vote === "up" ? "upvoted" : "downvoted"} successfully`
  );
});

/**
 * @route   POST /api/reviews/:id/report
 * @desc    Report a review
 * @access  Private
 */
const reportReview = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;
  const { reportType, reason = "" } = req.body;

  if (!reportType || !["spam", "fake", "inappropriate", "offensive"].includes(reportType)) {
    return res.status(400).json({
      success: false,
      message: "reportType must be one of: spam, fake, inappropriate, offensive",
    });
  }

  const review = await Review.findById(id);
  if (!review || review.isDeleted) {
    throw new ReviewNotFoundError(id);
  }

  // Check if user is trying to report their own review
  if (review.user.toString() === userId.toString()) {
    return res.status(400).json({
      success: false,
      message: "You cannot report your own review",
    });
  }

  try {
    review.addReport(userId, reportType, reason);
    await review.save();

    successResponse(
      res,
      {
        reviewId: id,
        reportCount: review.reports.length,
        status: review.status,
      },
      "Review reported successfully"
    );
  } catch (error) {
    if (error.message === "You have already reported this review") {
      throw new AlreadyReportedError(id);
    }
    throw error;
  }
});

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * @route   GET /api/products/:productId/reviews
 * @desc    Get all published reviews for a product (with pagination)
 * @access  Public
 */
const getProductReviews = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const {
    page = 1,
    limit = 10,
    sort = "newest",
    rating,
    verified,
    hasImages,
    search,
  } = req.query;

  // Find product
  const product = await findProduct(productId);
  if (!product) {
    throw new ProductNotFoundError(productId);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build query
  const query = {
    product: product._id,
    status: "published",
    isDeleted: false,
  };

  // Filter by rating
  if (rating) {
    const ratings = rating.split(",").map(Number);
    query.rating = { $in: ratings };
  }

  // Filter by verified purchase
  if (verified === "true") {
    query.verifiedPurchase = true;
  }

  // Filter by has images
  if (hasImages === "true") {
    query["images.0"] = { $exists: true };
  }

  // Search in title and comment
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { comment: { $regex: search, $options: "i" } },
    ];
  }

  // Sort options
  let sortOption = { createdAt: -1 }; // default: newest
  switch (sort) {
    case "oldest":
      sortOption = { createdAt: 1 };
      break;
    case "highest":
      sortOption = { rating: -1, createdAt: -1 };
      break;
    case "lowest":
      sortOption = { rating: 1, createdAt: -1 };
      break;
    case "mostHelpful":
      sortOption = { "helpfulness.score": -1, createdAt: -1 };
      break;
  }

  const [reviews, total, ratingStats] = await Promise.all([
    Review.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .select("-__v -reports -autoModeration"),
    Review.countDocuments(query),
    Review.getProductRatingStats(product._id),
  ]);

  successResponse(
    res,
    {
      reviews,
      ratingStats,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    },
    "Product reviews retrieved successfully"
  );
});

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * @route   GET /api/reviews/admin/all
 * @desc    Get all reviews with filters
 * @access  Private (Admin)
 */
const getAllReviews = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    rating,
    productId,
    userId,
    includeDeleted = "false",
    flagged,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const query = {};

  // Filter options
  if (includeDeleted !== "true") {
    query.isDeleted = false;
  }
  if (status) query.status = status;
  if (rating) query.rating = parseInt(rating);
  if (flagged === "true") query["autoModeration.isFlagged"] = true;

  if (productId) {
    const product = await findProduct(productId);
    if (product) query.product = product._id;
  }
  if (userId) query.user = userId;

  // Sort
  const sortDirection = sortOrder === "asc" ? 1 : -1;
  const sortOption = { [sortBy]: sortDirection };

  const [reviews, total] = await Promise.all([
    Review.find(query)
      .populate("user", "name email")
      .populate("product", "name productId")
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit)),
    Review.countDocuments(query),
  ]);

  successResponse(
    res,
    {
      reviews,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    },
    "Reviews retrieved successfully"
  );
});

/**
 * @route   GET /api/reviews/admin/stats
 * @desc    Get review statistics for admin dashboard
 * @access  Private (Admin)
 */
const getReviewStats = asyncHandler(async (req, res) => {
  const stats = await Review.aggregate([
    { $match: { isDeleted: false } },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        publishedReviews: {
          $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] },
        },
        unpublishedReviews: {
          $sum: { $cond: [{ $eq: ["$status", "unpublished"] }, 1, 0] },
        },
        flaggedReviews: {
          $sum: { $cond: [{ $eq: ["$status", "flagged"] }, 1, 0] },
        },
        autoFlaggedReviews: {
          $sum: { $cond: ["$autoModeration.isFlagged", 1, 0] },
        },
        averageRating: { $avg: "$rating" },
        rating5: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
        rating4: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
        rating3: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
        rating2: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
        rating1: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } },
        totalUpvotes: { $sum: "$helpfulness.upvotes" },
        totalDownvotes: { $sum: "$helpfulness.downvotes" },
        avgQualityScore: { $avg: "$qualityMetrics.qualityScore" },
      },
    },
  ]);

  const result = stats[0] || {
    totalReviews: 0,
    publishedReviews: 0,
    unpublishedReviews: 0,
    flaggedReviews: 0,
    autoFlaggedReviews: 0,
    averageRating: 0,
    rating5: 0,
    rating4: 0,
    rating3: 0,
    rating2: 0,
    rating1: 0,
    totalUpvotes: 0,
    totalDownvotes: 0,
    avgQualityScore: 0,
  };

  // Round values
  result.averageRating = Math.round((result.averageRating || 0) * 10) / 10;
  result.avgQualityScore = Math.round(result.avgQualityScore || 0);

  successResponse(res, { stats: result }, "Review statistics retrieved");
});

/**
 * @route   GET /api/reviews/admin/flagged
 * @desc    Get auto-flagged reviews pending moderation
 * @access  Private (Admin)
 */
const getFlaggedReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const query = {
    isDeleted: false,
    $or: [
      { status: "flagged" },
      { "autoModeration.isFlagged": true },
      { "reports.0": { $exists: true } },
    ],
  };

  const [reviews, total] = await Promise.all([
    Review.find(query)
      .populate("user", "name email")
      .populate("product", "name productId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Review.countDocuments(query),
  ]);

  successResponse(
    res,
    {
      reviews,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    },
    "Flagged reviews retrieved successfully"
  );
});

/**
 * @route   PATCH /api/reviews/admin/:id/unpublish
 * @desc    Unpublish a review
 * @access  Private (Admin)
 */
const unpublishReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { moderationNote } = req.body;

  const review = await Review.findById(id);
  if (!review) {
    throw new ReviewNotFoundError(id);
  }

  review.status = "unpublished";
  review.moderationNote = moderationNote || "";
  review.moderatedBy = req.user._id;
  review.moderatedByEmail = req.user.email;
  review.moderatedAt = new Date();
  review.updatedByEmail = req.user.email;

  await review.save();

  // Update product stats
  await Review.updateProductStatsIncremental(
    review.product,
    review.rating,
    null,
    false,
    true
  );

  successResponse(res, { review }, "Review unpublished successfully");
});

/**
 * @route   PATCH /api/reviews/admin/:id/publish
 * @desc    Publish a review
 * @access  Private (Admin)
 */
const publishReview = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const review = await Review.findById(id);
  if (!review) {
    throw new ReviewNotFoundError(id);
  }

  const wasPublished = review.status === "published";
  review.status = "published";
  review.moderatedBy = req.user._id;
  review.moderatedByEmail = req.user.email;
  review.moderatedAt = new Date();
  review.updatedByEmail = req.user.email;

  // Clear auto-moderation flag
  review.autoModeration.isFlagged = false;

  await review.save();

  // Update product stats if wasn't published before
  if (!wasPublished) {
    await Review.updateProductStatsIncremental(
      review.product,
      review.rating,
      null,
      true,
      false
    );
  }

  successResponse(res, { review }, "Review published successfully");
});

/**
 * @route   DELETE /api/reviews/admin/:id
 * @desc    Admin soft delete a review
 * @access  Private (Admin)
 */
const adminDeleteReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const review = await Review.findById(id);
  if (!review) {
    throw new ReviewNotFoundError(id);
  }

  const oldRating = review.rating;
  const productId = review.product;
  const wasPublished = review.status === "published";

  review.moderationNote = reason || "Deleted by admin";
  await review.softDelete(req.user._id, req.user.email);

  // Update product stats if was published
  if (wasPublished) {
    await Review.updateProductStatsIncremental(productId, oldRating, null, false, true);
  }

  successResponse(res, { reviewId: id }, "Review deleted by admin");
});

/**
 * @route   POST /api/reviews/admin/:id/respond
 * @desc    Add seller/admin response to a review
 * @access  Private (Admin)
 */
const respondToReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({
      success: false,
      message: "Response message is required",
    });
  }

  const review = await Review.findById(id);
  if (!review) {
    throw new ReviewNotFoundError(id);
  }

  review.sellerResponse = {
    message,
    respondedBy: req.user._id,
    respondedByEmail: req.user.email,
    respondedAt: new Date(),
    isVisible: true,
  };
  review.updatedByEmail = req.user.email;

  await review.save();

  successResponse(res, { review }, "Response added successfully");
});

/**
 * @route   GET /api/reviews/admin/:id
 * @desc    Get single review details (admin view)
 * @access  Private (Admin)
 */
const getReviewDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const review = await Review.findById(id)
    .populate("user", "name email profilePicture")
    .populate("product", "name productId images pricing")
    .populate("order", "orderId status deliveryStatus totalProductPrice");

  if (!review) {
    throw new ReviewNotFoundError(id);
  }

  successResponse(res, { review }, "Review details retrieved successfully");
});

// ============================================
// IMAGE UPLOAD
// ============================================

/**
 * @route   POST /api/reviews/upload-images
 * @desc    Upload review images to S3 (max 5 images)
 * @access  Private
 *
 * Uses same flow as product image upload:
 *  multer (memoryStorage) → sharp (resize) → S3 upload → return URLs
 *
 * Frontend flow:
 *  1. User picks images → call this endpoint
 *  2. Get back S3 URLs
 *  3. Pass those URLs in POST /api/reviews body { images: [{ url, caption }] }
 */
const uploadReviewImages = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No files uploaded. Send images using 'images' field.",
    });
  }

  if (req.files.length > 5) {
    return res.status(400).json({
      success: false,
      message: "Maximum 5 images allowed per review",
    });
  }

  // Upload all files to S3 (resized to 800px width, same as product images)
  const uploadResults = await uploadMultipleFilesToS3(
    req.files,
    "reviews/",
    800
  );

  // Format response
  const images = uploadResults.map((result) => ({
    url: result.url,
    thumbnail: null,
    caption: "",
  }));

  successResponse(
    res,
    { images, count: images.length },
    "Review images uploaded successfully"
  );
});

module.exports = {
  // User routes
  createReview,
  getUserReviews,
  updateReview,
  deleteReview,
  canUserReviewProduct,
  voteReview,
  reportReview,
  uploadReviewImages,
  // Public routes
  getProductReviews,
  // Admin routes
  getAllReviews,
  getReviewStats,
  getFlaggedReviews,
  unpublishReview,
  publishReview,
  adminDeleteReview,
  respondToReview,
  getReviewDetails,
};
