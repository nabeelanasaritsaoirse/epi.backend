/**
 * Review Model (Enterprise Grade)
 *
 * Product review system with:
 * - Delivery verification (only DELIVERED orders can review)
 * - One review per user per product
 * - Helpfulness voting
 * - Detailed aspect ratings
 * - Auto-moderation
 * - Admin moderation
 * - Seller responses
 */

const mongoose = require("mongoose");

/**
 * Review Image Schema
 */
const reviewImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    thumbnail: { type: String, default: null },
    caption: { type: String, default: "" },
    uploadedAt: { type: Date, default: Date.now },
    isProcessed: { type: Boolean, default: false },
  },
  { _id: false }
);

/**
 * Voter Schema (for helpfulness voting)
 */
const voterSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    vote: {
      type: String,
      enum: ["up", "down"],
      required: true,
    },
    votedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/**
 * Report Schema (user-generated flags)
 */
const reportSchema = new mongoose.Schema(
  {
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reportType: {
      type: String,
      enum: ["spam", "fake", "inappropriate", "offensive"],
      required: true,
    },
    reason: { type: String, default: "" },
    reportedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/**
 * Edit History Schema
 */
const editHistorySchema = new mongoose.Schema(
  {
    editedAt: { type: Date, default: Date.now },
    oldRating: { type: Number },
    oldComment: { type: String },
    oldTitle: { type: String },
  },
  { _id: false }
);

/**
 * Review Schema
 */
const reviewSchema = new mongoose.Schema(
  {
    /** REFERENCES **/
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InstallmentOrder",
      required: true,
    },

    /** BASIC REVIEW **/
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    /** DETAILED ASPECT RATINGS **/
    detailedRatings: {
      quality: { type: Number, min: 1, max: 5 },
      valueForMoney: { type: Number, min: 1, max: 5 },
      delivery: { type: Number, min: 1, max: 5 },
      accuracy: { type: Number, min: 1, max: 5 },
    },

    /** MEDIA **/
    images: [reviewImageSchema],

    /** DENORMALIZED USER INFO (avoid populates) **/
    userName: { type: String, required: true },
    userProfilePicture: { type: String, default: "" },

    /** DENORMALIZED PRODUCT INFO **/
    productName: { type: String, required: true },
    productId: { type: String, required: true },

    /** VERIFIED PURCHASE & ORDER INFO **/
    verifiedPurchase: { type: Boolean, default: true },
    purchaseDate: { type: Date },
    orderValue: { type: Number },

    /** PRODUCT VARIANT INFO **/
    variantInfo: {
      variantId: { type: String, default: null },
      variantName: { type: String, default: null },
      color: { type: String, default: null },
      size: { type: String, default: null },
      sku: { type: String, default: null },
      attributes: { type: Object, default: {} },
    },

    /** STATUS **/
    status: {
      type: String,
      enum: ["published", "unpublished", "draft", "flagged"],
      default: "published",
      index: true,
    },

    /** HELPFULNESS VOTING **/
    helpfulness: {
      upvotes: { type: Number, default: 0 },
      downvotes: { type: Number, default: 0 },
      score: { type: Number, default: 0 },
      voters: [voterSchema],
    },

    /** SELLER/ADMIN RESPONSE **/
    sellerResponse: {
      message: { type: String, default: null },
      respondedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      respondedByEmail: { type: String, default: null },
      respondedAt: { type: Date, default: null },
      isVisible: { type: Boolean, default: true },
    },

    /** QUALITY METRICS (calculated) **/
    qualityMetrics: {
      wordCount: { type: Number, default: 0 },
      hasImages: { type: Boolean, default: false },
      hasDetailedRatings: { type: Boolean, default: false },
      qualityScore: { type: Number, default: 0, min: 0, max: 100 },
    },

    /** AUTO-MODERATION **/
    autoModeration: {
      isFlagged: { type: Boolean, default: false },
      flagReason: { type: String, default: null },
      confidence: { type: Number, default: 0 },
    },

    /** USER REPORTS **/
    reports: [reportSchema],

    /** EDIT HISTORY **/
    editHistory: [editHistorySchema],
    editCount: { type: Number, default: 0, max: 3 },

    /** ADMIN MODERATION **/
    moderationNote: { type: String, default: "" },
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    moderatedByEmail: { type: String, default: null },
    moderatedAt: { type: Date, default: null },

    /** SOFT DELETE **/
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deletedByEmail: { type: String, default: null },

    /** AUDIT TRAIL **/
    createdByEmail: { type: String, index: true },
    updatedByEmail: { type: String },
  },
  { timestamps: true }
);

// ============================================
// INDEXES FOR PERFORMANCE
// ============================================

// Unique constraint: one review per user per product
reviewSchema.index(
  { user: 1, product: 1, isDeleted: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false },
  }
);

