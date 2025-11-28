const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const { verifyToken, isAdmin } = require('../middlewares/auth');
const bannerController = require('../controllers/bannerController');
const { uploadToS3 } = require('../services/awsUploadService');

// Multer configuration for image upload
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (jpeg, jpg, png, webp) are allowed'));
    }
  }
});

/**
 * Middleware to process and upload image to S3
 */
const processAndUploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return next();
    }

    // Get image metadata
    const metadata = await sharp(req.file.buffer).metadata();

    // Resize image to 1200px width maintaining aspect ratio
    const resizedBuffer = await sharp(req.file.buffer)
      .resize(1200, null, {
        fit: 'inside',
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3
      })
      .jpeg({
        quality: 90,
        chromaSubsampling: '4:4:4'
      })
      .toBuffer();

    // Upload to S3
    const folder = 'banners/';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const key = `${folder}${fileName}`;

    const s3Url = await uploadToS3(resizedBuffer, folder, fileName);

    // Attach S3 info to request
    req.file.s3Url = s3Url;
    req.file.s3Key = key;
    req.file.width = metadata.width;
    req.file.height = metadata.height;
    req.file.size = resizedBuffer.length;

    next();
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing image',
      error: error.message
    });
  }
};

// ============================================
// BANNER ROUTES
// ============================================

/**
 * POST /api/banners
 * Create a new banner
 * Auth: Admin required
 * Body: multipart/form-data with image + fields
 */
router.post('/', verifyToken, isAdmin, upload.single('image'), processAndUploadImage, bannerController.createBanner);

/**
 * GET /api/banners/public/active
 * Get all active banners (public endpoint)
 * Query: platform, page, limit
 */
router.get('/public/active', bannerController.getActiveBanners);

/**
 * GET /api/banners/admin/all
 * Get all banners (admin only)
 * Query: isActive, platform, search, page, limit, sortBy, sortOrder
 */
router.get('/admin/all', verifyToken, isAdmin, bannerController.getAllBanners);

/**
 * GET /api/banners/admin/stats
 * Get banner statistics
 */
router.get('/admin/stats', verifyToken, isAdmin, bannerController.getBannerStats);

/**
 * GET /api/banners/:id
 * Get single banner by ID
 */
router.get('/:id', bannerController.getBannerById);

/**
 * PUT /api/banners/:id
 * Update banner (without replacing image)
 * Auth: Admin required
 */
router.put('/:id', verifyToken, isAdmin, bannerController.updateBanner);

/**
 * PUT /api/banners/:id/image
 * Replace banner image
 * Auth: Admin required
 */
router.put('/:id/image', verifyToken, isAdmin, upload.single('image'), processAndUploadImage, bannerController.replaceBannerImage);

/**
 * PATCH /api/banners/:id/toggle
 * Toggle banner status (active/inactive)
 * Auth: Admin required
 */
router.patch('/:id/toggle', verifyToken, isAdmin, bannerController.toggleBannerStatus);

/**
 * DELETE /api/banners/:id
 * Soft delete banner
 * Auth: Admin required
 */
router.delete('/:id', verifyToken, isAdmin, bannerController.deleteBanner);

/**
 * DELETE /api/banners/:id/permanent
 * Permanently delete banner
 * Auth: Admin required
 */
router.delete('/:id/permanent', verifyToken, isAdmin, bannerController.permanentlyDeleteBanner);

/**
 * POST /api/banners/:id/restore
 * Restore soft-deleted banner
 * Auth: Admin required
 */
router.post('/:id/restore', verifyToken, isAdmin, bannerController.restoreBanner);

/**
 * POST /api/banners/reorder
 * Reorder banners
 * Auth: Admin required
 * Body: { bannerOrders: [{id, displayOrder}, ...] }
 */
router.post('/reorder', verifyToken, isAdmin, bannerController.reorderBanners);

/**
 * POST /api/banners/:id/click
 * Track banner click
 */
router.post('/:id/click', bannerController.trackBannerClick);

module.exports = router;
