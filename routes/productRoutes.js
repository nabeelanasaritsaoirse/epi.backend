const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const productFeaturedController = require('../controllers/productFeaturedController');
const { uploadMultiple } = require('../middlewares/uploadMiddleware');

// ============================================
// BASIC PRODUCT ROUTES
// ============================================
router.post('/', productController.createProduct);
router.get('/', productController.getAllProducts);
router.get('/stats', productController.getProductStats);
router.get('/search', productController.searchProductsAdvanced);
router.get('/low-stock', productController.getLowStockProducts);

// ============================================
// FEATURED PRODUCT ROUTES
// ============================================
router.get('/featured/all', productFeaturedController.getAllFeaturedProducts);
router.get('/featured/popular', productFeaturedController.getMostPopularProducts);
router.get('/featured/best-sellers', productFeaturedController.getBestSellerProducts);
router.get('/featured/trending', productFeaturedController.getTrendingProducts);

// ============================================
// CATEGORY + PROJECT ROUTES
// ============================================
router.get('/category/:category', productController.getProductsByCategory);
router.get('/project/:projectId', productController.getProductsByProject);

// ============================================
// PRODUCT PLANS ROUTE — MUST BE ABOVE ANY :productId ROUTE
// ============================================
router.get('/:productId/plans', productController.getProductPlans);

// ============================================
// REGION ROUTES — MUST BE ABOVE :productId
// ============================================
router.get('/region/:region', productController.getProductsByRegion);
router.get('/region/:region/stats', productController.getRegionalStats);
router.get('/:productId/region/:region', productController.getProductByRegion);

// ============================================
// INDIVIDUAL PRODUCT ROUTES — KEEP AT BOTTOM
// ============================================
router.get('/:productId', productController.getProductById);
router.put('/:productId', productController.updateProduct);
router.delete('/:productId', productController.deleteProduct);

// ============================================
// SPECIFIC UPDATE ROUTES
// ============================================
router.put('/:productId/images', uploadMultiple, productController.updateProductImages);
router.put('/:productId/seo', productController.updateProductSEO);
router.put('/:productId/plans', productController.updateProductPlans);
router.put('/:productId/variants/:variantId/images', uploadMultiple, productController.updateVariantImages);

// ============================================
// FEATURE FLAGS
// ============================================
router.post('/:productId/mark-popular', productFeaturedController.markAsPopular);
router.post('/:productId/mark-bestseller', productFeaturedController.markAsBestSeller);
router.post('/:productId/mark-trending', productFeaturedController.markAsTrending);

router.delete('/:productId/remove-popular', productFeaturedController.removePopular);
router.delete('/:productId/remove-bestseller', productFeaturedController.removeBestSeller);
router.delete('/:productId/remove-trending', productFeaturedController.removeTrending);

// ============================================
// REGIONAL WRITE ROUTES
// ============================================
router.post('/:productId/regional-pricing', productController.addRegionalPricing);
router.post('/:productId/regional-availability', productController.addRegionalAvailability);
router.post('/:productId/regional-seo', productController.addRegionalSeo);
router.post('/:productId/related-products', productController.addRelatedProducts);
router.post('/:productId/sync-regional', productController.syncRegionalData);

// ============================================
// BULK OPERATIONS
// ============================================
router.post('/bulk/mark-products', productFeaturedController.bulkMarkProducts);
router.post('/bulk/regional-pricing', productController.bulkUpdateRegionalPricing);

module.exports = router;
