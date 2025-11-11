const express = require("express");
const router = express.Router();
const referralController = require("../controllers/referralController");
const auth = require("../middlewares/auth");
const User = require("../models/User");
const CommissionWithdrawal = require("../models/CommissionWithdrawal");
const Referral = require("../models/Referral");
const DailyCommission = require("../models/DailyCommission");

// Test route to check if User model is functioning
router.get("/test-user-model", async (req, res) => {
  try {
    // Just count users to verify the model works
    const count = await User.countDocuments();
    res.json({
      success: true,
      message: "User model is functioning correctly",
      userCount: count,
    });
  } catch (error) {
    console.error("Error testing User model:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error testing User model",
      stack: error.stack,
    });
  }
});

// Generate referral code for new user
router.post("/generate-code", async (req, res) => {
  try {
    if (!req.body.userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required",
      });
    }

    console.log(
      "Retrieving or generating referral code for user:",
      req.body.userId
    );
    const user = await referralController.generateReferralCode(req.body.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Check if this is a pre-existing code or new one
    const isExisting = user.createdAt.getTime() !== user.updatedAt.getTime();

    res.json({
      success: true,
      referralCode: user.referralCode,
      isExistingCode: isExisting,
      message: isExisting
        ? "Retrieved existing referral code"
        : "Generated new referral code",
    });
  } catch (error) {
    console.error("Error in generate-code route:", error);
    res.status(500).json({
      success: false,
      error:
        error.message || "An error occurred while generating referral code",
    });
  }
});

// Process new referral
router.post("/process", auth.verifyToken, async (req, res) => {
  try {
    const { referredUserId, dailyAmount } = req.body;

    if (!referredUserId || !dailyAmount) {
      return res.status(400).json({
        success: false,
        error: "referredUserId and dailyAmount are required",
      });
    }

    const referral = await referralController.processReferral(
      req.user._id,
      referredUserId,
      dailyAmount
    );

    res.json({ success: true, referral });
  } catch (error) {
    console.error("Error in process route:", error);
    res.status(500).json({
      success: false,
      error: error.message || "An error occurred while processing referral",
    });
  }
});

// Request commission withdrawal
router.post("/withdraw", async (req, res) => {
  try {
    const { amount, paymentMethod, paymentDetails, userId } = req.body;

    if (!amount || !paymentMethod || !paymentDetails) {
      return res.status(400).json({
        success: false,
        error: "amount, paymentMethod, and paymentDetails are required",
      });
    }

    const withdrawal = await referralController.requestWithdrawal(
      userId,
      amount,
      paymentMethod,
      paymentDetails
    );

    res.json(withdrawal);
  } catch (error) {
    console.error("Error in withdraw route:", error);
    res.status(500).json({
      success: false,
      error:
        error.message ||
        "An error occurred while processing withdrawal request",
    });
  }
});

// Get referral statistics
router.get("/stats", async (req, res) => {
  try {
    const stats = await referralController.getReferralStats(req.body.userId);
    res.json({ success: true, stats });
  } catch (error) {
    console.error("Error in stats route:", error);
    res.status(500).json({
      success: false,
      error:
        error.message || "An error occurred while fetching referral statistics",
    });
  }
});

// Activate referral commission when a referred user makes a purchase
router.post("/activate-commission", async (req, res) => {
  try {
    const {
      userId,
      installmentOption = "default",
      dailyAmount = 100,
      days = 30,
      totalAmount = 3399,
    } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required",
      });
    }

    // Find the user who made the purchase
    const purchasingUser = await User.findById(userId);

    if (!purchasingUser) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Check if this user was referred by someone
    if (!purchasingUser.referredBy) {
      return res.status(400).json({
        success: false,
        error: "User was not referred by anyone",
      });
    }

    // Create installment details based on the selected option
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
      case "option2": // Recommended
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
        // Custom option
        installmentDetails = {
          dailyAmount,
          days,
          totalAmount,
          commissionPercentage: 30,
          name: "Custom Plan",
        };
    }

    // Process the referral commission
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
    console.error("Error in activate-commission route:", error);
    res.status(500).json({
      success: false,
      error:
        error.message ||
        "An error occurred while activating referral commission",
    });
  }
});

