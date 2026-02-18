const multer = require("multer");

// Memory storage
const storage = multer.memoryStorage();

// Image-only filter
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/svg+xml",
    "image/svg", // 👈 ADD
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPEG, PNG, and WebP images are allowed.",
      ),
      false,
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/* --------------------------------
   SINGLE IMAGE (GENERIC)
-----------------------------------*/
const uploadSingle = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

const uploadSingleMiddleware = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

/* --------------------------------
   MULTIPLE GENERIC IMAGES
-----------------------------------*/
const uploadMultiple = upload.array("images", 10);

/* --------------------------------
   FIXED CATEGORY IMAGES (SINGLE)
-----------------------------------*/
const uploadCategoryImages = upload.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "illustrationImage", maxCount: 1 },
  { name: "subcategoryImage", maxCount: 1 },
  { name: "mobileImage", maxCount: 1 },
  { name: "iconImage", maxCount: 1 },
]);

/* --------------------------------
   🆕 BANNER IMAGES (ARRAY)
-----------------------------------*/
const uploadCategoryBanners = upload.array("bannerImages", 10);

module.exports = {
  uploadSingle,
  uploadSingleMiddleware,
  uploadMultiple,
  uploadCategoryImages,
  uploadCategoryBanners, // ✅ NEW
};
