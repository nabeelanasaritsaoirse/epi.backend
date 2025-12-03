const multer = require('multer');

// Memory storage - files will be available as req.file.buffer
const storage = multer.memoryStorage();

// File filter - only allow images
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
  }
};

/**
 * ⭐ UPDATED:
 * Accept both:
 * - "image"
 * - "file"
 * WITHOUT BREAKING ANY OLD LOGIC
 */
const uploadSingle = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
}).fields([
  { name: 'image', maxCount: 1 },
  { name: 'file', maxCount: 1 }
]);

// Multiple files upload (unchanged)
const uploadMultiple = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB each
  }
}).array('images', 10);

module.exports = {
  uploadSingle,
  uploadMultiple
};