// For product reviews listing (with pagination)
reviewSchema.index({ product: 1, status: 1, isDeleted: 1, createdAt: -1 });

// For user's own reviews
reviewSchema.index({ user: 1, isDeleted: 1, createdAt: -1 });

// For admin queries
reviewSchema.index({ status: 1, isDeleted: 1, createdAt: -1 });

// For most helpful sort
reviewSchema.index({ product: 1, "helpfulness.score": -1 });

// For flagged reviews
reviewSchema.index({ status: 1, "autoModeration.isFlagged": 1 });

// For verified reviews filter
reviewSchema.index({ verifiedPurchase: 1, rating: -1 });

// ============================================
// PRE-SAVE MIDDLEWARE
// ============================================

reviewSchema.pre("save", function (next) {
  // Calculate quality metrics
  if (this.isModified("comment") || this.isModified("images") || this.isNew) {
    this.qualityMetrics = {
      wordCount: this.comment ? this.comment.split(/\s+/).length : 0,
      hasImages: this.images && this.images.length > 0,
      hasDetailedRatings: !!(
        this.detailedRatings?.quality ||
        this.detailedRatings?.valueForMoney ||
        this.detailedRatings?.delivery ||
        this.detailedRatings?.accuracy
      ),
      qualityScore: this.calculateQualityScore(),
    };
  }

  // Update helpfulness score
  if (this.isModified("helpfulness.upvotes") || this.isModified("helpfulness.downvotes")) {
    this.helpfulness.score =
      (this.helpfulness.upvotes || 0) - (this.helpfulness.downvotes || 0);
  }

  next();
});

// ============================================
// INSTANCE METHODS
// ============================================

/**
 * Calculate quality score (0-100)
 */
reviewSchema.methods.calculateQualityScore = function () {
  let score = 0;

  // Word count (max 30 points)
  const wordCount = this.comment ? this.comment.split(/\s+/).length : 0;
  if (wordCount >= 50) score += 30;
  else if (wordCount >= 20) score += 20;
  else if (wordCount >= 10) score += 10;

  // Has images (25 points)
  if (this.images && this.images.length > 0) score += 25;

  // Has detailed ratings (25 points)
  if (
    this.detailedRatings?.quality ||
    this.detailedRatings?.valueForMoney ||
    this.detailedRatings?.delivery ||
    this.detailedRatings?.accuracy
  ) {
    score += 25;
  }

  // Has title (20 points)
  if (this.title && this.title.length >= 10) score += 20;

  return Math.min(score, 100);
};

/**
 * Check if user can edit this review
 */
reviewSchema.methods.canBeEditedBy = function (userId) {
  return (
    this.user.toString() === userId.toString() &&
    !this.isDeleted &&
    this.editCount < 3
  );
};

/**
 * Check if user can delete this review
 */
reviewSchema.methods.canBeDeletedBy = function (userId, isAdmin = false) {
  if (isAdmin) return true;
  return this.user.toString() === userId.toString() && !this.isDeleted;
};

/**
 * Soft delete the review
 */
reviewSchema.methods.softDelete = async function (deletedBy, deletedByEmail) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  this.deletedByEmail = deletedByEmail;
  return this.save();
};

/**
 * Add edit history
 */