// Debug endpoint - Get user's referral details
router.get("/referral-details/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required",
      });
    }

    // Find the user
    const user = await User.findById(userId)
      .populate("referredBy", "name email referralCode")
      .populate("referredUsers", "name email");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Check if this user has been referred
    const hasBeenReferred = user.referredBy ? true : false;

    // Check how many users this user has referred
    const referredCount = user.referredUsers ? user.referredUsers.length : 0;

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        referralCode: user.referralCode,
      },
      referralDetails: {
        hasBeenReferred,
        referredBy: user.referredBy,
        referredCount,
        referredUsers: user.referredUsers,
      },
    });
  } catch (error) {
    console.error("Error getting user referral details:", error);
    res.status(500).json({
      success: false,
      error:
        error.message || "An error occurred while fetching referral details",
    });
  }
});

// For testing - process daily commission
router.post("/process-daily-commissions", async (req, res) => {
  try {
    await referralController.processDailyCommission();
    res.json({ success: true, message: "Daily commissions processed" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update withdrawal status (for admin/testing)
router.post("/update-withdrawal-status", async (req, res) => {
  try {
    const { withdrawalId, status } = req.body;

    if (!withdrawalId || !status) {
      return res.status(400).json({
        success: false,
        error: "withdrawalId and status are required",
      });
    }

    const withdrawal = await referralController.updateWithdrawalStatus(
      withdrawalId,
      status
    );

    res.json({
      success: true,
      message: `Withdrawal status updated to ${status}`,
      withdrawal,
    });
  } catch (error) {
    console.error("Error updating withdrawal status:", error);
    res.status(500).json({
      success: false,
      error:
        error.message || "An error occurred while updating withdrawal status",
    });
  }
});

// Get user's withdrawals
router.get("/withdrawals", async (req, res) => {
  try {
    const { userId, limit = 10, page = 1, status } = req.query;

    // Build query
    const query = {};
    if (userId) {
      query.user = userId;
    }
    if (status) {
      query.status = status;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get withdrawals with pagination and populate user details
    const withdrawals = await CommissionWithdrawal.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("user", "name email phoneNumber profilePicture");

    // Get total count
    const total = await CommissionWithdrawal.countDocuments(query);

    res.json({
      success: true,
      withdrawals,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching withdrawals:", error);
    res.status(500).json({
      success: false,
      error: error.message || "An error occurred while fetching withdrawals",
    });
  }
});

// Get complete referral dashboard data
router.get("/dashboard", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required",
      });
    }

    // Get the user with their referral code
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Get total earned amount (from completed and pending daily commissions)
    const stats = await referralController.getReferralStats(userId);

    // Get all referred users with their progress
    const referredUsers = await User.find({ referredBy: userId }).select(
      "name profilePicture _id"
    );

    // Get detailed info for each referred user
    const referralsWithProgress = await Promise.all(
      referredUsers.map(async (referredUser) => {
        // Get active referral for this user
        const referral = await Referral.findOne({
          referrer: userId,
          referredUser: referredUser._id,
        });

        // Calculate progress
        let progressText = "0/0";
        let installmentPlan = null;
        let referralStatus = "PENDING";
        let statusMessage = "Waiting for first purchase";
        let progressPercent = 0;

        if (referral) {
          referralStatus = referral.status;

          // Get accurate daysPaid by counting commissions instead of relying on stored value
          const commissions = await DailyCommission.find({
            referral: referral._id,
          });
          const accurateDaysPaid = commissions.length;
          const totalDays = referral.days || 30;

          // Auto-fix: If daysPaid in database doesn't match commission count, update it silently
          if (referral.daysPaid !== accurateDaysPaid) {
            await Referral.findByIdAndUpdate(
              referral._id,
              { daysPaid: accurateDaysPaid },
              { new: false }
            );

            // Check if this completes the referral
            if (
              accurateDaysPaid >= totalDays &&
              referral.status !== "COMPLETED"
            ) {
              await Referral.findByIdAndUpdate(referral._id, {
                status: "COMPLETED",
                endDate: new Date(),
              });
              referralStatus = "COMPLETED";
            }
          }

          progressText = `${accurateDaysPaid}/${totalDays}`;
          progressPercent = Math.min(
            Math.round((accurateDaysPaid / totalDays) * 100),
            100
          );

          // Calculate days remaining based on accurate daysPaid
          const daysRemaining = Math.max(0, totalDays - accurateDaysPaid);

          if (referralStatus === "ACTIVE") {
            statusMessage = "Commission active";
          } else if (referralStatus === "COMPLETED") {
            statusMessage = "Commission period completed";
          } else if (referralStatus === "CANCELLED") {
            statusMessage = "Commission cancelled";
          }

          // Calculate daily commission amount correctly
          const dailyCommissionAmount =
            (referral.dailyAmount * referral.commissionPercentage) / 100;

          installmentPlan = {
            dailyAmount: referral.dailyAmount,
            days: totalDays,
            totalAmount: referral.totalAmount,
            commissionPerDay: dailyCommissionAmount,
            totalCommissionExpected: dailyCommissionAmount * totalDays,
            commissionEarned: referral.commissionEarned || 0,
            daysPaid: accurateDaysPaid, // Use accurate value
            daysRemaining: daysRemaining,
            planName: referral.installmentDetails?.name || "Default Plan",
          };
        }

        // Get count of users referred by this referredUser
        const subReferralsCount = await User.countDocuments({
          referredBy: referredUser._id,
        });

        return {
          _id: referredUser._id,
          name: referredUser.name,
          profilePicture: referredUser.profilePicture,
          progress: progressText,
          progressPercent: progressPercent,
          referralStatus,
          statusMessage,
          hasPurchased: !!referral,
          installmentPlan,
          myReferrals: subReferralsCount,
          referralInfo: {
            totalReferrals: subReferralsCount,
            referralLevel: 2, // This is level 2 (referral of a referral)
          },
          startDate: referral ? referral.startDate : null,
          endDate: referral ? referral.endDate : null,
        };
      })
    );

    // Get recent transactions (commissions received)
    const recentTransactions = await DailyCommission.find({ referrer: userId })
      .sort({ date: -1 })
      .limit(10)
      .populate("referral");

    const totalReferredCount = await User.countDocuments({
      referredBy: { $exists: true, $ne: null },
    });

    res.json({
      success: true,
      dashboardData: {
        user: {
          name: user.name,
          referralCode: user.referralCode,
        },
        stats: {
          walletBalance: user.wallet?.balance || 0,
          totalEarnings: stats.totalEarnings,
          totalWithdrawn: stats.totalWithdrawn,
          activeReferrals: stats.activeReferrals,
          totalReferrals: stats.totalReferrals,
        },
        referrals: referralsWithProgress,
        platformStats: {
          totalPeopleReferred: totalReferredCount,
        },
        recentTransactions: recentTransactions.map((tx) => ({
          _id: tx._id,
          amount: tx.amount,
          date: tx.date,
          referredUser: tx.referral ? tx.referral.referredUser : null,
          status: tx.status,
        })),
      },
    });
  } catch (error) {
    console.error("Error getting dashboard data:", error);
    res.status(500).json({
      success: false,
      error: error.message || "An error occurred while fetching dashboard data",
    });
  }
});

// Get referral transactions
router.get("/transactions", async (req, res) => {
  try {
    const { userId, limit = 20, page = 1 } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required",
      });
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get all commission transactions
    const commissions = await DailyCommission.find({ referrer: userId })
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate({
        path: "referral",
        populate: {
          path: "referredUser",
          select: "name profilePicture",
        },
      });

    // Get withdraw transactions
    const withdrawals = await CommissionWithdrawal.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Combine and sort both types of transactions
    const allTransactions = [
      ...commissions.map((tx) => ({
        _id: tx._id,
        type: "COMMISSION",
        amount: tx.amount,
        date: tx.date,
        status: tx.status,
        fromUser: tx.referral?.referredUser
          ? {
              name: tx.referral.referredUser.name,
              profilePicture: tx.referral.referredUser.profilePicture,
              _id: tx.referral.referredUser._id,
            }
          : null,
      })),
      ...withdrawals.map((tx) => ({
        _id: tx._id,
        type: "WITHDRAWAL",
        amount: tx.amount,
        date: tx.createdAt,
        status: tx.status,
        paymentMethod: tx.paymentMethod,
        transactionId: tx.transactionId,
        fromUser: {},
      })),
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, parseInt(limit));

    // Get total count
    const totalCommissions = await DailyCommission.countDocuments({
      referrer: userId,
    });
    const totalWithdrawals = await CommissionWithdrawal.countDocuments({
      user: userId,
    });

    res.json({
      success: true,
      transactions: allTransactions,
      pagination: {
        total: totalCommissions + totalWithdrawals,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(
          (totalCommissions + totalWithdrawals) / parseInt(limit)
        ),
      },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({
      success: false,
      error: error.message || "An error occurred while fetching transactions",
    });
  }
});

// Share referral code (generate sharing URL or message)
router.post("/share", async (req, res) => {
  try {
    const { userId, shareMethod } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required",
      });
    }

    // Get user with referral code
    const user = await User.findById(userId);
    if (!user || !user.referralCode) {
      return res.status(404).json({
        success: false,
        error: "User or referral code not found",
      });
    }

    // Create sharing message based on method
    let sharingContent = "";
    const baseUrl = process.env.APP_URL || "https://yourapp.com";
    const shareUrl = `${baseUrl}/signup?referral=${user.referralCode}`;

    switch (shareMethod) {
      case "whatsapp":
        sharingContent = `Hey! Join me on this app and earn rewards. Use my referral code: ${user.referralCode} or sign up using this link: ${shareUrl}`;
        break;
      case "sms":
        sharingContent = `Join me on this app and earn rewards. My referral code: ${user.referralCode}`;
        break;
      case "email":
        sharingContent = `<p>Hello,</p><p>I'm inviting you to join this awesome app. You'll get rewards when you sign up using my referral code: <strong>${user.referralCode}</strong></p><p>Click this link to get started: <a href="${shareUrl}">${shareUrl}</a></p>`;
        break;
      default:
        sharingContent = `Join me using my referral code: ${user.referralCode} - ${shareUrl}`;
    }

    res.json({
      success: true,
      sharingData: {
        referralCode: user.referralCode,
        message: sharingContent,
        shareUrl,
        shareMethod,
      },
    });
  } catch (error) {
    console.error("Error generating sharing content:", error);
    res.status(500).json({
      success: false,
      error:
        error.message || "An error occurred while generating sharing content",
    });
  }
});

