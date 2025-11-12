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
 * Admin routes
 */

// Create category
router.post('/', verifyToken, isAdmin, categoryController.createCategory);

// Update category
router.put('/:categoryId', verifyToken, isAdmin, categoryController.updateCategory);

// Delete category
router.delete('/:categoryId', verifyToken, isAdmin, categoryController.deleteCategory);

// Bulk reorder categories
router.put('/bulk/reorder', verifyToken, isAdmin, categoryController.reorderCategories);

module.exports = router;
