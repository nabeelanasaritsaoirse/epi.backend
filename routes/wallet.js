const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const WalletTransaction = require('../models/WalletTransaction');
const Product = require('../models/Product');
const razorpay = require('../config/razorpay');
const recalcWallet = require('../services/walletCalculator');

// Helper: determine CREDIT or DEBIT for frontend display
const getDisplayType = (type, amount) => {
  if (['deposit', 'bonus', 'refund', 'referral_bonus'].includes(type)) return 'CREDIT';
  if (['withdrawal', 'investment'].includes(type)) return 'DEBIT';
  return amount >= 0 ? 'CREDIT' : 'DEBIT';
};

/* =====================================================================
   GET WALLET SUMMARY
===================================================================== */
router.get('/', verifyToken, async (req, res) => {
  try {
    const updatedUser = await recalcWallet(req.user._id);

    // Get legacy transactions (deposits, withdrawals, bonuses, refunds)
    const legacyTransactions = await Transaction.find({ user: req.user._id })
      .sort({ createdAt: -1 });

    // Get wallet transactions from installment system
    const walletTransactions = await WalletTransaction.find({ user: req.user._id })
      .sort({ createdAt: -1 });

    // Combine and sort all transactions by date
    const allTransactions = [
      ...legacyTransactions.map(t => ({
        _id: t._id,
        type: t.type,
        displayType: getDisplayType(t.type, t.amount),
        amount: t.amount,
        status: t.status,
        description: t.description,
        paymentMethod: t.paymentMethod,
        createdAt: t.createdAt,
        source: 'legacy'
      })),
      ...walletTransactions.map(t => ({
        _id: t._id,
        type: t.type,
        displayType: getDisplayType(t.type, t.amount),
        amount: t.amount,
        status: t.status,
        description: t.description,
        meta: t.meta,
        createdAt: t.createdAt,
        source: 'installment'
      }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({
      success: true,
      message: "Wallet fetched",

      walletBalance:    updatedUser.wallet.balance,
      totalBalance:     updatedUser.totalBalance,
      holdBalance:      updatedUser.wallet.holdBalance,
      referralBonus:    updatedUser.wallet.referralBonus,
      availableBalance: updatedUser.availableBalance,
      totalEarnings:    updatedUser.totalEarnings,

      // Commission tracking for installment orders
      commissionEarned:    updatedUser.wallet.commissionEarned    || 0,
      commissionUsedInApp: updatedUser.wallet.commissionUsedInApp || 0,

      transactions: allTransactions
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

    // Cancel any previous pending deposits for this user (Razorpay abandoned attempts)
    await Transaction.updateMany(
      { user: req.user._id, type: 'deposit', status: 'pending' },
      { $set: { status: 'failed' } }
    );

    // Razorpay receipt must be <= 40 characters
    const userId    = req.user._id.toString();
    const timestamp = Date.now().toString();
    const receipt   = `w_${userId.slice(-12)}_${timestamp.slice(-10)}`;

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: 'INR',
      receipt: receipt
    });

    const tx = new Transaction({
      user: req.user._id,
      type: "deposit",
      amount,
      status: 'pending',
      paymentMethod: 'razorpay',
      paymentDetails: { orderId: order.id },
      description: 'Wallet load via Razorpay'
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

    const updatedUser = await recalcWallet(req.user._id);

    res.status(200).json({
      success: true,
      message: "Wallet updated",
      walletBalance: updatedUser.wallet.balance,
      transaction: tx
    });

  } catch (e) {
    console.error("Verify error:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* =====================================================================
   WITHDRAW MONEY
===================================================================== */
router.post('/withdraw', verifyToken, async (req, res) => {
  try {
    const { amount, paymentMethod, upiId, bankName, accountNumber, ifscCode, accountHolderName } = req.body;

    if (!amount || amount < 1)
      return res.status(400).json({ success: false, message: "Invalid amount" });

    if (!paymentMethod || !['upi', 'bank_transfer'].includes(paymentMethod))
      return res.status(400).json({ success: false, message: "Payment method must be 'upi' or 'bank_transfer'" });

    if (paymentMethod === 'upi' && !upiId)
      return res.status(400).json({ success: false, message: "UPI ID is required for UPI withdrawal" });

    if (paymentMethod === 'bank_transfer') {
      if (!bankName || !accountNumber || !ifscCode || !accountHolderName)
        return res.status(400).json({
          success: false,
          message: "Bank details required: bankName, accountNumber, ifscCode, accountHolderName"
        });
    }

    // Check KYC
    const userForKyc = await User.findById(req.user._id).select('kycDetails kycDocuments bankDetails');
    const Kyc = require('../models/Kyc');
    const newKyc = await Kyc.findOne({ userId: req.user._id });
    const isNewKycApproved = newKyc && ['approved', 'auto_approved'].includes(newKyc.status);

    const kycDetails   = userForKyc.kycDetails   || {};
    const kycDocuments = userForKyc.kycDocuments  || [];

    const aadharVerified = kycDetails.aadharVerified ||
      kycDocuments.some(doc => doc.docType && doc.docType.toLowerCase().includes('aadhar') && doc.isVerified);

    const panVerified = kycDetails.panVerified ||
      kycDocuments.some(doc => doc.docType && doc.docType.toLowerCase().includes('pan') && doc.isVerified);

    const hasBankAccount = userForKyc.bankDetails && userForKyc.bankDetails.length > 0;
    const isKycApproved  = isNewKycApproved || aadharVerified || panVerified;

    if (!isKycApproved) {
      return res.status(403).json({
        success: false,
        message: "KYC verification required. Please verify your Aadhar Card or PAN Card to enable withdrawals.",
        code: "KYC_NOT_VERIFIED",
        kycStatus: {
          newKycStatus: newKyc ? newKyc.status : 'not_submitted',
          isNewKycApproved,
          aadharVerified,
          panVerified,
          hasBankAccount
        }
      });
    }

    if (!hasBankAccount) {
      return res.status(400).json({
        success: false,
        message: "Please add at least one bank account before requesting a withdrawal.",
        code: "BANK_ACCOUNT_REQUIRED"
      });
    }

    const user = await recalcWallet(req.user._id);

    if (user.availableBalance < amount)
      return res.status(400).json({ success: false, message: "Insufficient withdrawable balance" });

    // Check 10% in-app usage rule for commission
    const commissionEarned    = user.wallet.commissionEarned    || 0;
    const commissionUsedInApp = user.wallet.commissionUsedInApp || 0;
    const requiredUsage       = commissionEarned * 0.1;

    if (commissionEarned > 0 && commissionUsedInApp < requiredUsage) {
      const remainingRequired = Math.ceil(requiredUsage - commissionUsedInApp);
      return res.status(400).json({
        success: false,
        message: `You must use at least 10% of your commission (₹${remainingRequired}) for in-app purchases before withdrawing.`,
        details: { commissionEarned, commissionUsedInApp, requiredUsage: Math.ceil(requiredUsage), remainingRequired }
      });
    }

    const tx = new Transaction({
      user: req.user._id,
      type: "withdrawal",
      amount,
      status: "pending",
      paymentMethod,
      paymentDetails: {
        upiId:              paymentMethod === 'upi'           ? upiId              : undefined,
        bankName:           paymentMethod === 'bank_transfer' ? bankName           : undefined,
        accountNumber:      paymentMethod === 'bank_transfer' ? accountNumber      : undefined,
        ifscCode:           paymentMethod === 'bank_transfer' ? ifscCode           : undefined,
        accountHolderName:  paymentMethod === 'bank_transfer' ? accountHolderName  : undefined
      },
      description: "Wallet withdrawal request"
    });

    await tx.save();

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

    const days  = Math.ceil(product.price / dailySavingAmount);
    const start = new Date();
    const end   = new Date();
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
   GET TRANSACTION HISTORY
===================================================================== */
router.get('/transactions', verifyToken, async (req, res) => {
  try {
    const legacyTx = await Transaction.find({ user: req.user._id })
      .populate('product', 'name images pricing')
      .populate('order', 'orderAmount orderStatus')
      .sort({ createdAt: -1 });

    const walletTx = await WalletTransaction.find({ user: req.user._id })
      .sort({ createdAt: -1 });

    const allTransactions = [
      ...legacyTx.map(t => ({
        _id: t._id,
        type: t.type,
        displayType: getDisplayType(t.type, t.amount),
        amount: t.amount,
        status: t.status,
        description: t.description,
        paymentMethod: t.paymentMethod,
        paymentDetails: t.paymentDetails,
        product: t.product,
        order: t.order,
        createdAt: t.createdAt,
        source: 'legacy'
      })),
      ...walletTx.map(t => ({
        _id: t._id,
        type: t.type,
        displayType: getDisplayType(t.type, t.amount),
        amount: t.amount,
        status: t.status,
        description: t.description,
        meta: t.meta,
        createdAt: t.createdAt,
        source: 'installment'
      }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const summary = {
      total:     allTransactions.length,
      completed: allTransactions.filter(t => t.status === 'completed').length,
      pending:   allTransactions.filter(t => t.status === 'pending').length,
      failed:    allTransactions.filter(t => t.status === 'failed').length,
      totalEarnings: allTransactions
        .filter(t => t.status === 'completed' && ['bonus', 'referral_bonus', 'refund'].includes(t.type))
        .reduce((sum, t) => sum + Math.abs(t.amount), 0),
      totalDeposited: allTransactions
        .filter(t => t.status === 'completed' && t.type === 'deposit')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0),
      totalWithdrawn: allTransactions
        .filter(t => t.status === 'completed' && t.type === 'withdrawal')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0)
    };

    res.status(200).json({
      success: true,
      transactions: allTransactions,
      summary
    });

  } catch (e) {
    console.error("Tx fetch error", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* =====================================================================
   GET WITHDRAWAL STATUS
===================================================================== */
router.get('/withdrawal-status', verifyToken, async (req, res) => {
  try {
    const user = await recalcWallet(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const commissionEarned    = user.wallet.commissionEarned    || 0;
    const commissionUsedInApp = user.wallet.commissionUsedInApp || 0;
    const requiredInApp       = commissionEarned * 0.1;
    const remainingToSpend    = Math.max(requiredInApp - commissionUsedInApp, 0);
    const holdBalance         = user.wallet.holdBalance || 0;
    const availableBalance    = user.wallet.balance     || 0;

    const ruleApplies = commissionEarned > 0;
    const ruleMet     = !ruleApplies || commissionUsedInApp >= requiredInApp;
    const canWithdraw = ruleMet && availableBalance > 0;

    const withdrawableNow = ruleMet ? availableBalance : 0;
    const withdrawableAfterUnlock = ruleMet
      ? withdrawableNow
      : availableBalance + holdBalance;

    return res.status(200).json({
      success: true,
      canWithdraw,
      withdrawableNow,
      holdBalance,
      availableBalance,
      commissionRule: {
        applies:           ruleApplies,
        met:               ruleMet,
        commissionEarned,
        commissionUsedInApp,
        requiredInApp:     parseFloat(requiredInApp.toFixed(2)),
        remainingToSpend:  parseFloat(remainingToSpend.toFixed(2))
      },
      withdrawableAfterUnlock: parseFloat(withdrawableAfterUnlock.toFixed(2)),
      message: !ruleApplies
        ? "No commission earned yet. You can freely withdraw your available balance."
        : !ruleMet
          ? `Spend ₹${parseFloat(remainingToSpend.toFixed(2))} more in-app to unlock withdrawal.`
          : availableBalance <= 0
            ? "No available balance to withdraw."
            : `You can withdraw up to ₹${parseFloat(withdrawableNow.toFixed(2))}.`
    });

  } catch (err) {
    console.error("Withdrawal status error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
