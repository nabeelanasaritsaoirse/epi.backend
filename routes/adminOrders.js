const express = require("express");
const router = express.Router();

const {
  getCompletedOrders,
  getOrdersCompletingSoon,
  downloadShippingLabel
} = require("../controllers/adminOrdersController");

const { verifyToken, isAdmin } = require("../middlewares/auth");

router.get("/completed", verifyToken, isAdmin, getCompletedOrders);
router.get("/completing-soon", verifyToken, isAdmin, getOrdersCompletingSoon);
router.get("/:orderId/shipping-label", verifyToken, isAdmin, downloadShippingLabel);

module.exports = router;
