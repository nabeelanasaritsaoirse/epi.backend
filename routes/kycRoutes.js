const express = require("express");
const router = express.Router();

const { verifyToken, isAdmin } = require("../middlewares/auth");

const {
  submitKyc,
  getKycStatus,
  adminApprove,
  adminReject,
  getAllKyc // ⭐ NEW
} = require("../controllers/kycController");


// ===============================
// USER ROUTES
// ===============================
router.post("/submit", verifyToken, submitKyc);
router.get("/status", verifyToken, getKycStatus);


// ===============================
// ADMIN ROUTES
// ===============================

// ⭐ NEW — get full KYC list for admin panel
router.get("/admin/all", verifyToken, isAdmin, getAllKyc);

// manual approve
router.patch("/admin/approve/:id", verifyToken, isAdmin, adminApprove);

// manual reject
router.patch("/admin/reject/:id", verifyToken, isAdmin, adminReject);


module.exports = router;
