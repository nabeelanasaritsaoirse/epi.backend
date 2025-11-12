const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const { verifyToken, isAdmin } = require('../middlewares/auth');
const imageStoreController = require('../controllers/imageStoreController');
const { uploadToS3 } = require('../services/awsUploadService');

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|gif|svg/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

const processAndUploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return next();
    }

    const metadata = await sharp(req.file.buffer).metadata();

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

    const folder = 'image-store/';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const key = `${folder}${fileName}`;

    const s3Url = await uploadToS3(resizedBuffer, folder, fileName);

    req.file.s3Url = s3Url;
    req.file.s3Key = key;
    req.file.width = metadata.width;
    req.file.height = metadata.height;

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

router.get('/types', imageStoreController.getImageTypes);

router.post('/', verifyToken, isAdmin, upload.single('image'), processAndUploadImage, imageStoreController.createImage);

router.get('/admin/all', verifyToken, isAdmin, imageStoreController.getAllImagesAdmin);

router.get('/admin/active', verifyToken, isAdmin, imageStoreController.getAllActiveImagesAdmin);

router.get('/stats', verifyToken, isAdmin, imageStoreController.getImageStats);

router.get('/type/:type', imageStoreController.getImagesByType);

router.get('/:id', imageStoreController.getImageById);

router.put('/:id', verifyToken, isAdmin, imageStoreController.updateImage);

router.put('/:id/replace', verifyToken, isAdmin, upload.single('image'), processAndUploadImage, imageStoreController.replaceImage);

router.patch('/order', verifyToken, isAdmin, imageStoreController.updateImageOrder);

router.patch('/:id/toggle-status', verifyToken, isAdmin, imageStoreController.toggleImageStatus);

router.patch('/bulk/status', verifyToken, isAdmin, imageStoreController.bulkUpdateStatus);

router.delete('/:id', verifyToken, isAdmin, imageStoreController.deleteImage);

router.delete('/:id/permanent', verifyToken, isAdmin, imageStoreController.permanentDeleteImage);

router.post('/:id/restore', verifyToken, isAdmin, imageStoreController.restoreImage);

router.post('/:id/click', imageStoreController.incrementClickCount);

router.delete('/bulk/delete', verifyToken, isAdmin, imageStoreController.bulkDelete);

module.exports = router;
