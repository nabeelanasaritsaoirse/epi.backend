const express = require("express");
const router = express.Router();
const multer = require("multer");
const sharp = require("sharp");
const { verifyToken, isAdmin } = require("../middlewares/auth");
const { uploadToS3 } = require("../services/awsUploadService");

const upload = multer({ storage: multer.memoryStorage() });

router.post("/temp-images", verifyToken, isAdmin, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const resized = await sharp(req.file.buffer)
      .resize(1200)
      .jpeg({ quality: 90 })
      .toBuffer();

    const folder = "temp-images/";
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

    const s3Url = await uploadToS3(resized, folder, fileName);

    return res.json({
      success: true,
      url: s3Url
    });

  } catch (err) {
    console.error("TEMP UPLOAD ERR:", err);
    res.status(500).json({ success: false, message: "Error uploading temporary image" });
  }
});

module.exports = router;
