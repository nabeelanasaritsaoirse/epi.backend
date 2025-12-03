const express = require("express");
const router = express.Router();

const { verifyToken, isAdmin } = require("../middlewares/auth");
const { uploadSingle } = require("../middlewares/uploadMiddleware");
const { uploadSingleFileToS3 } = require("../services/awsUploadService");

const {
  submitKyc,
  getKycStatus,
  getAllKyc,
  adminApprove,
  adminReject
} = require("../controllers/kycController");

/* ============================================================
   📌 USER — Upload KYC Document Image (NEW)
   Route: POST /api/kyc/upload
============================================================ */
router.post(
  "/upload",
  verifyToken,
  uploadSingle, // multer single-file middleware (expects: image)
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { type, side } = req.body;

      // Validate file
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Image file is required"
        });
      }

      // Validate required fields
      if (!type || !side) {
        return res.status(400).json({
          success: false,
          message: "Document type and side are required"
        });
      }

      const validTypes = ["aadhaar", "pan", "voter_id", "driving_license"];
      const validSides = ["front", "back"];

      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid document type"
        });
      }

      if (!validSides.includes(side)) {
        return res.status(400).json({
          success: false,
          message: "Invalid document side"
        });
      }

      // Folder structure: kyc/<USER_ID>/
      const folder = `kyc/${userId}/`;

      // Upload image → S3
      const uploaded = await uploadSingleFileToS3(req.file, folder, 800);

      return res.json({
        success: true,
        message: "Image uploaded successfully",
        type,
        side,
        url: uploaded.url
      });

    } catch (err) {
      console.error("KYC Upload Error:", err);
      res.status(500).json({ success: false, message: "Server error" });
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

// Get all KYC (admin panel)
router.get("/admin/all", verifyToken, isAdmin, getAllKyc);

// Approve
router.patch("/admin/approve/:id", verifyToken, isAdmin, adminApprove);

// Reject
router.patch("/admin/reject/:id", verifyToken, isAdmin, adminReject);


module.exports = router;
