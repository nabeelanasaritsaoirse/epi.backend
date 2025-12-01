const express = require("express");
const router = express.Router();

const { verifyToken, isAdmin } = require("../middlewares/auth");
const {
  submitKyc,
  getKycStatus,
  adminApprove,
  adminReject
} = require("../controllers/kycController");

// USER ROUTES
router.post("/submit", verifyToken, submitKyc);
router.get("/status", verifyToken, getKycStatus);

// ADMIN ROUTES
router.post("/admin/approve/:id", verifyToken, isAdmin, adminApprove);
router.post("/admin/reject/:id", verifyToken, isAdmin, adminReject);

module.exports = router;
