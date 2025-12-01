const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const productFeaturedController = require('../controllers/productFeaturedController');
const { uploadMultiple } = require('../middlewares/uploadMiddleware');
const { verifyToken, isAdmin } = require('../middlewares/auth');

// ============================================
// ADMIN ROUTES (With authentication)
// ============================================
router.get('/admin/all', verifyToken, isAdmin, productController.getAllProductsForAdmin);

// ============================================
// BASIC PRODUCT ROUTES
// ============================================
router.post('/', verifyToken, isAdmin, productController.createProduct);
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
// products routes
router.get('/category/:categoryId', productController.getProductsByCategoryId);


// ============================================
// REGION ROUTES — MUST BE ABOVE ANY :productId ROUTE
// ============================================
router.get('/region/:region', productController.getProductsByRegion);
router.get('/region/:region/stats', productController.getRegionalStats);
router.get('/:productId/region/:region', productController.getProductByRegion);

// ============================================
// PRODUCT PLANS ROUTE — MUST BE ABOVE /:productId
// ============================================
router.get('/:productId/plans', productController.getProductPlans);

// ============================================
// INDIVIDUAL PRODUCT ROUTES — KEEP AT BOTTOM
// ============================================
router.get('/:productId', productController.getProductById);
router.put('/:productId', verifyToken, isAdmin, productController.updateProduct);
router.delete('/:productId', verifyToken, isAdmin, productController.deleteProduct);
router.put('/:productId/restore', verifyToken, isAdmin, productController.restoreProduct);

// ============================================
// SPECIFIC UPDATE ROUTES
// ============================================
router.put('/:productId/images', verifyToken, isAdmin, uploadMultiple, productController.updateProductImages);
router.put('/:productId/seo', verifyToken, isAdmin, productController.updateProductSEO);
router.put('/:productId/plans', verifyToken, isAdmin, productController.updateProductPlans);
router.put('/:productId/variants/:variantId/images', verifyToken, isAdmin, uploadMultiple, productController.updateVariantImages);

// ============================================
// IMAGE MANAGEMENT ROUTES
// ============================================
// Delete individual image from product
router.delete('/:productId/images/:imageIndex', verifyToken, isAdmin, productController.deleteProductImage);

// Delete individual image from variant
router.delete('/:productId/variants/:variantId/images/:imageIndex', verifyToken, isAdmin, productController.deleteVariantImage);

// Reorder product images
router.put('/:productId/images/reorder', verifyToken, isAdmin, productController.reorderProductImages);

// Reorder variant images
router.put('/:productId/variants/:variantId/images/reorder', verifyToken, isAdmin, productController.reorderVariantImages);

// ============================================
// FEATURE FLAGS
// ============================================
router.post('/:productId/mark-popular', verifyToken, isAdmin, productFeaturedController.markAsPopular);
router.post('/:productId/mark-bestseller', verifyToken, isAdmin, productFeaturedController.markAsBestSeller);
router.post('/:productId/mark-trending', verifyToken, isAdmin, productFeaturedController.markAsTrending);

router.delete('/:productId/remove-popular', verifyToken, isAdmin, productFeaturedController.removePopular);
router.delete('/:productId/remove-bestseller', verifyToken, isAdmin, productFeaturedController.removeBestSeller);
router.delete('/:productId/remove-trending', verifyToken, isAdmin, productFeaturedController.removeTrending);

// ============================================
// REGIONAL WRITE ROUTES
// ============================================
router.post('/:productId/regional-pricing', verifyToken, isAdmin, productController.addRegionalPricing);
router.post('/:productId/regional-availability', verifyToken, isAdmin, productController.addRegionalAvailability);
router.post('/:productId/regional-seo', verifyToken, isAdmin, productController.addRegionalSeo);
router.post('/:productId/related-products', verifyToken, isAdmin, productController.addRelatedProducts);
router.post('/:productId/sync-regional', verifyToken, isAdmin, productController.syncRegionalData);

// ============================================
// BULK OPERATIONS
// ============================================
router.post('/bulk/mark-products', verifyToken, isAdmin, productFeaturedController.bulkMarkProducts);
router.post('/bulk/regional-pricing', verifyToken, isAdmin, productController.bulkUpdateRegionalPricing);

module.exports = router;

