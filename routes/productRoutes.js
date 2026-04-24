const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const productFeaturedController = require("../controllers/productFeaturedController");
const reviewController = require("../controllers/reviewController");
const { uploadMultiple } = require("../middlewares/uploadMiddleware");
const { verifyToken, isAdmin, optionalAuth } = require("../middlewares/auth");
const { detectCountryWithCache } = require("../middlewares/countryMiddleware");

// ============================================
// ADMIN ROUTES (With authentication)
// ============================================
router.get(
  "/admin/all",
  verifyToken,
  isAdmin,
  productController.getAllProductsForAdmin
);

// Admin-only low-stock endpoint
router.get(
  "/admin/low-stock",
  verifyToken,
  isAdmin,
  productController.getLowStockProducts
);

// ============================================
// EXPORT ROUTE (Must be BEFORE generic routes)
// ============================================
router.get("/export", verifyToken, isAdmin, productController.exportProducts);

// ============================================
// BULK OPERATIONS — MUST BE BEFORE /:productId
// ============================================
router.post(
  "/bulk",
  verifyToken,
  isAdmin,
  productController.bulkCreateProducts
);
router.patch(
  "/bulk/status",
  verifyToken,
  isAdmin,
  productController.bulkUpdateProductStatus
);
router.delete(
  "/bulk",
  verifyToken,
  isAdmin,
  productController.bulkDeleteProducts
);
router.post(
  "/bulk/mark-products",
  verifyToken,
  isAdmin,
  productFeaturedController.bulkMarkProducts
);
router.post(
  "/bulk/regional-pricing",
  verifyToken,
  isAdmin,
  productController.bulkUpdateRegionalPricing
);

// Force-refresh exchange rates + recalculate non-overridden regional prices
// Must be BEFORE /:productId wildcard
router.post(
  "/sync-exchange-rates",
  verifyToken,
  isAdmin,
  productController.syncExchangeRates
);

// ============================================
// BASIC PRODUCT ROUTES (With auto country detection for mobile users)
// ============================================
router.post("/", verifyToken, isAdmin, productController.createProduct);
router.get(
  "/",
  optionalAuth,
  detectCountryWithCache,
  productController.getAllProducts
);
router.get(
  "/stats",
  optionalAuth,
  detectCountryWithCache,
  productController.getProductStats
);
router.get(
  "/search",
  optionalAuth,
  detectCountryWithCache,
  productController.searchProductsAdvanced
);
// Public low-stock (kept for backward compatibility; admin version above has stricter auth)
router.get(
  "/low-stock",
  optionalAuth,
  detectCountryWithCache,
  productController.getLowStockProducts
);

// ============================================
// SLUG LOOKUP — MUST BE BEFORE /:productId
// ============================================
router.get(
  "/slug/:slug",
  optionalAuth,
  detectCountryWithCache,
  productController.getProductBySlug
);

// ============================================
// FEATURED PRODUCT ROUTES (With auto country detection)
// ============================================
// Generic /featured alias (required by spec)
router.get(
  "/featured",
  optionalAuth,
  detectCountryWithCache,
  productController.getFeaturedProducts
);
router.get(
  "/featured/all",
  detectCountryWithCache,
  productFeaturedController.getAllFeaturedProducts
);
router.get(
  "/featured/popular",
  detectCountryWithCache,
  productFeaturedController.getMostPopularProducts
);
router.get(
  "/featured/best-sellers",
  detectCountryWithCache,
  productFeaturedController.getBestSellerProducts
);
router.get(
  "/featured/trending",
  detectCountryWithCache,
  productFeaturedController.getTrendingProducts
);

// ============================================
// CATEGORY + PROJECT ROUTES (With auto country detection)
// ============================================
router.get(
  "/category/:category",
  detectCountryWithCache,
  productController.getProductsByCategory
);
router.get(
  "/project/:projectId",
  detectCountryWithCache,
  productController.getProductsByProject
);
// products routes
router.get(
  "/category/:categoryId",
  detectCountryWithCache,
  productController.getProductsByCategoryId
);

// ============================================
// REGION ROUTES — MUST BE ABOVE ANY :productId ROUTE
// ============================================
router.get("/region/:region", productController.getProductsByRegion);
router.get("/region/:region/stats", productController.getRegionalStats);
router.get("/:productId/region/:region", productController.getProductByRegion);

// ============================================
// PRODUCT PLANS ROUTE — MUST BE ABOVE /:productId
// ============================================
router.get("/:productId/plans", productController.getProductPlans);

// ============================================
// PRODUCT REVIEWS ROUTE (Public) — MUST BE ABOVE /:productId
// ============================================
/**
 * @route   GET /api/products/:productId/reviews
 * @desc    Get all reviews for a product (public)
 * @access  Public
 *
 * @query {
 *   page: number (default: 1)
 *   limit: number (default: 10)
 *   sort: 'mostHelpful' | 'newest' | 'oldest' | 'highest' | 'lowest' (default: newest)
 *   rating: number or comma-separated (e.g., '5,4' for 5 and 4 star reviews)
 *   verified: 'true' (optional) - Only verified purchases
 *   hasImages: 'true' (optional) - Only reviews with images
 *   search: string (optional) - Search in review text
 * }
 */
router.get("/:productId/reviews", reviewController.getProductReviews);

