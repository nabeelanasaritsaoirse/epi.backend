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
  try {
    const { email, phone } = req.query;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: "Email or phone required"
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
          $in: [
            phone,
            `+91${phone}`,
            `91${phone}`
          ]
        }
      };
    }

    const user = await User.findOne({
      $or: [
        email ? { email } : {},
        phone ? phoneQuery : {}
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // RECALCULATE WALLET
    await recalcWallet(String(user._id));

    // GET FRESH USER DATA
    const refreshed = await User.findById(user._id);

    // TRANSACTIONS
    const txns = await Transaction.find({ user: user._id })
      .sort({ createdAt: -1 });

    return res.json({
      success: true,

      user: {
        _id: refreshed._id,
        name: refreshed.name,
        email: refreshed.email,
        phoneNumber: refreshed.phoneNumber
      },

      availableBalance: refreshed.availableBalance ?? refreshed.wallet.balance,
      totalBalance: refreshed.totalBalance ?? 0,

      holdBalance: refreshed.wallet.holdBalance ?? 0,
      referralBonus: refreshed.wallet.referralBonus ?? 0,
      investedAmount: refreshed.wallet.investedAmount ?? 0,
      requiredInvestment: refreshed.wallet.requiredInvestment ?? 0,

      transactions: txns
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
    const { email, phone, amount, description } = req.body;

    if (!email && !phone) {
      return res.json({ success: false, message: "Email or phone required" });
    }

    let phoneQuery = {};
    if (phone) {
      phoneQuery = {
        phoneNumber: {
          $in: [phone, `+91${phone}`, `91${phone}`]
        }
      };
    }

    const user = await User.findOne({
      $or: [
        email ? { email } : {},
        phone ? phoneQuery : {}
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

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
    return res.status(500).json({
      success: false,
      message: "Server error"
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
          $in: [phone, `+91${phone}`, `91${phone}`]
        }
      };
    }

    const user = await User.findOne({
      $or: [
        email ? { email } : {},
        phone ? phoneQuery : {}
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

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
    return res.status(500).json({
      success: false,
      message: "Server error"
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
          $in: [phone, `+91${phone}`, `91${phone}`]
        }
      };
    }

    const user = await User.findOne({
      $or: [
        email ? { email } : {},
        phone ? phoneQuery : {}
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const unlocked = user.wallet.holdBalance;

    if (unlocked <= 0) {
      return res.json({
        success: false,
        message: "No hold balance to unlock"
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
      description: "Admin unlock referral hold"
    });

    await recalcWallet(user._id);

    return res.json({
      success: true,
      message: "Referral unlocked"
    });

  } catch (err) {
    console.error("Admin unlock error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

module.exports = router;
