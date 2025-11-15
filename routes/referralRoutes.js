const express = require("express");
const router = express.Router();
const referralController = require("../controllers/referralController");
const auth = require("../middlewares/auth");
const User = require("../models/User");
const CommissionWithdrawal = require("../models/CommissionWithdrawal");
const Referral = require("../models/Referral");
const DailyCommission = require("../models/DailyCommission");

/* ============================================================
   SAFE PRODUCTION ROUTES ONLY
   (All test/debug routes removed)
============================================================ */

/* ---------- Generate referral code ---------- */
router.post("/generate-code", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId)
      return res.status(400).json({ success: false, error: "User ID is required" });

    const user = await referralController.generateReferralCode(userId);

    if (!user)
      return res.status(404).json({ success: false, error: "User not found" });

    const isExisting = user.createdAt.getTime() !== user.updatedAt.getTime();

    res.json({
      success: true,
      referralCode: user.referralCode,
      isExistingCode: isExisting,
      message: isExisting ? "Retrieved existing referral code" : "Generated new referral code",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ---------- Process Referral ---------- */
router.post("/process", auth.verifyToken, async (req, res) => {
  try {
    const { referredUserId, dailyAmount } = req.body;
    if (!referredUserId || !dailyAmount)
      return res.status(400).json({
        success: false,
        error: "referredUserId and dailyAmount are required",
      });

    const referral = await referralController.processReferral(
      req.user._id,
      referredUserId,
      dailyAmount
    );

    res.json({ success: true, referral });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ---------- Activate commission on purchase ---------- */
router.post("/activate-commission", async (req, res) => {
  try {
    const {
      userId,
      installmentOption = "default",
      dailyAmount = 100,
      days = 30,
      totalAmount = 3399,
    } = req.body;

    if (!userId)
      return res.status(400).json({ success: false, error: "userId is required" });

    const purchasingUser = await User.findById(userId);
    if (!purchasingUser)
      return res.status(404).json({ success: false, error: "User not found" });

    if (!purchasingUser.referredBy)
      return res.status(400).json({
        success: false,
        error: "User was not referred by anyone",
      });

    let installmentDetails;
    switch (installmentOption) {
      case "option1":
        installmentDetails = {
          dailyAmount: 100,
          days: 34,
          totalAmount: 3399,
          commissionPercentage: 30,
          name: "Basic Plan",
        };
        break;

      case "option2":
        installmentDetails = {
          dailyAmount: 200,
          days: 17,
          totalAmount: 3399,
          commissionPercentage: 30,
          name: "Recommended Plan",
        };
        break;

      case "option3":
        installmentDetails = {
          dailyAmount: 300,
          days: 12,
          totalAmount: 3399,
          commissionPercentage: 30,
          name: "Premium Plan",
        };
        break;

      default:
        installmentDetails = {
          dailyAmount,
          days,
          totalAmount,
          commissionPercentage: 30,
          name: "Custom Plan",
        };
    }

    const referral = await referralController.processReferral(
      purchasingUser.referredBy,
      userId,
      installmentDetails
    );

    res.json({
      success: true,
      message: "Referral commission activated successfully",
      referral,
      installmentDetails,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ---------- Withdraw earnings ---------- */
router.post("/withdraw", async (req, res) => {
  try {
    const { amount, paymentMethod, paymentDetails, userId } = req.body;

    if (!amount || !paymentMethod || !paymentDetails)
      return res.status(400).json({
        success: false,
        error: "amount, paymentMethod & paymentDetails are required",
      });

    const withdrawal = await referralController.requestWithdrawal(
      userId,
      amount,
      paymentMethod,
      paymentDetails
    );

    res.json(withdrawal);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ---------- Referral dashboard ---------- */
router.get("/dashboard", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId)
      return res.status(400).json({ success: false, error: "userId is required" });

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, error: "User not found" });

    const stats = await referralController.getReferralStats(userId);
    const referredUsers = await User.find({ referredBy: userId }).select("name profilePicture _id");

    const referralsWithProgress = await Promise.all(
      referredUsers.map(async (ru) => {
        const referral = await Referral.findOne({
          referrer: userId,
          referredUser: ru._id,
        });

        let prog = "0/0";
        let status = "PENDING";
        let installmentPlan = null;

        if (referral) {
          const totalDays = referral.days || 30;
          const commissions = await DailyCommission.find({ referral: referral._id });
          const daysPaid = commissions.length;

          prog = `${daysPaid}/${totalDays}`;
          status = referral.status;

          const dailyCommissionAmount =
            (referral.dailyAmount * referral.commissionPercentage) / 100;

          installmentPlan = {
            dailyAmount: referral.dailyAmount,
            days: totalDays,
            commissionPerDay: dailyCommissionAmount,
            commissionEarned: referral.commissionEarned || 0,
          };
        }

        return {
          _id: ru._id,
          name: ru.name,
          profilePicture: ru.profilePicture,
          progress: prog,
          referralStatus: status,
          installmentPlan,
        };
      })
    );

    const recentTransactions = await DailyCommission.find({ referrer: userId })
      .sort({ date: -1 })
      .limit(10);

    res.json({
      success: true,
      dashboardData: {
        user: { name: user.name, referralCode: user.referralCode },
        stats,
        referrals: referralsWithProgress,
        recentTransactions: recentTransactions.map((tx) => ({
          amount: tx.amount,
          date: tx.date,
          status: tx.status,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ---------- Referral list (Screen 1) ---------- */
router.get("/list/:referrerId", async (req, res) => {
  try {
    const result = await referralController.getReferralList(req.params.referrerId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ---------- Referred user details (Screen 2) ---------- */
router.get("/friend/:referredUserId", async (req, res) => {
  try {
    const result = await referralController.getReferredUserDetails(
      req.params.referredUserId
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ---------- Product details (Screen 3) ---------- */
router.get("/product/:referredUserId/:productId", async (req, res) => {
  try {
    const result = await referralController.getReferralProductDetails(
      req.params.referredUserId,
      req.params.productId
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ---------- Wallet ---------- */
router.get("/wallet/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select(
      "wallet totalEarnings availableBalance"
    );

    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    const stats = await referralController.getReferralStats(req.params.userId);

    const sortedTx = (user.wallet.transactions || []).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json({
      success: true,
      wallet: {
        balance: user.wallet.balance || 0,
        totalEarnings: stats.totalEarnings,
        totalWithdrawn: stats.totalWithdrawn,
        transactions: sortedTx,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ---------- Share Referral Code ---------- */
router.post("/share", async (req, res) => {
  try {
    const { userId, shareMethod } = req.body;

    const user = await User.findById(userId);
    if (!user?.referralCode)
      return res.status(404).json({ success: false, error: "Referral code not found" });

    const baseUrl = process.env.APP_URL || "https://yourapp.com";
    const shareUrl = `${baseUrl}/signup?referral=${user.referralCode}`;

    let message = `Use my referral code ${user.referralCode} - ${shareUrl}`;
    if (shareMethod === "whatsapp")
      message = `Join the app! Referral code: ${user.referralCode} Link: ${shareUrl}`;

    res.json({
      success: true,
      sharingData: { referralCode: user.referralCode, shareUrl, message },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ---------- Referral Details ---------- */
router.get("/details/:referralId", async (req, res) => {
  try {
    const referral = await Referral.findById(req.params.referralId)
      .populate("referrer", "name email")
      .populate("referredUser", "name email");

    if (!referral)
      return res.status(404).json({ success: false, error: "Referral not found" });

    const commissions = await DailyCommission.find({
      referral: req.params.referralId,
    });

    const accurateDaysPaid = commissions.length;
    const totalDays = referral.days || 30;

    const progressPercent = Math.round((accurateDaysPaid / totalDays) * 100);

    res.json({
      success: true,
      referral: {
        ...referral._doc,
        progress: {
          daysPaid: accurateDaysPaid,
          progressPercent,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
