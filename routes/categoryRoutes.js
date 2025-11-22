const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { verifyToken, isAdmin } = require('../middlewares/auth');
const { uploadSingle } = require('../middlewares/uploadMiddleware');

/**
 * Public routes
 */

// Get category stats
router.get('/stats', categoryController.getCategoryStats);

// Get featured categories
router.get('/featured', categoryController.getFeaturedCategories);

// Get all main categories with subcategories (for dropdown)
router.get('/dropdown/all', categoryController.getCategoriesForDropdown);

// Get all categories
router.get('/', categoryController.getAllCategories);

// Search categories
router.get('/search/:query', categoryController.searchCategories);

// Get category by ID with subcategories
router.get('/:categoryId/with-subcategories', categoryController.getCategoryWithSubcategories);

// Get category by ID
router.get('/:categoryId', categoryController.getCategoryById);

/**
 * Admin routes (No authentication required)
 */

// Create category
router.post('/', categoryController.createCategory);

// Update category
router.put('/:categoryId', categoryController.updateCategory);

// Update category image (with file upload)
router.put('/:categoryId/image', uploadSingle, categoryController.updateCategoryImage);

// Update category banner (with file upload)
router.put('/:categoryId/banner', uploadSingle, categoryController.updateCategoryBanner);

// Update category meta/SEO
router.put('/:categoryId/meta', categoryController.updateCategoryMeta);

// Toggle featured status
router.put('/:categoryId/toggle-featured', categoryController.toggleFeatured);

// Delete category
router.delete('/:categoryId', categoryController.deleteCategory);

// Bulk reorder categories
router.put('/bulk/reorder', categoryController.reorderCategories);

module.exports = router;
