"use strict";

const express      = require("express");
const router       = express.Router();
const sellerController = require("../controllers/sellerController");
const { verifyToken, isSeller } = require("../middlewares/auth");

// All routes in this file require a valid JWT + seller role
router.use(verifyToken, isSeller);

// ── Profile ──────────────────────────────────────────────────────────────────
router.get("/profile", sellerController.getProfile);
router.put("/profile", sellerController.updateProfile);

// ── Dashboard ────────────────────────────────────────────────────────────────
router.get("/dashboard", sellerController.getDashboard);

// ── Products (scoped to own products) ────────────────────────────────────────
router.get("/products",            sellerController.getProducts);
router.post("/products",           sellerController.createProduct);
router.put("/products/:productId", sellerController.updateProduct);
router.delete("/products/:productId", sellerController.deleteProduct);

// ── Orders (scoped to own orders) ────────────────────────────────────────────
router.get("/orders",                          sellerController.getOrders);
router.get("/orders/:orderId",                 sellerController.getOrderById);
router.patch("/orders/:orderId/fulfillment",   sellerController.updateFulfillment);

module.exports = router;
