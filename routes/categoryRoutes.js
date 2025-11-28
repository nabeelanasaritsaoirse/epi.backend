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
 * Admin routes (With authentication)
 */

// Get all categories for admin (with deleted indicator)
router.get('/admin/all', verifyToken, isAdmin, categoryController.getAllCategoriesForAdmin);

// Restore deleted category
router.put('/:categoryId/restore', verifyToken, isAdmin, categoryController.restoreCategory);

// Delete individual image from category
router.delete('/:categoryId/images/:imageIndex', verifyToken, isAdmin, categoryController.deleteCategoryImage);

// Reorder category images
router.put('/:categoryId/images/reorder', verifyToken, isAdmin, categoryController.reorderCategoryImages);

// Create category
router.post('/', verifyToken, isAdmin, categoryController.createCategory);

// Update category
router.put('/:categoryId', verifyToken, isAdmin, categoryController.updateCategory);

// Update category image (with file upload)
router.put('/:categoryId/image', verifyToken, isAdmin, uploadSingle, categoryController.updateCategoryImage);

// Update category banner (with file upload)
router.put('/:categoryId/banner', verifyToken, isAdmin, uploadSingle, categoryController.updateCategoryBanner);

// Update category meta/SEO
router.put('/:categoryId/meta', verifyToken, isAdmin, categoryController.updateCategoryMeta);

// Toggle featured status
router.put('/:categoryId/toggle-featured', verifyToken, isAdmin, categoryController.toggleFeatured);

// Delete category (soft delete)
router.delete('/:categoryId', verifyToken, isAdmin, categoryController.deleteCategory);

// Bulk reorder categories
router.put('/bulk/reorder', verifyToken, isAdmin, categoryController.reorderCategories);

module.exports = router;
