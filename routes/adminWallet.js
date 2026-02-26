const express = require("express");
const router = express.Router();
const mongoose = require("mongoose"); // ✅ ADDED: Missing import

const User = require("../models/User");
const Transaction = require("../models/Transaction");
const WalletTransaction = require("../models/WalletTransaction"); // ✅ ADDED: Import WalletTransaction model
const recalcWallet = require("../services/walletCalculator");
const { verifyToken, isAdmin } = require("../middlewares/auth");

/* ============================================================
   UNIFIED USER SEARCH HELPER
   Supports: email, phone, name, referralCode, userId
   Returns: User document or null (never throws)
============================================================ */
async function findAdminWalletUser({ email, phone, name, referral, userId }) {
  try {
    const orConditions = [];

    // Email search
    if (email) {
      orConditions.push({ email });
    }

    // Phone search (supports multiple formats automatically)
    if (phone) {
      orConditions.push({
        phoneNumber: { $in: [phone, `+91${phone}`, `91${phone}`] }
      });
    }

    // Name search (case-insensitive contains)
    if (name) {
      orConditions.push({ name: new RegExp(name, "i") });
    }

    // Referral code search
    if (referral) {
      orConditions.push({ referralCode: referral });
    }

    // UserId search
    if (userId && mongoose.isValidObjectId(userId)) {
      orConditions.push({ _id: userId });
    }

    // If no conditions provided, return null
    if (orConditions.length === 0) {
      return null;
    }

    // Find user matching ANY of the above
    const user = await User.findOne({ $or: orConditions });
    return user || null;
  } catch (error) {
    console.error("findAdminWalletUser error:", error);
    return null;
  }
}

