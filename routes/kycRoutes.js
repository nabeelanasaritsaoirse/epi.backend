const express = require("express");
const router = express.Router();

const { verifyToken, isAdmin } = require("../middlewares/auth");

const {
  submitKyc,
  getKycStatus,
  getAllKyc,
  adminApprove,
  adminReject
} = require("../controllers/kycController");


/* ============================================================
   USER ROUTES
============================================================ */
router.post("/submit", verifyToken, submitKyc);
router.get("/status", verifyToken, getKycStatus);


/* ============================================================
   ADMIN ROUTES
============================================================ */

// Get full KYC list for admin dashboard
router.get("/admin/all", verifyToken, isAdmin, getAllKyc);

// Approve KYC
router.patch("/admin/approve/:id", verifyToken, isAdmin, adminApprove);

// Reject KYC with note
router.patch("/admin/reject/:id", verifyToken, isAdmin, adminReject);


module.exports = router;
