const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
<<<<<<< Updated upstream
const productFeaturedController = require('../controllers/productFeaturedController');
=======
const { verifyToken, isAdmin } = require('../middlewares/auth');
>>>>>>> Stashed changes

// Basic product routes with image upload
router.post('/', 
  productController.upload.array('images', 10), // Max 10 images
  productController.processAndUploadImages,
  productController.createProduct
);

router.put('/:productId', 
  productController.upload.array('images', 10),
  productController.processAndUploadImages,
  productController.updateProduct
);

// Image management routes
router.post('/:productId/images',
  productController.upload.array('images', 10),
  productController.processAndUploadImages,
  productController.addProductImages
);

router.delete('/:productId/images/:imageIndex', productController.deleteProductImage);

// Featured products routes
router.post('/:productId/mark-featured', verifyToken, isAdmin, productController.markAsFeatured);
router.post('/:productId/remove-featured', verifyToken, isAdmin, productController.removeFromFeatured);
router.post('/bulk/update-featured', verifyToken, isAdmin, productController.bulkUpdateFeatured);
router.put('/featured/reorder', verifyToken, isAdmin, productController.reorderFeatured);

// Keep all your existing routes...
router.get('/', productController.getAllProducts);
router.get('/stats', productController.getProductStats);
router.get('/search', productController.searchProductsAdvanced);
router.get('/low-stock', productController.getLowStockProducts);
<<<<<<< Updated upstream

// Featured product routes - MUST be before /:productId routes
router.get('/featured/all', productFeaturedController.getAllFeaturedProducts);
router.get('/featured/popular', productFeaturedController.getMostPopularProducts);
router.get('/featured/best-sellers', productFeaturedController.getBestSellerProducts);
router.get('/featured/trending', productFeaturedController.getTrendingProducts);

// Category and project routes
=======
router.get('/featured', productController.getFeaturedProducts);
>>>>>>> Stashed changes
router.get('/category/:category', productController.getProductsByCategory);
router.get('/project/:projectId', productController.getProductsByProject);

// Individual product routes
router.get('/:productId', productController.getProductById);
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