// Get details of a specific referral
router.get("/details/:referralId", async (req, res) => {
  try {
    const { referralId } = req.params;

    if (!referralId) {
      return res.status(400).json({
        success: false,
        error: "referralId is required",
      });
    }

    // Find the referral
    const referral = await Referral.findById(referralId)
      .populate("referrer", "name email referralCode")
      .populate("referredUser", "name email profilePicture");

    if (!referral) {
      return res.status(404).json({
        success: false,
        error: "Referral not found",
      });
    }

    // Calculate accurate progress
    const now = new Date();
    const startDate = new Date(referral.startDate);
    const daysPassed = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));

    // Get all commissions for this referral
    const commissions = await DailyCommission.find({
      referral: referralId,
    }).sort({ date: -1 });

    // Get the actual days paid by counting commissions
    const accurateDaysPaid = commissions.length;
    const totalDays = referral.days || 30;

    // Auto-fix: If stored daysPaid doesn't match commission count, update it silently
    let referralStatus = referral.status;
    if (referral.daysPaid !== accurateDaysPaid) {
      await Referral.findByIdAndUpdate(
        referralId,
        { daysPaid: accurateDaysPaid },
        { new: false }
      );

      // Check if this completes the referral
      if (accurateDaysPaid >= totalDays && referral.status !== "COMPLETED") {
        await Referral.findByIdAndUpdate(referralId, {
          status: "COMPLETED",
          endDate: new Date(),
        });
        referralStatus = "COMPLETED";
      }
    }

    // Calculate days remaining based on accurate daysPaid
    const daysRemaining = Math.max(0, totalDays - accurateDaysPaid);

    // Calculate commission values
    const dailyCommissionAmount =
      (referral.dailyAmount * referral.commissionPercentage) / 100;
    const totalExpectedCommission = dailyCommissionAmount * totalDays;

    // Calculate progress percentage
    const progressPercent = Math.min(
      Math.round((accurateDaysPaid / totalDays) * 100),
      100
    );

    res.json({
      success: true,
      referral: {
        _id: referral._id,
        referrer: referral.referrer,
        referredUser: referral.referredUser,
        status: referralStatus,
        startDate: referral.startDate,
        endDate: referral.endDate,
        dailyAmount: referral.dailyAmount,
        days: totalDays,
        totalAmount: referral.totalAmount,
        commissionPercentage: referral.commissionPercentage,
        totalCommission: referral.totalCommission,
        installmentDetails: referral.installmentDetails,
        createdAt: referral.createdAt,
        progress: {
          daysPassed,
          daysPaid: accurateDaysPaid,
          daysRemaining,
          progressPercent,
          commissionEarned: referral.commissionEarned || 0,
          commissionExpected: totalExpectedCommission,
          dailyCommission: dailyCommissionAmount,
        },
        transactions: commissions.map((commission) => ({
          _id: commission._id,
          amount: commission.amount,
          date: commission.date,
          status: commission.status,
        })),
      },
    });
  } catch (error) {
    console.error("Error getting referral details:", error);
    res.status(500).json({
      success: false,
      error:
        error.message || "An error occurred while fetching referral details",
    });
  }
});

