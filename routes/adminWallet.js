const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Transaction = require("../models/Transaction");
const recalcWallet = require("../services/walletCalculator");
const { verifyToken, isAdmin } = require("../middlewares/auth");

/* ---------------------------------------------------
   Fetch Wallet by Email / Phone
----------------------------------------------------*/
router.get("/", verifyToken, isAdmin, async (req, res) => {
  console.log("QUERY RECEIVED:", req.query);
  try {
    const { email, phone } = req.query;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: "Email or phone required",
      });
    }

    // 🔥 FIXED PHONE SEARCH — supports:
    // 1) 9876543210
    // 2) +919876543210
    // 3) 919876543210
    let phoneQuery = {};
    if (phone) {
      phoneQuery = {
        phoneNumber: {
          $in: [phone, `+91${phone}`, `91${phone}`],
        },
      };
    }

    // Build $or conditions only for provided criteria
    const orConditions = [];
    if (email) orConditions.push({ email });
    if (phone) orConditions.push(phoneQuery);
    if (orConditions.length === 0) {
      return res.status(400).json({ success: false, message: "Email or phone required" });
    }
    const user = await User.findOne({ $or: orConditions });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // RECALCULATE WALLET
    await recalcWallet(String(user._id));

    // GET FRESH USER DATA
    const refreshed = await User.findById(user._id);

    // TRANSACTIONS
    const txns = await Transaction.find({ user: user._id }).sort({
      createdAt: -1,
    });

    return res.json({
      success: true,

      user: {
        _id: refreshed._id,
        name: refreshed.name,
        email: refreshed.email,
        phoneNumber: refreshed.phoneNumber,
      },

      availableBalance: refreshed.availableBalance ?? refreshed.wallet.balance,
      totalBalance: refreshed.totalBalance ?? 0,

      holdBalance: refreshed.wallet.holdBalance ?? 0,
      referralBonus: refreshed.wallet.referralBonus ?? 0,
      investedAmount: refreshed.wallet.investedAmount ?? 0,
      requiredInvestment: refreshed.wallet.requiredInvestment ?? 0,

      transactions: txns,
    });
  } catch (err) {
    console.error("Admin wallet GET error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/* ---------------------------------------------------
   CREDIT MONEY (Admin Manual Add)
----------------------------------------------------*/
router.post("/credit", verifyToken, isAdmin, async (req, res) => {
  try {
    const { email, phone, amount, description } = req.body;

    if (!email && !phone) {
      return res.json({ success: false, message: "Email or phone required" });
    }

    let phoneQuery = {};
    if (phone) {
      phoneQuery = {
        phoneNumber: {
          $in: [phone, `+91${phone}`, `91${phone}`],
        },
      };
    }

    // Build $or conditions only for provided criteria
    const orConditions = [];
    if (email) orConditions.push({ email });
    if (phone) orConditions.push(phoneQuery);
    if (orConditions.length === 0) {
      return res.status(400).json({ success: false, message: "Email or phone required" });
    }
    const user = await User.findOne({ $or: orConditions });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await Transaction.create({
      user: user._id,
      type: "bonus",
      amount,
      status: "completed",
      paymentMethod: "system",
      description: description || "Admin credit",
    });

    await recalcWallet(user._id);

    return res.json({ success: true, message: "Amount credited" });
  } catch (err) {
    console.error("Admin credit error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/* ---------------------------------------------------
   DEBIT MONEY (Admin Manual Deduction)
----------------------------------------------------*/
router.post("/debit", verifyToken, isAdmin, async (req, res) => {
  try {
    const { email, phone, amount, description } = req.body;

    if (!email && !phone) {
      return res.json({ success: false, message: "Email or phone required" });
    }

    let phoneQuery = {};
    if (phone) {
      phoneQuery = {
        phoneNumber: {
          $in: [phone, `+91${phone}`, `91${phone}`],
        },
      };
    }

    // Build $or conditions only for provided criteria
    const orConditions = [];
    if (email) orConditions.push({ email });
    if (phone) orConditions.push(phoneQuery);
    if (orConditions.length === 0) {
      return res.status(400).json({ success: false, message: "Email or phone required" });
    }
    const user = await User.findOne({ $or: orConditions });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await Transaction.create({
      user: user._id,
      type: "withdrawal",
      amount,
      status: "completed",
      paymentMethod: "system",
      description: description || "Admin debit",
    });

    await recalcWallet(user._id);

    return res.json({ success: true, message: "Amount deducted" });
  } catch (err) {
    console.error("Admin debit error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/* ---------------------------------------------------
   UNLOCK REFERRAL HOLD
----------------------------------------------------*/
router.post("/unlock", verifyToken, isAdmin, async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.json({ success: false, message: "Email or phone required" });
    }

    let phoneQuery = {};
    if (phone) {
      phoneQuery = {
        phoneNumber: {
          $in: [phone, `+91${phone}`, `91${phone}`],
        },
      };
    }

    // Build $or conditions only for provided criteria
    const orConditions = [];
    if (email) orConditions.push({ email });
    if (phone) orConditions.push(phoneQuery);
    if (orConditions.length === 0) {
      return res.status(400).json({ success: false, message: "Email or phone required" });
    }
    const user = await User.findOne({ $or: orConditions });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const unlocked = user.wallet.holdBalance;

    if (unlocked <= 0) {
      return res.json({
        success: false,
        message: "No hold balance to unlock",
      });
    }

    user.wallet.balance += unlocked;
    user.wallet.holdBalance = 0;
    await user.save();

    await Transaction.create({
      user: user._id,
      type: "bonus",
      amount: unlocked,
      status: "completed",
      paymentMethod: "system",
      description: "Admin unlock referral hold",
    });

    await recalcWallet(user._id);

    return res.json({
      success: true,
      message: "Referral unlocked",
    });
  } catch (err) {
    console.error("Admin unlock error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/* ---------------------------------------------------
   GET ALL WITHDRAWAL REQUESTS
   Query params:
     - status: pending/completed/failed/all (default: all)
     - limit: number of records (default: 50)
     - page: page number (default: 1)
----------------------------------------------------*/
router.get("/withdrawals", verifyToken, isAdmin, async (req, res) => {
  try {
    const { status = 'all', limit = 50, page = 1 } = req.query;

    // Build query filter
    const filter = { type: 'withdrawal' };
    if (status !== 'all') {
      filter.status = status;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get total count
    const totalCount = await Transaction.countDocuments(filter);

    // Fetch withdrawal transactions with user details
    const withdrawals = await Transaction.find(filter)
      .populate('user', 'name email phoneNumber')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    // Calculate summary statistics
    const summary = {
      total: totalCount,
      pending: await Transaction.countDocuments({ type: 'withdrawal', status: 'pending' }),
      completed: await Transaction.countDocuments({ type: 'withdrawal', status: 'completed' }),
      failed: await Transaction.countDocuments({ type: 'withdrawal', status: 'failed' }),
      cancelled: await Transaction.countDocuments({ type: 'withdrawal', status: 'cancelled' }),

      totalPendingAmount: (await Transaction.aggregate([
        { $match: { type: 'withdrawal', status: 'pending' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]))[0]?.total || 0,

      totalCompletedAmount: (await Transaction.aggregate([
        { $match: { type: 'withdrawal', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]))[0]?.total || 0
    };

    return res.json({
      success: true,
      withdrawals,
      summary,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalRecords: totalCount,
        limit: parseInt(limit)
      }
    });

  } catch (err) {
    console.error("Admin get withdrawals error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/* ---------------------------------------------------
   APPROVE/COMPLETE WITHDRAWAL REQUEST
   Body:
     - transactionId: ID of withdrawal transaction
     - adminNotes: Optional admin notes
----------------------------------------------------*/
router.post("/withdrawals/approve", verifyToken, isAdmin, async (req, res) => {
  try {
    const { transactionId, adminNotes } = req.body;

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID is required"
      });
    }

    // Find the withdrawal transaction
    const tx = await Transaction.findById(transactionId).populate('user', 'name email phoneNumber');

    if (!tx) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found"
      });
    }

    if (tx.type !== 'withdrawal') {
      return res.status(400).json({
        success: false,
        message: "This is not a withdrawal transaction"
      });
    }

    if (tx.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: "Withdrawal already completed"
      });
    }

    if (tx.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: "Cannot approve cancelled withdrawal"
      });
    }

    // Update transaction status to completed
    tx.status = 'completed';
    if (adminNotes) {
      tx.description = `${tx.description} | Admin Notes: ${adminNotes}`;
    }
    tx.paymentDetails.approvedBy = req.user._id;
    tx.paymentDetails.approvedAt = new Date();
    await tx.save();

    // Recalculate user wallet (this will deduct the amount)
    await recalcWallet(tx.user._id);

    return res.json({
      success: true,
      message: "Withdrawal approved and completed successfully",
      transaction: tx
    });

  } catch (err) {
    console.error("Admin approve withdrawal error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/* ---------------------------------------------------
   REJECT/CANCEL WITHDRAWAL REQUEST
   Body:
     - transactionId: ID of withdrawal transaction
     - reason: Reason for rejection
----------------------------------------------------*/
router.post("/withdrawals/reject", verifyToken, isAdmin, async (req, res) => {
  try {
    const { transactionId, reason } = req.body;

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID is required"
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required"
      });
    }

    // Find the withdrawal transaction
    const tx = await Transaction.findById(transactionId).populate('user', 'name email phoneNumber');

    if (!tx) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found"
      });
    }

    if (tx.type !== 'withdrawal') {
      return res.status(400).json({
        success: false,
        message: "This is not a withdrawal transaction"
      });
    }

    if (tx.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: "Cannot reject completed withdrawal"
      });
    }

    if (tx.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: "Withdrawal already cancelled"
      });
    }

    // Update transaction status to cancelled
    tx.status = 'cancelled';
    tx.description = `${tx.description} | Rejected - Reason: ${reason}`;
    tx.paymentDetails.rejectedBy = req.user._id;
    tx.paymentDetails.rejectedAt = new Date();
    tx.paymentDetails.rejectionReason = reason;
    await tx.save();

    // Note: We don't recalculate wallet as the amount was never deducted (transaction was pending)

    return res.json({
      success: true,
      message: "Withdrawal request rejected successfully",
      transaction: tx
    });

  } catch (err) {
    console.error("Admin reject withdrawal error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;
