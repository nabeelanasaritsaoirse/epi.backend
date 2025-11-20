const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middlewares/auth');
const productController = require('../controllers/productController');
const productFeaturedController = require('../controllers/productFeaturedController');

// ============================================
// STATIC ROUTES (MUST BE BEFORE :productId)
// ============================================

// Stats and search
router.get('/stats', productController.getProductStats);
router.get('/search', productController.searchProductsAdvanced);
router.get('/low-stock', productController.getLowStockProducts);

// Featured product routes - MUST be before /:productId routes
router.get('/featured/all', productFeaturedController.getAllFeaturedProducts);
router.get('/featured/popular', productFeaturedController.getMostPopularProducts);
router.get('/featured/best-sellers', productFeaturedController.getBestSellerProducts);
router.get('/featured/trending', productFeaturedController.getTrendingProducts);

// Regional stats
router.get('/region/:region/stats', productController.getRegionalStats);

// Category and project routes
router.get('/category/:category', productController.getProductsByCategory);
router.get('/project/:projectId', productController.getProductsByProject);
router.get('/region/:region', productController.getProductsByRegion);

// ============================================
// BULK OPERATIONS
// ============================================
router.post('/bulk/regional-pricing', verifyToken, isAdmin, productController.bulkUpdateRegionalPricing);

// ============================================
// DYNAMIC ID ROUTES (MUST BE AFTER STATIC)
// ============================================

// List all products
router.get('/', productController.getAllProducts);

// Create product
router.post('/', productController.createProduct);

// Mark product operations (MUST be before /:productId)
router.patch('/:productId/mark-popular', productFeaturedController.markAsPopular);
router.patch('/:productId/mark-best-seller', productFeaturedController.markAsBestSeller);
router.patch('/:productId/mark-trending', productFeaturedController.markAsTrending);

// Remove flags
router.patch('/:productId/remove-popular', productFeaturedController.removePopular);
router.patch('/:productId/remove-best-seller', productFeaturedController.removeBestSeller);
router.patch('/:productId/remove-trending', productFeaturedController.removeTrending);

// Bulk mark products
router.post('/featured/bulk-mark', productFeaturedController.bulkMarkProducts);

// Regional operations
router.post('/:productId/regional-pricing', productController.addRegionalPricing);
router.post('/:productId/regional-availability', productController.addRegionalAvailability);
router.post('/:productId/regional-seo', productController.addRegionalSeo);
router.post('/:productId/related-products', productController.addRelatedProducts);
router.post('/:productId/sync-regional', productController.syncRegionalData);
router.get('/:productId/region/:region', productController.getProductByRegion);

// Get single product (MUST be after all other :productId routes)
router.get('/:productId', productController.getProductById);

// Update product
router.put('/:productId', productController.updateProduct);

// Delete product
router.delete('/:productId', productController.deleteProduct);

module.exports = router;