// Check and activate pending referrals (useful for testing)
router.post("/check-and-activate", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required",
      });
    }

    // Find all users who were referred by this user
    const referredUsers = await User.find({ referredBy: userId });

    if (referredUsers.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No referred users found",
      });
    }

    const results = [];

    // For each referred user, check if they have an active referral
    for (const referredUser of referredUsers) {
      // Check if referral exists
      const existingReferral = await Referral.findOne({
        referrer: userId,
        referredUser: referredUser._id,
      });

      if (existingReferral) {
        results.push({
          referredUserId: referredUser._id,
          name: referredUser.name,
          status: "ALREADY_ACTIVE",
          referralId: existingReferral._id,
          message: `Referral already exists with status: ${existingReferral.status}`,
        });
        continue;
      }

      // No active referral, create one with default installment plan
      const installmentDetails = {
        dailyAmount: 100,
        days: 30,
        totalAmount: 3000,
        commissionPercentage: 30,
        name: "Default Plan",
      };

      // Process the referral
      try {
        const referral = await referralController.processReferral(
          userId,
          referredUser._id,
          installmentDetails
        );

        results.push({
          referredUserId: referredUser._id,
          name: referredUser.name,
          status: "ACTIVATED",
          referralId: referral._id,
          message: "Referral activated successfully",
        });
      } catch (error) {
        results.push({
          referredUserId: referredUser._id,
          name: referredUser.name,
          status: "ERROR",
          message: `Error activating referral: ${error.message}`,
        });
      }
    }

    res.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Error checking and activating referrals:", error);
    res.status(500).json({
      success: false,
      error: error.message || "An error occurred while activating referrals",
    });
  }
});

