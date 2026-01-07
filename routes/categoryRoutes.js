const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/categoryController");
const { verifyToken, isAdmin, optionalAuth } = require("../middlewares/auth");
const {
  uploadSingle,
  uploadCategoryImages,
  uploadCategoryBanners,
} = require("../middlewares/uploadMiddleware");

/**
 * Admin routes (With authentication)
 */

// Get all categories for admin (with deleted indicator)
router.get(
  "/admin/all",
  verifyToken,
  isAdmin,
  categoryController.getAllCategoriesForAdmin
);

// Restore deleted category
router.put(
  "/:categoryId/restore",
  verifyToken,
  isAdmin,
  categoryController.restoreCategory
);

router.put(
  "/:categoryId/category-images",
  verifyToken,
  isAdmin,
  uploadCategoryImages,
  categoryController.updateCategoryImages
);
/**
 * Public routes
 */

// Export categories (admin only - must be BEFORE generic routes)
router.get(
  "/export",
  verifyToken,
  isAdmin,
  categoryController.exportCategories
);

// Get category stats
router.get("/stats", categoryController.getCategoryStats);

// Get featured categories
router.get("/featured", categoryController.getFeaturedCategories);

// Get all main categories with subcategories (for dropdown)
router.get(
  "/dropdown/all",
  optionalAuth,
  categoryController.getCategoriesForDropdown
);

// Get all categories
router.get("/", optionalAuth, categoryController.getAllCategories);

// Search categories
router.get("/search/:query", optionalAuth, categoryController.searchCategories);

// Get category by ID with subcategories
router.get(
  "/:categoryId/with-subcategories",
  optionalAuth,
  categoryController.getCategoryWithSubcategories
);

// Get category by ID
router.get("/:categoryId", optionalAuth, categoryController.getCategoryById);

/**
 * CATEGORY BANNER IMAGES (ARRAY)
 */

// Upload banner images
router.post(
  "/:categoryId/banner-images",
  verifyToken,
  isAdmin,
  uploadCategoryBanners,
  categoryController.uploadCategoryBanners
);

// Reorder banner images
router.put(
  "/:categoryId/banner-images/reorder",
  verifyToken,
  isAdmin,
  categoryController.reorderCategoryBanners
);

// Delete banner image by id
router.delete(
  "/:categoryId/banner-images/:bannerImageId",
  verifyToken,
  isAdmin,
  categoryController.deleteCategoryBannerImage
);

// Create category
router.post("/", verifyToken, isAdmin, categoryController.createCategory);

// Update category
router.put(
  "/:categoryId",
  verifyToken,
  isAdmin,
  categoryController.updateCategory
);

// // Update category image (with file upload)
// router.put(
//   "/:categoryId/image",
//   verifyToken,
//   isAdmin,
//   uploadSingle,
//   categoryController.updateCategoryImage
// );

// // Update category banner (with file upload)
// router.put(
//   "/:categoryId/banner",
//   verifyToken,
//   isAdmin,
//   uploadSingle,
//   categoryController.updateCategoryBanner
// );

// Update category meta/SEO
router.put(
  "/:categoryId/meta",
  verifyToken,
  isAdmin,
  categoryController.updateCategoryMeta
);

// Toggle featured status
router.put(
  "/:categoryId/toggle-featured",
  verifyToken,
  isAdmin,
  categoryController.toggleFeatured
);

// Delete category (soft delete)
router.delete(
  "/:categoryId",
  verifyToken,
  isAdmin,
  categoryController.deleteCategory
);

// Hard delete category (permanent deletion)
router.delete(
  "/:categoryId/hard",
  verifyToken,
  isAdmin,
  categoryController.hardDeleteCategory
);

// Bulk reorder categories
router.put(
  "/bulk/reorder",
  verifyToken,
  isAdmin,
  categoryController.reorderCategories
);

// Sync product counts for all categories
router.post(
  "/sync-product-counts",
  verifyToken,
  isAdmin,
  categoryController.syncAllProductCounts
);

module.exports = router;
