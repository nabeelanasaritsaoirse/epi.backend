const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const categoryController = require('../controllers/categoryController');
const { verifyToken, isAdmin } = require('../middlewares/auth');
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
      cb(new Error('Only image files are allowed (jpeg, jpg, png, webp)'));
    }
  }
});

// Middleware to process and upload image to S3
const processAndUploadCategoryImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return next();
    }

    // Get image metadata
    const metadata = await sharp(req.file.buffer).metadata();

    // Resize image for category
    const resizedBuffer = await sharp(req.file.buffer)
      .resize(800, null, {
        fit: 'inside',
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3
      })
      .jpeg({
        quality: 85,
        chromaSubsampling: '4:4:4'
      })
      .toBuffer();

    // Upload to S3
    const folder = 'categories/';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const key = `${folder}${fileName}`;

    const s3Url = await uploadToS3(resizedBuffer, folder, fileName);

    // Attach file info to request
    req.file.s3Url = s3Url;
    req.file.s3Key = key;
    req.file.width = metadata.width;
    req.file.height = metadata.height;
    req.file.size = resizedBuffer.length;

    next();
  } catch (error) {
    console.error('Error processing category image:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing image',
      error: error.message
    });
  }
};

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

// Create category with image upload
router.post('/', verifyToken, isAdmin, upload.single('image'), processAndUploadCategoryImage, categoryController.createCategory);

// Update category with optional image upload
router.put('/:categoryId', verifyToken, isAdmin, upload.single('image'), processAndUploadCategoryImage, categoryController.updateCategory);

// Upload/Replace category image
router.post('/:categoryId/upload-image', verifyToken, isAdmin, upload.single('image'), processAndUploadCategoryImage, categoryController.uploadCategoryImage);

// Delete category image
router.delete('/:categoryId/image', verifyToken, isAdmin, categoryController.deleteCategoryImage);

// Delete category
router.delete('/:categoryId', verifyToken, isAdmin, categoryController.deleteCategory);

// Bulk reorder categories
router.put('/bulk/reorder', verifyToken, isAdmin, categoryController.reorderCategories);

module.exports = router;
