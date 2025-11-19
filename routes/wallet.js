const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const razorpay = require('../config/razorpay');
const recalcWallet = require('../services/walletCalculator');

/* =====================================================================
   GET WALLET SUMMARY
===================================================================== */
router.get('/', verifyToken, async (req, res) => {
  try {
    const updatedUser = await recalcWallet(req.user._id);

    const transactions = await Transaction.find({ user: req.user._id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Wallet fetched",

      walletBalance: updatedUser.wallet.balance,
      totalBalance: updatedUser.totalBalance,

      holdBalance: updatedUser.wallet.holdBalance,
      referralBonus: updatedUser.wallet.referralBonus,

      investedAmount: updatedUser.wallet.investedAmount,
      requiredInvestment: updatedUser.wallet.requiredInvestment,

      availableBalance: updatedUser.availableBalance,
      totalEarnings: updatedUser.totalEarnings,

      transactions
    });
  } catch (err) {
    console.error("Wallet fetch error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* =====================================================================
   ADD MONEY — CREATE RAZORPAY ORDER
===================================================================== */
router.post('/add-money', verifyToken, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount < 1)
      return res.status(400).json({ message: 'Invalid amount' });

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: 'INR',
      receipt: `wallet_${req.user._id}_${Date.now()}`
    });

    const tx = new Transaction({
      user: req.user._id,
      type: "bonus",                      // FIXED
      amount,
      status: 'pending',
      paymentMethod: 'razorpay',
      paymentDetails: { orderId: order.id },
      description: 'Wallet load'
    });

    await tx.save();

    res.status(200).json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      transaction_id: tx._id
    });

  } catch (e) {
    console.error("Add money error", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* =====================================================================
   VERIFY WALLET MONEY PAYMENT
===================================================================== */
router.post('/verify-payment', verifyToken, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      transaction_id
    } = req.body;

    const tx = await Transaction.findById(transaction_id);
    if (!tx) return res.status(404).json({ message: "Transaction not found" });

    tx.status = "completed";
    tx.paymentDetails.paymentId = razorpay_payment_id;
    tx.paymentDetails.signature = razorpay_signature;
    await tx.save();

    await recalcWallet(req.user._id);

    res.status(200).json({
      success: true,
      message: "Wallet updated",
      transaction: tx
    });

  } catch (e) {
    console.error("Verify error:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* =====================================================================
   WITHDRAW MONEY (ONLY unlockable balance allowed)
===================================================================== */
router.post('/withdraw', verifyToken, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount < 1)
      return res.status(400).json({ message: "Invalid amount" });

    const user = await recalcWallet(req.user._id);

    if (user.availableBalance < amount)
      return res.status(400).json({ message: "Insufficient withdrawable balance" });

    const tx = new Transaction({
      user: req.user._id,
      type: "withdrawal",
      amount,
      status: "completed",
      paymentMethod: "bank_transfer",
      description: "Wallet withdrawal"
    });

    await tx.save();
    await recalcWallet(req.user._id);

    res.status(200).json({
      success: true,
      message: "Withdrawal processed",
      withdrawal: tx
    });

  } catch (e) {
    console.error("Withdraw error:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* =====================================================================
   CREATE SAVING PLAN
===================================================================== */
router.post('/create-saving-plan', verifyToken, async (req, res) => {
  try {
    const { productId, dailySavingAmount } = req.body;

    if (!productId || !dailySavingAmount)
      return res.status(400).json({ message: "Invalid request" });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const days = Math.ceil(product.price / dailySavingAmount);

    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);

    const plan = {
      product: productId,
      targetAmount: product.price,
      savedAmount: 0,
      dailySavingAmount,
      startDate: start,
      endDate: end,
      status: "active"
    };

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { $push: { savedPlans: plan } },
      { new: true }
    ).populate("savedPlans.product");

    res.status(201).json({
      success: true,
      message: "Saving plan created",
      plan: updated.savedPlans[updated.savedPlans.length - 1]
    });

  } catch (e) {
    console.error("Saving plan creation error:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* =====================================================================
   ADD INVESTMENT (used for unlocking referral hold)
===================================================================== */
router.post('/invest', verifyToken, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount < 1)
      return res.status(400).json({ message: "Invalid amount" });

    const user = await User.findById(req.user._id);

    if (user.wallet.balance < amount)
      return res.status(400).json({ message: "Insufficient balance" });

    const tx = new Transaction({
      user: req.user._id,
      type: "investment",
      amount,
      status: "completed",
      paymentMethod: "system",
      description: "Referral unlock investment"
    });

    await tx.save();
    await recalcWallet(req.user._id);

    res.status(200).json({
      success: true,
      message: "Investment added",
      transaction: tx
    });

  } catch (e) {
    console.error("Add investment error:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* =====================================================================
   GET TRANSACTION HISTORY ONLY
===================================================================== */
router.get('/transactions', verifyToken, async (req, res) => {
  try {
    const tx = await Transaction.find({ user: req.user._id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      transactions: tx
    });

  } catch (e) {
    console.error("Tx fetch error", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