// ============================================
// INDIVIDUAL PRODUCT ROUTES — KEEP AT BOTTOM
// ============================================
router.delete(
  "/:productId/hard",
  verifyToken,
  isAdmin,
  productController.hardDeleteProduct
);

// Related products — MUST be before GET /:productId to avoid collision
router.get(
  "/:productId/related",
  optionalAuth,
  detectCountryWithCache,
  productController.getRelatedProducts
);

// Stock update (admin only)
router.patch(
  "/:productId/stock",
  verifyToken,
  isAdmin,
  productController.updateProductStock
);

// Status toggle (admin only)
router.patch(
  "/:productId/status",
  verifyToken,
  isAdmin,
  productController.updateProductStatus
);

// POST images (append images to product — admin only)
router.post(
  "/:productId/images",
  verifyToken,
  isAdmin,
  uploadMultiple,
  productController.addProductImages
);

router.get("/:productId", productController.getProductById);
router.put(
  "/:productId",
  verifyToken,
  isAdmin,
  productController.updateProduct
);
router.delete(
  "/:productId",
  verifyToken,
  isAdmin,
  productController.deleteProduct
);
router.put(
  "/:productId/restore",
  verifyToken,
  isAdmin,
  productController.restoreProduct
);

// ============================================
// LISTING APPROVAL (Admin) — approve / reject seller products
// ============================================
router.patch(
  "/:productId/listing-status",
  verifyToken,
  isAdmin,
  productController.updateListingStatus
);

// ============================================
// VARIANT MATRIX + EXCHANGE RATES (Admin)
// ============================================

// Preview cartesian-product variant matrix from category attributeSchema
// Returns proposed variants WITHOUT saving; admin confirms in Flutter UI
router.post(
  "/:productId/generate-variant-matrix",
  verifyToken,
  isAdmin,
  productController.generateVariantMatrix
);

// Save confirmed variant matrix (admin fills prices in Flutter, then POSTs here)
router.post(
  "/:productId/apply-variant-matrix",
  verifyToken,
  isAdmin,
  productController.applyVariantMatrix
);

// Per-variant CRUD — price, stock, images per combination
router.get("/:productId/variants", productController.getProductVariants);
router.get("/:productId/variants/:variantId", productController.getVariantById);
router.patch(
  "/:productId/variants/:variantId",
  verifyToken,
  isAdmin,
  productController.updateVariant
);
router.delete(
  "/:productId/variants/:variantId",
  verifyToken,
  isAdmin,
  productController.deleteVariant
);

// ============================================
// SPECIFIC UPDATE ROUTES
// ============================================
router.put(
  "/:productId/images",
  verifyToken,
  isAdmin,
  uploadMultiple,
  productController.updateProductImages
);
router.put(
  "/:productId/seo",
  verifyToken,
  isAdmin,
  productController.updateProductSEO
);
router.put(
  "/:productId/plans",
  verifyToken,
  isAdmin,
  productController.updateProductPlans
);
router.put(
  "/:productId/variants/:variantId/images",
  verifyToken,
  isAdmin,
  uploadMultiple,
  productController.updateVariantImages
);

// ============================================
// IMAGE MANAGEMENT ROUTES
// ============================================
// Delete individual image from product
router.delete(
  "/:productId/images/:imageIndex",
  verifyToken,
  isAdmin,
  productController.deleteProductImage
);

// Delete individual image from variant
router.delete(
  "/:productId/variants/:variantId/images/:imageIndex",
  verifyToken,
  isAdmin,
  productController.deleteVariantImage
);

// Reorder product images
router.put(
  "/:productId/images/reorder",
  verifyToken,
  isAdmin,
  productController.reorderProductImages
);

// Reorder variant images
router.put(
  "/:productId/variants/:variantId/images/reorder",
  verifyToken,
  isAdmin,
  productController.reorderVariantImages
);

// ============================================
// FEATURE FLAGS
// ============================================
router.post(
  "/:productId/mark-popular",
  verifyToken,
  isAdmin,
  productFeaturedController.markAsPopular
);
router.post(
  "/:productId/mark-bestseller",
  verifyToken,
  isAdmin,
  productFeaturedController.markAsBestSeller
);
router.post(
  "/:productId/mark-trending",
  verifyToken,
  isAdmin,
  productFeaturedController.markAsTrending
);

router.delete(
  "/:productId/remove-popular",
  verifyToken,
  isAdmin,
  productFeaturedController.removePopular
);
router.delete(
  "/:productId/remove-bestseller",
  verifyToken,
  isAdmin,
  productFeaturedController.removeBestSeller
);
router.delete(
  "/:productId/remove-trending",
  verifyToken,
  isAdmin,
  productFeaturedController.removeTrending
);

// ============================================
// REGIONAL WRITE ROUTES
// ============================================
router.post(
  "/:productId/regional-pricing",
  verifyToken,
  isAdmin,
  productController.addRegionalPricing
);
router.post(
  "/:productId/regional-availability",
  verifyToken,
  isAdmin,
  productController.addRegionalAvailability
);
router.post(
  "/:productId/regional-seo",
  verifyToken,
  isAdmin,
  productController.addRegionalSeo
);
router.post(
  "/:productId/related-products",
  verifyToken,
  isAdmin,
  productController.addRelatedProducts
);
router.post(
  "/:productId/sync-regional",
  verifyToken,
  isAdmin,
  productController.syncRegionalData
);

module.exports = router;
