const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const recalcWallet = require('../services/walletCalculator');
const { verifyToken, isAdmin } = require('../middlewares/auth');


/* ---------------------------------------------------
   Fetch Wallet by Email / Phone
----------------------------------------------------*/
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { email, phone } = req.query;

    if (!email && !phone) {
      return res.status(400).json({ success: false, message: 'Email or phone required' });
    }

    const user = await User.findOne({
      $or: [
        email ? { email } : {},
        phone ? { phoneNumber: phone } : {}
      ]
    });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // recalc wallet based on Transactions
    await recalcWallet(user._id);

    const refreshed = await User.findById(user._id);

    const txns = await Transaction.find({ user: user._id }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
      },
      availableBalance: refreshed.wallet.balance,
      holdBalance: refreshed.wallet.holdBalance,
      referralBonus: refreshed.wallet.referralBonus,
      investedAmount: refreshed.wallet.investedAmount,
      requiredInvestment: refreshed.wallet.requiredInvestment,

      transactions: txns,
    });

  } catch (err) {
    console.error("Admin wallet GET error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});


/* ---------------------------------------------------
   CREDIT MONEY (Admin Manual Add)
----------------------------------------------------*/
router.post('/credit', verifyToken, isAdmin, async (req, res) => {
  try {
    const { email, phone, amount, description } = req.body;
    if (!email && !phone) return res.json({ success: false, message: "Email or phone required" });

    const user = await User.findOne({
      $or: [
        email ? { email } : {},
        phone ? { phoneNumber: phone } : {}
      ]
    });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Create transaction
    await Transaction.create({
      user: user._id,
      type: "bonus",
      amount,
      status: "completed",
      paymentMethod: "system",
      description: description || "Admin credit"
    });

    await recalcWallet(user._id);

    return res.json({ success: true, message: "Amount credited" });

  } catch (err) {
    console.error("Admin credit error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});


/* ---------------------------------------------------
   DEBIT MONEY (Admin Manual Deduction)
----------------------------------------------------*/
router.post('/debit', verifyToken, isAdmin, async (req, res) => {
  try {
    const { email, phone, amount, description } = req.body;

    if (!email && !phone) 
      return res.json({ success: false, message: "Email or phone required" });

    const user = await User.findOne({
      $or: [
        email ? { email } : {},
        phone ? { phoneNumber: phone } : {}
      ]
    });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Create debit transaction
    await Transaction.create({
      user: user._id,
      type: "withdrawal",
      amount,
      status: "completed",
      paymentMethod: "system",
      description: description || "Admin debit"
    });

    await recalcWallet(user._id);

    return res.json({ success: true, message: "Amount deducted" });

  } catch (err) {
    console.error("Admin debit error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});


/* ---------------------------------------------------
   UNLOCK REFERRAL HOLD
----------------------------------------------------*/
router.post('/unlock', verifyToken, isAdmin, async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone)
      return res.json({ success: false, message: "Email or phone required" });

    const user = await User.findOne({
      $or: [
        email ? { email } : {},
        phone ? { phoneNumber: phone } : {}
      ]
    });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Unlock: move hold -> balance
    const unlocked = user.wallet.holdBalance;

    if (unlocked <= 0)
      return res.json({ success: false, message: "No hold balance to unlock" });

    user.wallet.balance += unlocked;
    user.wallet.holdBalance = 0;
    await user.save();

    // Log unlock as transaction
    await Transaction.create({
      user: user._id,
      type: "bonus",
      amount: unlocked,
      status: "completed",
      paymentMethod: "system",
      description: "Admin unlock referral hold"
    });

    await recalcWallet(user._id);

    return res.json({ success: true, message: "Referral unlocked" });

  } catch (err) {
    console.error("Admin unlock error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});


module.exports = router;
