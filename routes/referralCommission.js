const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Order = require("../models/Order");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const recalcWallet = require("../services/walletCalculator");

// ----------------------------------------------------------------------
//  CREDIT REFERRAL COMMISSION AFTER ORDER COMPLETION
//  URL: POST /api/referral/credit/:orderId
// ----------------------------------------------------------------------
router.post("/credit/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order ID format" });
    }

    // 1. Fetch order
    const order = await Order.findById(orderId).populate("user");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // Only credit when order is completed
    if (order.orderStatus !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Referral commission can be credited only after order completion"
      });
    }

    const buyer = order.user;

    // 2. Check if buyer has a referrer
    if (!buyer.referredBy) {
      return res.status(400).json({
        success: false,
        message: "User was not referred by anyone. No commission applicable."
      });
    }

    // 3. Get the referrer
    const referrer = await User.findById(buyer.referredBy);
    if (!referrer) {
      return res.status(404).json({
        success: false,
        message: "Referrer not found"
      });
    }

    // 4. Calculate commission (20%)
    const commissionAmount = Number(order.orderAmount * 0.20).toFixed(2);

    // 5. Create referral transaction
    const tx = new Transaction({
      user: referrer._id,
      type: "referral_commission",
      amount: commissionAmount,
      status: "completed",
      paymentMethod: "referral_bonus",
      paymentDetails: { referralFrom: buyer._id, orderId },
      description: `Referral commission from order ${orderId}`
    });

    await tx.save();

    // 6. Recalculate referrer's wallet
    await recalcWallet(referrer._id);

    res.status(200).json({
      success: true,
      message: "Referral commission credited successfully",
      commissionAmount,
      referrerId: referrer._id,
      transactionId: tx._id
    });

  } catch (error) {
    console.error("Referral payout error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

module.exports = router;
