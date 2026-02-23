const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const WalletTransaction = require('../models/WalletTransaction');
const Product = require('../models/Product');
const razorpay = require('../config/razorpay');
const recalcWallet = require('../services/walletCalculator');

/* =====================================================================
   GET WALLET SUMMARY
===================================================================== */
router.get('/', verifyToken, async (req, res) => {
  try {
    const updatedUser = await recalcWallet(req.user._id);

    // Get legacy transactions
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
      type: "deposit",                    // User wallet load via Razorpay
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

    // Check KYC verification status before allowing withdrawal
    const userForKyc = await User.findById(req.user._id).select('kycDetails kycDocuments bankDetails');

    // Check new KYC system (separate Kyc model)
    const Kyc = require('../models/Kyc');
    const newKyc = await Kyc.findOne({ userId: req.user._id });
    const isNewKycApproved = newKyc && ['approved', 'auto_approved'].includes(newKyc.status);

    // Check old KYC system
    const kycDetails = userForKyc.kycDetails || {};
    const kycDocuments = userForKyc.kycDocuments || [];

    // Check if Aadhar is verified (old system)
    const aadharVerified = kycDetails.aadharVerified ||
      kycDocuments.some(doc =>
        doc.docType && doc.docType.toLowerCase().includes('aadhar') && doc.isVerified
      );

    // Check if PAN is verified (old system)
    const panVerified = kycDetails.panVerified ||
      kycDocuments.some(doc =>
        doc.docType && doc.docType.toLowerCase().includes('pan') && doc.isVerified
      );

    // Check if user has at least one bank account
    const hasBankAccount = userForKyc.bankDetails && userForKyc.bankDetails.length > 0;

    // KYC verification: NEW system OR OLD system must be approved
    const isKycApproved = isNewKycApproved || aadharVerified || panVerified;

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

    // Bank account required
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
    // Get legacy transactions
    const legacyTx = await Transaction.find({ user: req.user._id })
      .populate('product', 'name images pricing')
      .populate('order', 'orderAmount orderStatus')
      .sort({ createdAt: -1 });

    // Get wallet transactions from installment system
    const walletTx = await WalletTransaction.find({ user: req.user._id })
      .sort({ createdAt: -1 });

    // Helper function to get display type for frontend
    const getDisplayType = (type, amount) => {
      // Credit types (money added to wallet)
      if (['deposit', 'bonus', 'refund', 'referral_commission', 'installment_commission', 'commission', 'referral_bonus'].includes(type)) {
        return 'CREDIT';
      }
      // Debit types (money deducted from wallet)
      if (['withdrawal', 'purchase', 'emi_payment', 'investment'].includes(type)) {
        return 'DEBIT';
      }
      // Fallback: check amount sign
      return amount >= 0 ? 'CREDIT' : 'DEBIT';
    };

    // Combine all transactions
    const allTransactions = [
      ...legacyTx.map(t => ({
        _id: t._id,
        type: t.type,
        displayType: getDisplayType(t.type, t.amount),  // For frontend display
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
        displayType: getDisplayType(t.type, t.amount),  // For frontend display
        amount: t.amount,
        status: t.status,
        description: t.description,
        meta: t.meta,
        createdAt: t.createdAt,
        source: 'installment'
      }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Calculate summary statistics
    const summary = {
      total: allTransactions.length,
      completed: allTransactions.filter(t => t.status === 'completed').length,
      pending: allTransactions.filter(t => t.status === 'pending').length,
      failed: allTransactions.filter(t => t.status === 'failed').length,

      // Transaction types count
      razorpayPayments: legacyTx.filter(t => t.paymentMethod === 'razorpay').length,
      walletTransactions: allTransactions.filter(t => ['bonus', 'withdrawal', 'deposit'].includes(t.type)).length,
      emiPayments: legacyTx.filter(t => t.type === 'emi_payment').length,
      installmentPayments: walletTx.filter(t => t.type === 'withdrawal' && t.description.includes('Installment payment')).length,
      commissions: allTransactions.filter(t => ['referral_commission', 'commission', 'referral_bonus'].includes(t.type)).length,

      // Total amounts by type
      totalEarnings: allTransactions
        .filter(t => t.status === 'completed' && ['referral_commission', 'commission', 'bonus', 'referral_bonus'].includes(t.type))
        .reduce((sum, t) => sum + Math.abs(t.amount), 0),
      totalSpent: allTransactions
        .filter(t => t.status === 'completed' && (['purchase', 'emi_payment', 'withdrawal'].includes(t.type) || (t.type === 'withdrawal' && t.amount < 0)))
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
   Returns current withdrawable amount, hold balance, and 10% rule status.
   GET /wallet/withdrawal-status
===================================================================== */
router.get('/withdrawal-status', verifyToken, async (req, res) => {
  try {
    const user = await recalcWallet(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        code: "USER_NOT_FOUND"
      });
    }

    const commissionEarned    = user.wallet.commissionEarned    || 0;
    const commissionUsedInApp = user.wallet.commissionUsedInApp || 0;
    const requiredInApp       = commissionEarned * 0.1;
    const remainingToSpend    = Math.max(requiredInApp - commissionUsedInApp, 0);
    const holdBalance         = user.wallet.holdBalance || 0;
    const availableBalance    = user.wallet.balance     || 0;

    // 10% rule: commission must exist AND user must have spent enough in-app
    const ruleApplies  = commissionEarned > 0;
    const ruleMet      = !ruleApplies || commissionUsedInApp >= requiredInApp;
    const canWithdraw  = ruleMet && availableBalance > 0;

    // How much can be withdrawn right now
    const withdrawableNow = ruleMet ? availableBalance : 0;

    // How much will be withdrawable once rule is met
    // (current available + locked hold that will unlock)
    const withdrawableAfterUnlock = ruleMet
      ? withdrawableNow                          // rule already met
      : availableBalance + holdBalance;          // potential after spending remainingToSpend

    return res.status(200).json({
      success: true,
      canWithdraw,

      // Current balances
      withdrawableNow,
      holdBalance,
      availableBalance,

      // 10% rule details
      commissionRule: {
        applies: ruleApplies,
        met: ruleMet,
        commissionEarned,
        commissionUsedInApp,
        requiredInApp: parseFloat(requiredInApp.toFixed(2)),
        remainingToSpend: parseFloat(remainingToSpend.toFixed(2))
      },

      // What user can expect after completing the rule
      withdrawableAfterUnlock: parseFloat(withdrawableAfterUnlock.toFixed(2)),

      // Human-readable message
      message: !ruleApplies
        ? "No commission earned yet. You can freely withdraw your available balance."
        : !ruleMet
          ? `Spend ₹${parseFloat(remainingToSpend.toFixed(2))} more in-app to unlock withdrawal. After that you can withdraw ₹${parseFloat(withdrawableAfterUnlock.toFixed(2))}.`
          : availableBalance <= 0
            ? "Withdrawal limit met but no available balance to withdraw."
            : `You can withdraw up to ₹${parseFloat(withdrawableNow.toFixed(2))}.`
    });

  } catch (err) {
    console.error("Withdrawal status error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
