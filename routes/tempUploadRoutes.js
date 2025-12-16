const express = require("express");
const router = express.Router();
const multer = require("multer");
const sharp = require("sharp");
const { verifyToken, isAdmin } = require("../middlewares/auth");
const { uploadToS3 } = require("../services/awsUploadService");

const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/temp-images",
  verifyToken,
  isAdmin,
  upload.array("images", 10),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "No files uploaded" });
      }

      const uploadedUrls = [];

      for (const file of req.files) {
        const resized = await sharp(file.buffer)
          .resize(1200)
          .jpeg({ quality: 90 })
          .toBuffer();

        const folder = "temp-images/";
        const fileName = `${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}.jpg`;

        const url = await uploadToS3(resized, folder, fileName);
        uploadedUrls.push(url);
      }

      res.json({
        success: true,
        urls: uploadedUrls,
      });
    } catch (err) {
      console.error("TEMP UPLOAD ERROR:", err);
      res.status(500).json({
        success: false,
        message: "Failed to upload temporary image",
      });
    }
  }
);

module.exports = router;