/* ---------------------------------------------------
   Fetch Wallet by Email / Phone / Name / Referral / UserId
----------------------------------------------------*/
router.get("/", verifyToken, isAdmin, async (req, res) => {
  console.log("QUERY RECEIVED:", req.query);
  try {
    const { email, phone, name, referral, userId } = req.query;

    // At least one search field must exist
    if (!email && !phone && !name && !referral && !userId) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one: email, phone, name, referral, or userId"
      });
    }

    const user = await findAdminWalletUser({ email, phone, name, referral, userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Recalculate wallet
    await recalcWallet(String(user._id));

    const refreshed = await User.findById(user._id);

    // Query both transaction models (legacy + installment system)
    const legacyTxns = await Transaction.find({ user: user._id })
      .sort({ createdAt: -1 });

    const walletTxns = await WalletTransaction.find({ user: user._id })
      .sort({ createdAt: -1 });

    // Combine and sort by creation date
    const allTransactions = [
      ...legacyTxns.map(t => ({
        _id: t._id,
        type: t.type,
        amount: t.amount,
        status: t.status,
        description: t.description,
        paymentMethod: t.paymentMethod,
        createdAt: t.createdAt,
        source: 'legacy'
      })),
      ...walletTxns.map(t => ({
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

    return res.json({
      success: true,

      user: {
        _id: refreshed._id,
        name: refreshed.name,
        email: refreshed.email,
        phoneNumber: refreshed.phoneNumber,
        referralCode: refreshed.referralCode
      },

      availableBalance: refreshed.availableBalance ?? refreshed.wallet.balance,
      totalBalance: refreshed.totalBalance ?? 0,

      holdBalance: refreshed.wallet.holdBalance ?? 0,
      referralBonus: refreshed.wallet.referralBonus ?? 0,
      investedAmount: refreshed.wallet.investedAmount ?? 0,
      requiredInvestment: refreshed.wallet.requiredInvestment ?? 0,

      transactions: allTransactions
    });

  } catch (err) {
    console.error("Admin wallet GET error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});


/* ---------------------------------------------------
   CREDIT MONEY (Admin Manual Add)
----------------------------------------------------*/
router.post("/credit", verifyToken, isAdmin, async (req, res) => {
  try {
    const { email, phone, name, referral, userId, amount, description } = req.body;

    // At least one search field must exist
    if (!email && !phone && !name && !referral && !userId) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one: email, phone, name, referral, or userId"
      });
    }

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive number"
      });
    }

    // ✅ Use unified search helper
    const user = await findAdminWalletUser({ email, phone, name, referral, userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Create transaction
    await Transaction.create({
      user: user._id,
      type: "bonus",
      amount,
      status: "completed",
      paymentMethod: "system",
      description: description || "Admin credit",
    });

    // Recalculate wallet
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
    const { email, phone, name, referral, userId, amount, description } = req.body;

    // At least one search field must exist
    if (!email && !phone && !name && !referral && !userId) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one: email, phone, name, referral, or userId"
      });
    }

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive number"
      });
    }

    // ✅ Use unified search helper
    const user = await findAdminWalletUser({ email, phone, name, referral, userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Create transaction
    await Transaction.create({
      user: user._id,
      type: "withdrawal",
      amount,
      status: "completed",
      paymentMethod: "system",
      description: description || "Admin debit",
    });

    // Recalculate wallet
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
    const { email, phone, name, referral, userId } = req.body;

    // At least one search field must exist
    if (!email && !phone && !name && !referral && !userId) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one: email, phone, name, referral, or userId"
      });
    }

    // ✅ Use unified search helper
    const user = await findAdminWalletUser({ email, phone, name, referral, userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const unlocked = user.wallet.holdBalance;

    if (unlocked <= 0) {
      return res.status(400).json({
        success: false,
        message: "No hold balance to unlock"
      });
    }

    // Update wallet
    user.wallet.balance += unlocked;
    user.wallet.holdBalance = 0;
    await user.save();

    // Create transaction
    await Transaction.create({
      user: user._id,
      type: "bonus",
      amount: unlocked,
      status: "completed",
      paymentMethod: "system",
      description: "Admin unlock referral hold",
    });

    // Recalculate wallet
    await recalcWallet(user._id);

    return res.json({
      success: true,
      message: "Referral unlocked"
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
/* ---------------------------------------------------
   GET ALL WITHDRAWAL REQUESTS
   Query params:
     - status: pending/completed/failed/all (default: all)
     - limit: number of records (default: 50)
     - page: page number (default: 1)
     - search: name/email/phone search
     - fromDate: ISO date
     - toDate: ISO date
----------------------------------------------------*/
router.get("/withdrawals", verifyToken, isAdmin, async (req, res) => {
  try {
    const {
      status = "all",
      limit = 50,
      page = 1,
      search,
      fromDate,
      toDate
    } = req.query;

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);
    const skip = (parsedPage - 1) * parsedLimit;

    // =========================
    // BASE FILTER
    // =========================
    const filter = { type: "withdrawal" };

    if (status !== "all") {
      filter.status = status;
    }

    if (fromDate && toDate) {
      filter.createdAt = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate)
      };
    }

    // =========================
    // SEARCH MATCH (for aggregation)
    // =========================
    const searchMatch = search
      ? {
          $or: [
            { "userDetails.name": { $regex: search, $options: "i" } },
            { "userDetails.email": { $regex: search, $options: "i" } },
            { "userDetails.phoneNumber": { $regex: search, $options: "i" } }
          ]
        }
      : null;

    // =========================
    // MAIN AGGREGATION (DATA)
    // =========================
    const aggregation = [
      { $match: filter },

      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userDetails"
        }
      },
      {
        $unwind: {
          path: "$userDetails",
          preserveNullAndEmptyArrays: true
        }
      },

      ...(searchMatch ? [{ $match: searchMatch }] : []),

      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: parsedLimit }
    ];

    const rawWithdrawals = await Transaction.aggregate(aggregation);

    // =========================
    // COUNT (IMPORTANT — must respect search)
    // =========================
    let totalCount;

    if (searchMatch) {
      const countAggregation = [
        { $match: filter },
        {
          $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            as: "userDetails"
          }
        },
        {
          $unwind: {
            path: "$userDetails",
            preserveNullAndEmptyArrays: true
          }
        },
        { $match: searchMatch },
        { $count: "total" }
      ];

      const countResult = await Transaction.aggregate(countAggregation);
      totalCount = countResult[0]?.total || 0;
    } else {
      totalCount = await Transaction.countDocuments(filter);
    }

    // =========================
    // NORMALIZE USER FIELD
    // =========================
    const withdrawals = rawWithdrawals.map((w) => ({
      ...w,
      user: w.userDetails || null
    }));

    // =========================
    // SUMMARY (kept as-is)
    // =========================
    const summary = {
      total: totalCount,
      pending: await Transaction.countDocuments({
        type: "withdrawal",
        status: "pending"
      }),
      completed: await Transaction.countDocuments({
        type: "withdrawal",
        status: "completed"
      }),
      failed: await Transaction.countDocuments({
        type: "withdrawal",
        status: "failed"
      }),
      cancelled: await Transaction.countDocuments({
        type: "withdrawal",
        status: "cancelled"
      }),

      totalPendingAmount:
        (
          await Transaction.aggregate([
            { $match: { type: "withdrawal", status: "pending" } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
          ])
        )[0]?.total || 0,

      totalCompletedAmount:
        (
          await Transaction.aggregate([
            { $match: { type: "withdrawal", status: "completed" } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
          ])
        )[0]?.total || 0
    };

    return res.json({
      success: true,
      withdrawals,
      summary,
      pagination: {
        currentPage: parsedPage,
        totalPages: Math.ceil(totalCount / parsedLimit),
        totalRecords: totalCount,
        limit: parsedLimit
      }
    });

  } catch (err) {
    console.error("Admin get withdrawals error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error"
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
