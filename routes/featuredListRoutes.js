const express = require("express");
const router = express.Router();
const featuredListController = require("../controllers/featuredListController");
const { verifyToken, isAdmin, optionalAuth } = require("../middlewares/auth");
const { detectCountryWithCache } = require("../middlewares/countryMiddleware");

// ============================================
// PUBLIC ROUTES
// ============================================

// Get all active featured lists (with region filtering)
router.get(
  "/",
  optionalAuth,
  detectCountryWithCache,
  featuredListController.getAllListsPublic
);

// Get single list by slug (with region filtering)
router.get(
  "/:slug",
  optionalAuth,
  detectCountryWithCache,
  featuredListController.getListBySlugPublic
);

// ============================================
// ADMIN ROUTES
// ============================================

// Create new featured list
router.post(
  "/admin/lists",
  verifyToken,
  isAdmin,
  featuredListController.createList
);

// Get all lists (admin view - includes inactive)
router.get(
  "/admin/lists",
  verifyToken,
  isAdmin,
  featuredListController.getAllListsAdmin
);

// Get single list (admin view)
router.get(
  "/admin/lists/:listId",
  verifyToken,
  isAdmin,
  featuredListController.getListByIdAdmin
);

// Update list details
router.put(
  "/admin/lists/:listId",
  verifyToken,
  isAdmin,
  featuredListController.updateList
);

// Delete list
router.delete(
  "/admin/lists/:listId",
  verifyToken,
  isAdmin,
  featuredListController.deleteList
);

// Add product to list
router.post(
  "/admin/lists/:listId/products",
  verifyToken,
  isAdmin,
  featuredListController.addProductToList
);

// Remove product from list
router.delete(
  "/admin/lists/:listId/products/:productId",
  verifyToken,
  isAdmin,
  featuredListController.removeProductFromList
);

// Reorder products in list
router.put(
  "/admin/lists/:listId/reorder",
  verifyToken,
  isAdmin,
  featuredListController.reorderProducts
);

// Sync single product in list
router.post(
  "/admin/lists/:listId/products/:productId/sync",
  verifyToken,
  isAdmin,
  featuredListController.syncProductInList
);

// Sync all products in list
router.post(
  "/admin/lists/:listId/sync-all",
  verifyToken,
  isAdmin,
  featuredListController.syncAllProductsInList
);

module.exports = router;
