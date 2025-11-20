const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const productFeaturedController = require('../controllers/productFeaturedController');

// Basic product routes
router.post('/', productController.createProduct);
router.get('/', productController.getAllProducts);
router.get('/stats', productController.getProductStats);
router.get('/search', productController.searchProductsAdvanced);
router.get('/low-stock', productController.getLowStockProducts);

// Featured product routes - MUST be before /:productId routes
router.get('/featured/all', productFeaturedController.getAllFeaturedProducts);
router.get('/featured/popular', productFeaturedController.getMostPopularProducts);
router.get('/featured/best-sellers', productFeaturedController.getBestSellerProducts);
router.get('/featured/trending', productFeaturedController.getTrendingProducts);

// Category and project routes
router.get('/category/:category', productController.getProductsByCategory);
router.get('/project/:projectId', productController.getProductsByProject);

// Individual product routes
router.get('/:productId', productController.getProductById);
router.put('/:productId', productController.updateProduct);
router.delete('/:productId', productController.deleteProduct);

// Mark products as popular/bestseller/trending
router.post('/:productId/mark-popular', productFeaturedController.markAsPopular);
router.post('/:productId/mark-bestseller', productFeaturedController.markAsBestSeller);
router.post('/:productId/mark-trending', productFeaturedController.markAsTrending);

// Remove flags
router.delete('/:productId/remove-popular', productFeaturedController.removePopular);
router.delete('/:productId/remove-bestseller', productFeaturedController.removeBestSeller);
router.delete('/:productId/remove-trending', productFeaturedController.removeTrending);

// Bulk operations
router.post('/bulk/mark-products', productFeaturedController.bulkMarkProducts);

// Enhanced regional routes
router.get('/region/:region', productController.getProductsByRegion);
router.get('/region/:region/stats', productController.getRegionalStats);
router.get('/:productId/region/:region', productController.getProductByRegion);
router.post('/:productId/regional-pricing', productController.addRegionalPricing);
router.post('/:productId/regional-availability', productController.addRegionalAvailability);
router.post('/:productId/regional-seo', productController.addRegionalSeo);
router.post('/:productId/related-products', productController.addRelatedProducts);
router.post('/:productId/sync-regional', productController.syncRegionalData);

// Bulk regional operations
router.post('/bulk/regional-pricing', productController.bulkUpdateRegionalPricing);

module.exports = router;
