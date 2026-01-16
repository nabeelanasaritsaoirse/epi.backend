const express = require("express");
const router = express.Router();

const { verifyToken, isAdmin } = require("../middlewares/auth");
const { uploadSingle } = require("../middlewares/uploadMiddleware"); // now fields()
const { uploadSingleFileToS3 } = require("../services/awsUploadService");

const {
  submitKyc,
  getKycStatus,
  getAllKyc,
  adminApprove,
  adminReject,
  adminSearch
} = require("../controllers/kycController");


/* ============================================================
   📌 USER — Upload KYC Image (SELFIE / AADHAAR / PAN etc.)
============================================================ */
router.put(
  "/upload",
  verifyToken,
  uploadSingle, // now correctly populates req.files.image or req.files.file
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { type, side } = req.body;

      // 🔥 FIX: correct extraction from multer.fields()
      const uploadedFile =
        (req.files?.image && req.files.image[0]) ||
        (req.files?.file && req.files.file[0]) ||
        null;

      if (!uploadedFile) {
        return res.status(400).json({
          success: false,
          message: "Image file is required (image or file)"
        });
      }

      // Validate doc type
      const allowedTypes = [
        "selfie",
        "aadhaar",
        "pan",
        "voter_id",
        "driving_license"
      ];

      if (!type || !allowedTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid or missing document type"
        });
      }

      // Validate side
      if (type === "selfie") {
        if (side !== "front") {
          return res.status(400).json({
            success: false,
            message: "Selfie can only have side = 'front'"
          });
        }
      } else {
        const validSides = ["front", "back"];
        if (!validSides.includes(side)) {
          return res.status(400).json({
            success: false,
            message: "Invalid document side"
          });
        }
      }

      // Upload folder path
      const folder = `kyc/${userId}/`;

      // Upload to S3
      const uploaded = await uploadSingleFileToS3(uploadedFile, folder, 800);

      return res.json({
        success: true,
        message: "Image uploaded successfully",
        type,
        side,
        url: uploaded.url
      });

    } catch (err) {
      console.error("KYC Upload Error:", err);
      res.status(500).json({
        success: false,
        message: "Server error"
      });
    }
  }
);


/* ============================================================
   📌 USER ROUTES
============================================================ */
router.post("/submit", verifyToken, submitKyc);
router.get("/status", verifyToken, getKycStatus);


/* ============================================================
   📌 ADMIN ROUTES
============================================================ */
router.get("/admin/all", verifyToken, isAdmin, getAllKyc);
router.get("/admin/search", verifyToken, isAdmin, adminSearch);
router.patch("/admin/approve/:id", verifyToken, isAdmin, adminApprove);
router.patch("/admin/reject/:id", verifyToken, isAdmin, adminReject);

module.exports = router;