// Get missed payment details for a referral
router.get("/missed-payments/:referralId", async (req, res) => {
  try {
    const { referralId } = req.params;

    if (!referralId) {
      return res.status(400).json({
        success: false,
        error: "referralId is required",
      });
    }

    const missedPaymentDetails = await referralController.getMissedPaymentDays(
      referralId
    );

    res.json({
      success: true,
      missedPaymentDetails,
    });
  } catch (error) {
    console.error("Error getting missed payment details:", error);
    res.status(500).json({
      success: false,
      error:
        error.message ||
        "An error occurred while fetching missed payment details",
    });
  }
});

// Fix referral daysPaid values
router.post("/fix-days-paid/:referralId", async (req, res) => {
  try {
    const { referralId } = req.params;

    if (!referralId) {
      return res.status(400).json({
        success: false,
        error: "referralId is required",
      });
    }

    // Find the referral
    const referral = await Referral.findById(referralId);

    if (!referral) {
      return res.status(404).json({
        success: false,
        error: "Referral not found",
      });
    }

    // Get all commissions for this referral
    const commissions = await DailyCommission.find({ referral: referralId });

    // Count the number of commissions - this should match daysPaid
    const commissionCount = commissions.length;

    // Update the referral with the correct daysPaid value
    const updatedReferral = await Referral.findByIdAndUpdate(
      referralId,
      { daysPaid: commissionCount },
      { new: true }
    );

    // Check if this completes the referral
    if (commissionCount >= updatedReferral.days) {
      await Referral.findByIdAndUpdate(referralId, {
        status: "COMPLETED",
        endDate: new Date(),
      });
    }

    res.json({
      success: true,
      message: `Referral daysPaid fixed: ${commissionCount}/${updatedReferral.days}`,
      referral: {
        _id: updatedReferral._id,
        daysPaid: commissionCount,
        days: updatedReferral.days,
        progress: Math.min(
          Math.round((commissionCount / updatedReferral.days) * 100),
          100
        ),
        status:
          commissionCount >= updatedReferral.days
            ? "COMPLETED"
            : updatedReferral.status,
      },
    });
  } catch (error) {
    console.error("Error fixing referral daysPaid:", error);
    res.status(500).json({
      success: false,
      error:
        error.message || "An error occurred while fixing referral daysPaid",
    });
  }
});

