const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { verifyToken } = require("../middlewares/auth");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const razorpay = require("../config/razorpay");
const recalcWallet = require("../services/walletCalculator");

// -----------------------------------------------------------
// CREATE ORDER
// -----------------------------------------------------------
router.post("/", verifyToken, async (req, res) => {
  try {
    const { productId, paymentOption, paymentDetails, deliveryAddress, couponCode } = req.body;
    const userId = req.user._id; // Token se user ID liya

    if (!productId || !paymentOption)
      return res.status(400).json({ message: "Missing required fields" });

    // Handle both custom productId and MongoDB _id
    let product;
    if (mongoose.Types.ObjectId.isValid(productId) && productId.length === 24) {
      product = await Product.findById(productId);
    }
    if (!product) {
      product = await Product.findOne({ productId });
    }
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Validate product has pricing information
    if (!product.pricing || !product.pricing.finalPrice) {
      return res.status(400).json({ message: "Product pricing information is missing" });
    }

    // ---------------------------------------------
    // 🎟️ COUPON VALIDATION
    // ---------------------------------------------
    let finalPrice = product.pricing.finalPrice;
    let appliedCoupon = null;

    if (couponCode) {
      const Coupon = require('../models/Coupon');
      const coupon = await Coupon.findOne({ couponCode: couponCode.toUpperCase() });

      if (!coupon) {
        return res.status(404).json({ message: `Coupon '${couponCode}' not found` });
      }

      if (!coupon.isActive) {
        return res.status(400).json({ message: `Coupon '${couponCode}' is not active` });
      }

      const now = new Date();
      if (now > coupon.expiryDate) {
        return res.status(400).json({ message: `Coupon '${couponCode}' has expired` });
      }

      if (product.pricing.finalPrice < coupon.minOrderValue) {
        return res.status(400).json({
          message: `Minimum order value of ₹${coupon.minOrderValue} required for this coupon`,
          minOrderValue: coupon.minOrderValue
        });
      }

      // Calculate discount
      let discountAmount = 0;
      if (coupon.discountType === 'flat') {
        discountAmount = coupon.discountValue;
      } else if (coupon.discountType === 'percentage') {
        discountAmount = Math.round((product.pricing.finalPrice * coupon.discountValue) / 100);
      }

      discountAmount = Math.min(discountAmount, product.pricing.finalPrice);
      finalPrice = product.pricing.finalPrice - discountAmount;

      appliedCoupon = {
        code: coupon.couponCode,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: discountAmount
      };
    }

    const standardizedPayment = { ...paymentDetails, startDate: new Date() };

    // ---------------------------------------------
    // 💰 DAILY PAYMENT CALCULATION
    // ---------------------------------------------
    if (paymentOption === "daily") {
      let dailyAmount, totalDays;

      // Case 1: Frontend sent totalDays → Calculate dailyAmount
      if (paymentDetails?.totalDays) {
        totalDays = paymentDetails.totalDays;
        dailyAmount = Math.ceil(finalPrice / totalDays);
      }
      // Case 2: Frontend sent dailyAmount → Calculate totalDays
      else if (paymentDetails?.dailyAmount) {
        dailyAmount = paymentDetails.dailyAmount;
        totalDays = Math.ceil(finalPrice / dailyAmount);
      }
      // Case 3: Neither sent → Default dailyAmount = 100
      else {
        dailyAmount = 100;
        totalDays = Math.ceil(finalPrice / dailyAmount);
      }

      // ✅ Validation: Minimum daily amount ₹50
      if (dailyAmount < 50) {
        return res.status(400).json({
          message: "Minimum daily payment is ₹50",
          calculatedDailyAmount: dailyAmount,
          suggestedDays: Math.ceil(finalPrice / 50)
        });
      }

      // ✅ Validation: Minimum 5 days investment period
      if (totalDays < 5) {
        return res.status(400).json({
          message: "Minimum investment period is 5 days",
          calculatedDays: totalDays,
          suggestedDailyAmount: Math.ceil(finalPrice / 5)
        });
      }

      // ✅ Validation: Total amount should match final price
      const calculatedTotal = dailyAmount * totalDays;
      if (calculatedTotal < finalPrice) {
        return res.status(400).json({
          message: "Total payment amount is less than product price",
          productPrice: finalPrice,
          dailyAmount: dailyAmount,
          totalDays: totalDays,
          calculatedTotal: calculatedTotal,
          shortfall: finalPrice - calculatedTotal
        });
      }

      const end = new Date();
      end.setDate(end.getDate() + totalDays);

      standardizedPayment.dailyAmount = dailyAmount;
      standardizedPayment.totalDuration = totalDays;
      standardizedPayment.endDate = end;
      standardizedPayment.totalEmis = totalDays;
    }

    const order = new Order({
      user: userId,
      product: product._id, // Store MongoDB ObjectId, not custom productId
      orderAmount: finalPrice, // Final price after coupon discount
      paymentOption,
      paymentDetails: standardizedPayment,
      deliveryAddress,
    });

    // -------------------------------
    // Upfront Payment
    // -------------------------------
    if (paymentOption === "upfront") {
      const user = await User.findById(userId);
      if (user.wallet.balance < finalPrice)
        return res.status(400).json({
          message: "Insufficient wallet balance",
          required: finalPrice,
          available: user.wallet.balance
        });

      const tx = new Transaction({
        user: userId,
        type: "purchase",
        amount: finalPrice,
        status: "completed",
        paymentMethod: "system",
        product: productId,
        description: `Upfront payment for ${product.name}`,
      });

      await tx.save();

      user.wallet.balance -= finalPrice;
      await user.save();

      order.paymentStatus = "completed";
      order.orderStatus = "confirmed";
    }

    await order.save();

    // -------------------------------
    // Daily EMI → first payment setup
    // -------------------------------
    if (paymentOption === "daily") {
      const dailyAmount = standardizedPayment.dailyAmount;

      const rpOrder = await razorpay.orders.create({
        amount: dailyAmount * 100,
        currency: "INR",
        receipt: `emi_${Date.now()}`,
        payment_capture: 1,
        notes: { order_id: order._id.toString() },
      });

      const tx = new Transaction({
        user: userId,
        type: "emi_payment",
        amount: dailyAmount,
        status: "pending",
        paymentMethod: "razorpay",
        order: order._id,
        product: productId,
        paymentDetails: {
          orderId: rpOrder.id,
          emiNumber: 1,
        },
        description: `Daily EMI payment for ${product.name}`,
      });

      await tx.save();

      return res.status(201).json({
        message: "Order created",
        order,
        pricing: {
          originalPrice: product.pricing.finalPrice,
          finalPrice: finalPrice,
          coupon: appliedCoupon
        },
        payment: {
          order_id: rpOrder.id,
          amount: rpOrder.amount,
          currency: rpOrder.currency,
          transaction_id: tx._id,
          key_id: process.env.RAZORPAY_KEY_ID,
        },
      });
    }

    return res.status(201).json({
      message: "Order created",
      order,
      pricing: {
        originalPrice: product.pricing.finalPrice,
        finalPrice: finalPrice,
        coupon: appliedCoupon
      }
    });

  } catch (err) {
    console.error("Order create error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -----------------------------------------------------------
// CREATE PAYMENT FOR EMI
// -----------------------------------------------------------
router.post("/:id/create-payment", verifyToken, async (req, res) => {
  try {
    const { paymentAmount } = req.body;

    if (!paymentAmount || paymentAmount <= 0)
      return res.status(400).json({ message: "Invalid amount" });

    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!order) return res.status(404).json({ message: "Order not found" });

    const rpOrder = await razorpay.orders.create({
      amount: paymentAmount * 100,
      currency: "INR",
      receipt: `emi_${Date.now()}`,
    });

    // Count EMIs already done for this order
    const previousEmis = await Transaction.countDocuments({
      order: order._id,
      type: "emi_payment",
    });

    const tx = new Transaction({
      user: req.user._id,
      type: "emi_payment",
      amount: paymentAmount,
      status: "pending",
      paymentMethod: "razorpay",
      order: order._id,
      product: order.product,
      paymentDetails: {
        orderId: rpOrder.id,
        emiNumber: previousEmis + 1,
      },
      description: `EMI payment #${previousEmis + 1} for order ${order._id}`,
    });

    await tx.save();

    res.status(200).json({
      order_id: rpOrder.id,
      amount: rpOrder.amount,
      currency: rpOrder.currency,
      transaction_id: tx._id,
      key_id: process.env.RAZORPAY_KEY_ID,
    });

  } catch (err) {
    console.error("Create EMI payment error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -----------------------------------------------------------
// VERIFY PAYMENT + PROCESS ALL COMMISSIONS
// -----------------------------------------------------------
router.post("/:id/verify-payment", verifyToken, async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_signature, transaction_id } = req.body;

    const tx = await Transaction.findById(transaction_id);
    if (!tx) return res.status(404).json({ message: "Transaction not found" });

    // Mark EMI as completed
    tx.status = "completed";
    tx.paymentDetails.paymentId = razorpay_payment_id;
    tx.paymentDetails.signature = razorpay_signature;
    await tx.save();

    const order = await Order.findById(req.params.id);
    const buyer = await User.findById(order.user);

    // ---------------------------------------------
    // 1. PAY REFERRER (20%)
    // ---------------------------------------------
    if (buyer.referredBy) {
      const referrer = await User.findById(buyer.referredBy);

      const refCommission = Number(tx.amount * 0.20).toFixed(2);

      await Transaction.create({
        user: referrer._id,
        type: "referral_commission",
        amount: Number(refCommission),
        status: "completed",
        paymentMethod: "referral_bonus",
        order: order._id,
        product: order.product,
        paymentDetails: {
          emiNumber: tx.paymentDetails.emiNumber,
          referralFrom: buyer._id,
        },
        description: `20% referral commission for EMI #${tx.paymentDetails.emiNumber}`,
      });

      await recalcWallet(referrer._id);
    }

    // ---------------------------------------------
    // 2. PAY ADMIN (YOUR 10% COMMISSION)
    // ---------------------------------------------
    const adminUser = await User.findOne({ role: "admin" });
    if (adminUser) {
      const adminCommission = Number(tx.amount * 0.10).toFixed(2);

      await Transaction.create({
        user: adminUser._id,
        type: "commission",
        amount: Number(adminCommission),
        status: "completed",
        paymentMethod: "system",
        order: order._id,
        product: order.product,
        paymentDetails: {
          emiNumber: tx.paymentDetails.emiNumber,
        },
        description: `10% admin commission for EMI #${tx.paymentDetails.emiNumber}`,
      });

      await recalcWallet(adminUser._id);
    }

    // ---------------------------------------------
    // 3. UPDATE ORDER PROGRESS
    // ---------------------------------------------
    order.currentEmiNumber += 1; // Increment EMI count
    order.emiPaidAmount += tx.amount; // Add to EMI paid amount
    order.totalPaid += tx.amount; // Add to total paid

    // Update payment status
    if (order.paymentStatus === "pending") {
      order.paymentStatus = "partial";
    }

    // Confirm order on first payment
    if (order.orderStatus === "pending") {
      order.orderStatus = "confirmed";
    }

    // ✅ CHECK: Minimum 5 days completed
    const totalEmis = order.paymentDetails.totalEmis || order.paymentDetails.totalDuration;
    const minDaysCompleted = order.currentEmiNumber >= 5;

    // ✅ CHECK: All EMIs completed
    const allEmisCompleted = order.currentEmiNumber >= totalEmis;

    if (allEmisCompleted || order.totalPaid >= order.orderAmount) {
      order.paymentStatus = "completed";
      order.orderStatus = "completed";
    }

    await order.save();

    res.status(200).json({
      message: "Payment successful",
      order,
      transaction: tx,
      progress: {
        currentEmi: order.currentEmiNumber,
        totalEmis: totalEmis,
        paidAmount: order.totalPaid,
        remainingAmount: order.orderAmount - order.totalPaid,
        minDaysCompleted: minDaysCompleted,
        orderComplete: order.orderStatus === "completed"
      }
    });

  } catch (err) {
    console.error("Verify EMI payment error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -----------------------------------------------------------
// ADMIN — GET ALL ORDERS
// -----------------------------------------------------------
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("user")
      .populate("product");

    res.status(200).json({ success: true, orders });

  } catch (err) {
    console.error("Orders fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -----------------------------------------------------------
// GET SINGLE ORDER
// -----------------------------------------------------------
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).populate("product");

    if (!order) return res.status(404).json({ message: "Order not found" });

    res.status(200).json(order);

  } catch (err) {
    console.error("Order fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -----------------------------------------------------------
// CANCEL ORDER
// -----------------------------------------------------------
router.put("/:id/cancel", verifyToken, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!order) return res.status(404).json({ message: "Order not found" });

    if (["completed", "cancelled"].includes(order.orderStatus))
      return res.status(400).json({ message: "Cannot cancel this order" });

    order.orderStatus = "cancelled";
    await order.save();

    res.status(200).json({ message: "Order cancelled", order });

  } catch (err) {
    console.error("Order cancel error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
