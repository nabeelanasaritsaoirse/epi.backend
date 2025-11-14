const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const { verifyToken, isAdmin } = require('../middlewares/auth');
const successStoryController = require('../controllers/successStoryController');
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
    const folder = 'success-stories/';
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
// SUCCESS STORY ROUTES
// ============================================

/**
 * POST /api/success-stories
 * Create a new success story with image (photo only)
 * Auth: Admin required
 * Body: multipart/form-data with image + fields
 */
router.post('/', verifyToken, isAdmin, upload.single('image'), processAndUploadImage, successStoryController.createSuccessStory);

/**
 * PUT /api/success-stories/:id/image
 * Replace success story image
 * Auth: Admin required
 */
router.put('/:id/image', verifyToken, isAdmin, upload.single('image'), processAndUploadImage, successStoryController.replaceSuccessStoryImage);

/**
 * GET /api/success-stories/public/active
 * Get all active success stories (public endpoint)
 * Query: platform, page, limit
 */
router.get('/public/active', successStoryController.getActiveSuccessStories);

/**
 * GET /api/success-stories/admin/all
 * Get all success stories (admin only)
 * Query: isActive, platform, search, page, limit, sortBy, sortOrder
 */
router.get('/admin/all', verifyToken, isAdmin, successStoryController.getAllSuccessStories);

/**
 * GET /api/success-stories/admin/stats
 * Get success story statistics
 */
router.get('/admin/stats', verifyToken, isAdmin, successStoryController.getSuccessStoryStats);

/**
 * GET /api/success-stories/:id
 * Get single success story by ID (increments view count)
 */
router.get('/:id', successStoryController.getSuccessStoryById);

/**
 * PUT /api/success-stories/:id
 * Update success story
 * Auth: Admin required
 */
router.put('/:id', verifyToken, isAdmin, successStoryController.updateSuccessStory);

/**
 * PUT /api/success-stories/:id/image
 * Replace success story image
 * Auth: Admin required
 */
router.put('/:id/image', verifyToken, isAdmin, upload.single('image'), processAndUploadImage, successStoryController.replaceSuccessStoryImage);

/**
 * PATCH /api/success-stories/:id/toggle
 * Toggle success story status (active/inactive)
 * Auth: Admin required
 */
router.patch('/:id/toggle', verifyToken, isAdmin, successStoryController.toggleSuccessStoryStatus);

/**
 * DELETE /api/success-stories/:id
 * Soft delete success story
 * Auth: Admin required
 */
router.delete('/:id', verifyToken, isAdmin, successStoryController.deleteSuccessStory);

/**
 * DELETE /api/success-stories/:id/permanent
 * Permanently delete success story
 * Auth: Admin required
 */
router.delete('/:id/permanent', verifyToken, isAdmin, successStoryController.permanentlyDeleteSuccessStory);

/**
 * POST /api/success-stories/:id/restore
 * Restore soft-deleted success story
 * Auth: Admin required
 */
router.post('/:id/restore', verifyToken, isAdmin, successStoryController.restoreSuccessStory);

/**
 * POST /api/success-stories/reorder
 * Reorder success stories
 * Auth: Admin required
 * Body: { storyOrders: [{id, displayOrder}, ...] }
 */
router.post('/reorder', verifyToken, isAdmin, successStoryController.reorderSuccessStories);

module.exports = router;