reviewSchema.methods.addEditHistory = function (oldRating, oldTitle, oldComment) {
  if (this.editCount >= 3) {
    throw new Error("Maximum edit limit (3) reached");
  }

  this.editHistory.push({
    editedAt: new Date(),
    oldRating,
    oldTitle,
    oldComment,
  });

  this.editCount += 1;
};

/**
 * Check if user has already voted
 */
reviewSchema.methods.hasUserVoted = function (userId) {
  if (!this.helpfulness?.voters) return null;

  const existingVote = this.helpfulness.voters.find(
    (v) => v.user.toString() === userId.toString()
  );

  return existingVote ? existingVote.vote : null;
};

/**
 * Add or update vote
 */
reviewSchema.methods.addVote = function (userId, vote) {
  if (!this.helpfulness) {
    this.helpfulness = { upvotes: 0, downvotes: 0, score: 0, voters: [] };
  }

  const existingVoteIndex = this.helpfulness.voters.findIndex(
    (v) => v.user.toString() === userId.toString()
  );

  if (existingVoteIndex !== -1) {
    const existingVote = this.helpfulness.voters[existingVoteIndex].vote;

    // Remove old vote count
    if (existingVote === "up") this.helpfulness.upvotes--;
    else if (existingVote === "down") this.helpfulness.downvotes--;

    // Update vote
    this.helpfulness.voters[existingVoteIndex].vote = vote;
    this.helpfulness.voters[existingVoteIndex].votedAt = new Date();
  } else {
    // Add new vote
    this.helpfulness.voters.push({
      user: userId,
      vote,
      votedAt: new Date(),
    });
  }

  // Add new vote count
  if (vote === "up") this.helpfulness.upvotes++;
  else if (vote === "down") this.helpfulness.downvotes++;

  // Update score
  this.helpfulness.score = this.helpfulness.upvotes - this.helpfulness.downvotes;
};

/**
 * Add report
 */
reviewSchema.methods.addReport = function (reportedBy, reportType, reason = "") {
  if (!this.reports) this.reports = [];

  // Check if user already reported
  const alreadyReported = this.reports.some(
    (r) => r.reportedBy.toString() === reportedBy.toString()
  );

  if (alreadyReported) {
    throw new Error("You have already reported this review");
  }

  this.reports.push({
    reportedBy,
    reportType,
    reason,
    reportedAt: new Date(),
  });

  // Auto-unpublish if 5+ reports
  if (this.reports.length >= 5 && this.status === "published") {
    this.status = "flagged";
  }
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Check if user can review a product
 */
reviewSchema.statics.canUserReview = async function (userId, productId) {
  const InstallmentOrder = require("./InstallmentOrder");

  // Check for delivered order
  const deliveredOrder = await InstallmentOrder.findOne({
    user: userId,
    product: productId,
    deliveryStatus: "DELIVERED",
    status: { $ne: "CANCELLED" },
  });

  if (!deliveredOrder) {
    return { canReview: false, reason: "NO_DELIVERED_ORDER", order: null };
  }

  // Check if already reviewed
  const existingReview = await this.findOne({
    user: userId,
    product: productId,
    isDeleted: false,
  });

  if (existingReview) {
    return {
      canReview: false,
      reason: "ALREADY_REVIEWED",
      order: deliveredOrder,
      existingReview,
    };
  }

  return { canReview: true, reason: null, order: deliveredOrder };
};

/**
 * Get product rating stats
 */
reviewSchema.statics.getProductRatingStats = async function (productId) {
  const stats = await this.aggregate([
    {
      $match: {
        product: new mongoose.Types.ObjectId(productId),
        status: "published",
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
        rating5: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
        rating4: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
        rating3: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
        rating2: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
        rating1: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } },
        avgQuality: { $avg: "$detailedRatings.quality" },
        avgValueForMoney: { $avg: "$detailedRatings.valueForMoney" },
        avgDelivery: { $avg: "$detailedRatings.delivery" },
        avgAccuracy: { $avg: "$detailedRatings.accuracy" },
      },
    },
  ]);

  if (stats.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      aspectRatings: {
        quality: 0,
        valueForMoney: 0,
        delivery: 0,
        accuracy: 0,
      },
    };
  }

  const result = stats[0];
  return {
    averageRating: Math.round(result.averageRating * 10) / 10,
    totalReviews: result.totalReviews,
    ratingDistribution: {
      5: result.rating5,
      4: result.rating4,
      3: result.rating3,
      2: result.rating2,
      1: result.rating1,
    },
    aspectRatings: {
      quality: result.avgQuality ? Math.round(result.avgQuality * 10) / 10 : 0,
      valueForMoney: result.avgValueForMoney
        ? Math.round(result.avgValueForMoney * 10) / 10
        : 0,
      delivery: result.avgDelivery
        ? Math.round(result.avgDelivery * 10) / 10
        : 0,
      accuracy: result.avgAccuracy
        ? Math.round(result.avgAccuracy * 10) / 10
        : 0,
    },
  };
};

