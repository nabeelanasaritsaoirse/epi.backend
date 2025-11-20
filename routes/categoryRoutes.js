const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { verifyToken, isAdmin } = require('../middlewares/auth');

/**
 * Public routes
 */

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

// Delete category
router.delete('/:categoryId', categoryController.deleteCategory);

// Bulk reorder categories
router.put('/bulk/reorder', categoryController.reorderCategories);

module.exports = router;
