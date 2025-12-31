const express = require("express");
const router = express.Router();

const faqController = require("../controllers/faqController");
const { verifyToken, isAdmin } = require("../middlewares/auth");

// ================================
// ADMIN ROUTES
// ================================
router.post("/admin/app", verifyToken, isAdmin, faqController.createAppFaq);

router.post(
  "/admin/product/:productId",
  verifyToken,
  isAdmin,
  faqController.createProductFaq
);

router.put("/admin/:faqId", verifyToken, isAdmin, faqController.updateFaq);

router.delete("/admin/:faqId", verifyToken, isAdmin, faqController.deleteFaq);

// ================================
// USER ROUTES
// ================================
router.get("/app", faqController.getAppFaqs);
router.get("/product/:productId", faqController.getProductFaqs);

module.exports = router;