// Fix all referrals for a user
router.post("/fix-all-referrals", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required",
      });
    }

    // Find all referrals where this user is the referrer
    const referrals = await Referral.find({ referrer: userId });

    if (referrals.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No referrals found for this user",
      });
    }

    const results = [];

    // Update each referral
    for (const referral of referrals) {
      // Get commissions for this referral
      const commissions = await DailyCommission.find({
        referral: referral._id,
      });
      const commissionCount = commissions.length;

      // Update the referral with the correct daysPaid value
      const updatedReferral = await Referral.findByIdAndUpdate(
        referral._id,
        { daysPaid: commissionCount },
        { new: true }
      );

      // Check if this completes the referral
      if (commissionCount >= updatedReferral.days) {
        await Referral.findByIdAndUpdate(referral._id, {
          status: "COMPLETED",
          endDate: new Date(),
        });
      }

      results.push({
        referralId: updatedReferral._id,
        referredUser: updatedReferral.referredUser,
        oldDaysPaid: referral.daysPaid,
        newDaysPaid: commissionCount,
        totalDays: updatedReferral.days,
        progress: Math.min(
          Math.round((commissionCount / updatedReferral.days) * 100),
          100
        ),
        status:
          commissionCount >= updatedReferral.days
            ? "COMPLETED"
            : updatedReferral.status,
      });
    }

    res.json({
      success: true,
      message: `Fixed ${results.length} referrals`,
      results,
    });
  } catch (error) {
    console.error("Error fixing all referrals:", error);
    res.status(500).json({
      success: false,
      error: error.message || "An error occurred while fixing referrals",
    });
  }
});

// Get user wallet balance and transactions
router.get("/wallet/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required",
      });
    }

    // Get the user with their wallet information
    const user = await User.findById(userId).select(
      "name wallet totalEarnings availableBalance"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Get wallet statistics
    const stats = await referralController.getReferralStats(userId);

    // Sort transactions by date (most recent first)
    const walletTransactions = user.wallet.transactions || [];
    walletTransactions.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json({
      success: true,
      wallet: {
        balance: user.wallet.balance || 0,
        totalEarnings: stats.totalEarnings,
        totalWithdrawn: stats.totalWithdrawn,
        transactions: walletTransactions.map((tx) => ({
          type: tx.type,
          amount: tx.amount,
          description: tx.description,
          date: tx.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("Error getting wallet balance:", error);
    res.status(500).json({
      success: false,
      error: error.message || "An error occurred while fetching wallet data",
    });
  }
});
// Get all referrals for main referral page (Screen 1)
router.get("/list/:referrerId", async (req, res) => {
  try {
    const { referrerId } = req.params;
    if (!referrerId) {
      return res.status(400).json({
        success: false,
        error: "referrerId is required",
      });
    }

    const result = await referralController.getReferralList(referrerId);
    res.json(result);
  } catch (error) {
    console.error("Error fetching referral list:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch referral list",
    });
  }
});

// Get specific referred user details (Screen 2)
router.get("/friend/:referredUserId", async (req, res) => {
  try {
    const { referredUserId } = req.params;
    if (!referredUserId) {
      return res.status(400).json({
        success: false,
        error: "referredUserId is required",
      });
    }

    const result = await referralController.getReferredUserDetails(referredUserId);
    res.json(result);
  } catch (error) {
    console.error("Error fetching referred user details:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch referred user details",
    });
  }
});

// Get detailed product info for a referred user (Screen 3)
router.get("/product/:referredUserId/:productId", async (req, res) => {
  try {
    const { referredUserId, productId } = req.params;

    if (!referredUserId || !productId) {
      return res.status(400).json({
        success: false,
        error: "referredUserId and productId are required",
      });
    }

    const result = await referralController.getReferralProductDetails(
      referredUserId,
      productId
    );
    res.json(result);
  } catch (error) {
    console.error("Error fetching referral product details:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch product-level referral details",
    });
  }
});

module.exports = router;
