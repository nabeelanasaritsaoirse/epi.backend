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

      // NEW: Commission tracking for installment orders
      commissionEarned: updatedUser.wallet.commissionEarned || 0,
      commissionUsedInApp: updatedUser.wallet.commissionUsedInApp || 0,
      commissionWithdrawable: (() => {
        const earned = updatedUser.wallet.commissionEarned || 0;
        const used = updatedUser.wallet.commissionUsedInApp || 0;
        const requiredInAppUsage = earned * 0.1; // 10% must be used in-app

        // User can only withdraw if they've used at least 10% in-app
        if (used >= requiredInAppUsage) {
          return Math.max(0, earned - used);
        }
        return 0;
      })(),

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

    // Razorpay receipt must be <= 40 characters
    // Format: w_<last12chars_of_userId>_<last10digits_of_timestamp>
    const userId = req.user._id.toString();
    const timestamp = Date.now().toString();
    const receipt = `w_${userId.slice(-12)}_${timestamp.slice(-10)}`;

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: 'INR',
      receipt: receipt
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
    const { amount, paymentMethod, upiId, bankName, accountNumber, ifscCode, accountHolderName } = req.body;

    // Validate amount
    if (!amount || amount < 1)
      return res.status(400).json({ success: false, message: "Invalid amount" });

    // Validate payment method
    if (!paymentMethod || !['upi', 'bank_transfer'].includes(paymentMethod))
      return res.status(400).json({ success: false, message: "Payment method must be 'upi' or 'bank_transfer'" });

    // Validate UPI details
    if (paymentMethod === 'upi' && !upiId)
      return res.status(400).json({ success: false, message: "UPI ID is required for UPI withdrawal" });

    // Validate bank details
    if (paymentMethod === 'bank_transfer') {
      if (!bankName || !accountNumber || !ifscCode || !accountHolderName)
        return res.status(400).json({
          success: false,
          message: "Bank details required: bankName, accountNumber, ifscCode, accountHolderName"
        });
    }

    const user = await recalcWallet(req.user._id);

    if (user.availableBalance < amount)
      return res.status(400).json({ success: false, message: "Insufficient withdrawable balance" });

    // NEW: Check 10% in-app usage rule for commission
    const commissionEarned = user.wallet.commissionEarned || 0;
    const commissionUsedInApp = user.wallet.commissionUsedInApp || 0;
    const requiredUsage = commissionEarned * 0.1; // 10% must be used in-app

    if (commissionEarned > 0 && commissionUsedInApp < requiredUsage) {
      const remainingRequired = Math.ceil(requiredUsage - commissionUsedInApp);
      return res.status(400).json({
        success: false,
        message: `You must use at least 10% of your commission (₹${remainingRequired}) for in-app purchases before withdrawing. Total commission earned: ₹${commissionEarned}, Used in-app: ₹${commissionUsedInApp}`,
        details: {
          commissionEarned,
          commissionUsedInApp,
          requiredUsage: Math.ceil(requiredUsage),
          remainingRequired
        }
      });
    }

    // Create withdrawal transaction with pending status
    const tx = new Transaction({
      user: req.user._id,
      type: "withdrawal",
      amount,
      status: "pending",
      paymentMethod,
      paymentDetails: {
        upiId: paymentMethod === 'upi' ? upiId : undefined,
        bankName: paymentMethod === 'bank_transfer' ? bankName : undefined,
        accountNumber: paymentMethod === 'bank_transfer' ? accountNumber : undefined,
        ifscCode: paymentMethod === 'bank_transfer' ? ifscCode : undefined,
        accountHolderName: paymentMethod === 'bank_transfer' ? accountHolderName : undefined
      },
      description: "Wallet withdrawal request"
    });

    await tx.save();

    // Note: We do NOT recalculate wallet here - amount will be deducted when admin approves

    res.status(200).json({
      success: true,
      message: "Your withdrawal request has been submitted successfully. Money will be credited within 2 days.",
      withdrawal: {
        _id: tx._id,
        amount: tx.amount,
        paymentMethod: tx.paymentMethod,
        status: tx.status,
        createdAt: tx.createdAt
      }
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
   GET TRANSACTION HISTORY (ALL TYPES: RAZORPAY, WALLET, EMI, ETC.)
===================================================================== */
router.get('/transactions', verifyToken, async (req, res) => {
  try {
    const tx = await Transaction.find({ user: req.user._id })
      .populate('product', 'name images pricing')
      .populate('order', 'orderAmount orderStatus')
      .sort({ createdAt: -1 });

    // Calculate summary statistics
    const summary = {
      total: tx.length,
      completed: tx.filter(t => t.status === 'completed').length,
      pending: tx.filter(t => t.status === 'pending').length,
      failed: tx.filter(t => t.status === 'failed').length,

      // Transaction types count
      razorpayPayments: tx.filter(t => t.paymentMethod === 'razorpay').length,
      walletTransactions: tx.filter(t => ['bonus', 'withdrawal'].includes(t.type)).length,
      emiPayments: tx.filter(t => t.type === 'emi_payment').length,
      commissions: tx.filter(t => ['referral_commission', 'commission'].includes(t.type)).length,

      // Total amounts by type
      totalEarnings: tx
        .filter(t => t.status === 'completed' && ['referral_commission', 'commission', 'bonus'].includes(t.type))
        .reduce((sum, t) => sum + t.amount, 0),
      totalSpent: tx
        .filter(t => t.status === 'completed' && ['purchase', 'emi_payment', 'withdrawal'].includes(t.type))
        .reduce((sum, t) => sum + t.amount, 0)
    };

    res.status(200).json({
      success: true,
      transactions: tx,
      summary
    });

  } catch (e) {
    console.error("Tx fetch error", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