/**
 * Update product stats incrementally (O(1) performance)
 */
reviewSchema.statics.updateProductStatsIncremental = async function (
  productId,
  newRating,
  oldRating = null,
  isNew = true,
  isDelete = false
) {
  const Product = require("./Product");

  const product = await Product.findById(productId);
  if (!product) return;

  // Initialize reviewStats if not exists
  if (!product.reviewStats) {
    product.reviewStats = {
      averageRating: 0,
      totalReviews: 0,
      aspectRatings: { quality: 0, valueForMoney: 0, delivery: 0, accuracy: 0 },
      ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    };
  }

  const stats = product.reviewStats;
  const oldAvg = stats.averageRating || 0;
  const totalCount = stats.totalReviews || 0;

  if (isNew && !isDelete) {
    // Adding new review
    const newTotal = totalCount + 1;
    const newAvg = (oldAvg * totalCount + newRating) / newTotal;
    stats.averageRating = Math.round(newAvg * 10) / 10;
    stats.totalReviews = newTotal;
    stats.ratingDistribution[newRating] =
      (stats.ratingDistribution[newRating] || 0) + 1;
  } else if (!isNew && !isDelete && oldRating !== null) {
    // Updating existing review
    if (totalCount > 0) {
      const newAvg = (oldAvg * totalCount - oldRating + newRating) / totalCount;
      stats.averageRating = Math.round(newAvg * 10) / 10;
      stats.ratingDistribution[oldRating] = Math.max(
        0,
        (stats.ratingDistribution[oldRating] || 0) - 1
      );
      stats.ratingDistribution[newRating] =
        (stats.ratingDistribution[newRating] || 0) + 1;
    }
  } else if (isDelete) {
    // Deleting review
    const newTotal = Math.max(0, totalCount - 1);
    if (newTotal > 0) {
      const newAvg = (oldAvg * totalCount - newRating) / newTotal;
      stats.averageRating = Math.round(newAvg * 10) / 10;
    } else {
      stats.averageRating = 0;
    }
    stats.totalReviews = newTotal;
    stats.ratingDistribution[newRating] = Math.max(
      0,
      (stats.ratingDistribution[newRating] || 0) - 1
    );
  }

  await product.save();
};

// ============================================
// POST-SAVE HOOK
// ============================================

reviewSchema.post("save", async function (doc) {
  try {
    // Only update stats for published reviews
    if (doc.status === "published" && !doc.isDeleted) {
      // Get full stats (for aspect ratings)
      const stats = await doc.constructor.getProductRatingStats(doc.product);
      const Product = require("./Product");
      await Product.findByIdAndUpdate(doc.product, {
        "reviewStats.averageRating": stats.averageRating,
        "reviewStats.totalReviews": stats.totalReviews,
        "reviewStats.ratingDistribution": stats.ratingDistribution,
        "reviewStats.aspectRatings": stats.aspectRatings,
      });
    }
  } catch (error) {
    console.error("Error updating product rating cache:", error);
  }
});

module.exports = mongoose.model("Review", reviewSchema);
