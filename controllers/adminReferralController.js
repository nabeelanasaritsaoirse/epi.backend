// controllers/adminReferralController.js
const User = require("../models/User");
const Referral = require("../models/Referral");
const DailyCommission = require("../models/DailyCommission");
const CommissionWithdrawal = require("../models/CommissionWithdrawal");

/**
 * @desc    Get user by phone number or email
 * @route   GET /api/admin/referrals/user
 * @access  Admin
 */
exports.getUserReferralDetails = async (req, res) => {
  try {
    const { phone, email } = req.query;

    if (!phone && !email) {
      return res.status(400).json({
        success: false,
        error: "Please provide either phone number or email",
      });
    }

    // Find user by phone or email
    let user;
    if (phone) {
      user = await User.findOne({ phoneNumber: phone });
    } else if (email) {
      user = await User.findOne({ email: email });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Get all referrals made by this user (users they referred)
    const referrals = await Referral.find({ referrer: user._id });

    // Get all users referred by this user
    const referredUsers = await User.find({ referredBy: user._id })
      .select("name email phoneNumber profilePicture createdAt")
      .sort({ createdAt: -1 });

    // Get commission and withdrawal data
    const dailyCommissions = await DailyCommission.find({ referrer: user._id });
    const withdrawals = await CommissionWithdrawal.find({ user: user._id });

    // Calculate statistics
    const totalReferrals = referredUsers.length;
    const referralLimit = user.referralLimit || 50;
    const remainingReferrals = Math.max(0, referralLimit - totalReferrals);
    const referralLimitReached = totalReferrals >= referralLimit;

    // Referral status breakdown
    const activeReferrals = referrals.filter((r) => r.status === "ACTIVE").length;
    const pendingReferrals = referrals.filter((r) => r.status === "PENDING").length;
    const completedReferrals = referrals.filter((r) => r.status === "COMPLETED").length;

    // Earnings calculations
    const totalEarnings = dailyCommissions.reduce((sum, c) => sum + (c.amount || 0), 0);
    const totalCommission = referrals.reduce((sum, r) => sum + (r.totalCommission || 0), 0);
    const totalWithdrawn = withdrawals
      .filter((w) => ["COMPLETED", "PENDING"].includes(w.status))
      .reduce((sum, w) => sum + (w.amount || 0), 0);
    const availableBalance = totalEarnings - totalWithdrawn;

    // Purchase statistics
    const totalProducts = referrals.reduce(
      (sum, r) => sum + (r.purchases ? r.purchases.length : 0),
      0
    );

    // Build detailed referred users list
    const referredUsersDetailed = await Promise.all(
      referredUsers.map(async (refUser) => {
        const referral = await Referral.findOne({
          referrer: user._id,
          referredUser: refUser._id,
        });

        let totalProducts = 0;
        let totalCommission = 0;
        let status = "PENDING";
        let productList = [];

        if (referral) {
          totalProducts = referral.purchases ? referral.purchases.length : 0;
          totalCommission = referral.purchases
            ? referral.purchases.reduce(
                (sum, p) => sum + ((p.commissionPerDay || 0) * (p.paidDays || 0)),
                0
              )
            : 0;
          status = referral.status;

          // Get product details
          productList = referral.purchases.map((p) => ({
            productName: p.productSnapshot?.productName || null,
            productId: p.productSnapshot?.productId || null,
            totalAmount: p.amount,
            dateOfPurchase: p.date,
            days: p.days,
            paidDays: p.paidDays || 0,
            pendingDays: p.pendingDays || 0,
            commissionPerDay: p.commissionPerDay || 0,
            status: p.status,
          }));
        }

        return {
          userId: refUser._id,
          name: refUser.name,
          email: refUser.email,
          phoneNumber: refUser.phoneNumber,
          profilePicture: refUser.profilePicture || "",
          joinedAt: refUser.createdAt,
          status,
          totalProducts,
          totalCommission: Math.round(totalCommission * 100) / 100,
          products: productList,
        };
      })
    );

    // Build response
    res.json({
      success: true,
      data: {
        userInfo: {
          userId: user._id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          profilePicture: user.profilePicture,
          referralCode: user.referralCode,
          createdAt: user.createdAt,
        },
        referralStats: {
          totalReferrals,
          referralLimit,
          remainingReferrals,
          referralLimitReached,
          activeReferrals,
          pendingReferrals,
          completedReferrals,
          totalProducts,
        },
        earnings: {
          totalEarnings: Math.round(totalEarnings * 100) / 100,
          totalCommission: Math.round(totalCommission * 100) / 100,
          availableBalance: Math.round(availableBalance * 100) / 100,
          totalWithdrawn: Math.round(totalWithdrawn * 100) / 100,
        },
        referredUsers: referredUsersDetailed,
        withdrawals: withdrawals.map((w) => ({
          id: w._id,
          amount: w.amount,
          status: w.status,
          paymentMethod: w.paymentMethod,
          requestedAt: w.createdAt,
          processedAt: w.processedAt,
        })),
      },
    });
  } catch (error) {
    console.error("Error in getUserReferralDetails:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * @desc    Get all users with referral codes
 * @route   GET /api/admin/referrals/all-users
 * @access  Admin
 */
exports.getAllUsersWithReferrals = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;

    // Build query
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
        { referralCode: { $regex: search, $options: "i" } },
      ];
    }

    // Get total count
    const totalUsers = await User.countDocuments(query);

    // Get users with pagination
    const users = await User.find(query)
      .select("name email phoneNumber referralCode createdAt")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Get referral stats for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const referredCount = await User.countDocuments({ referredBy: user._id });
        const referrals = await Referral.find({ referrer: user._id });
        const totalEarnings = await DailyCommission.aggregate([
          { $match: { referrer: user._id } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);

        return {
          userId: user._id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          referralCode: user.referralCode,
          joinedAt: user.createdAt,
          totalReferrals: referredCount,
          activeReferrals: referrals.filter((r) => r.status === "ACTIVE").length,
          totalEarnings: totalEarnings.length > 0 ? Math.round(totalEarnings[0].total * 100) / 100 : 0,
        };
      })
    );

    res.json({
      success: true,
      data: {
        users: usersWithStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalUsers / parseInt(limit)),
          totalUsers,
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Error in getAllUsersWithReferrals:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * @desc    Get detailed stats for a specific user's referral
 * @route   GET /api/admin/referrals/user/:userId
 * @access  Admin
 */
exports.getUserReferralDetailsById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Get all referrals made by this user
    const referrals = await Referral.find({ referrer: userId });

    // Get all users referred by this user
    const referredUsers = await User.find({ referredBy: userId })
      .select("name email phoneNumber profilePicture createdAt")
      .sort({ createdAt: -1 });

    // Get commission and withdrawal data
    const dailyCommissions = await DailyCommission.find({ referrer: userId });
    const withdrawals = await CommissionWithdrawal.find({ user: userId });

    // Calculate statistics
    const totalReferrals = referredUsers.length;
    const referralLimit = user.referralLimit || 50;

    // Earnings calculations
    const totalEarnings = dailyCommissions.reduce((sum, c) => sum + (c.amount || 0), 0);
    const totalCommission = referrals.reduce((sum, r) => sum + (r.totalCommission || 0), 0);
    const totalWithdrawn = withdrawals
      .filter((w) => ["COMPLETED", "PENDING"].includes(w.status))
      .reduce((sum, w) => sum + (w.amount || 0), 0);
    const availableBalance = totalEarnings - totalWithdrawn;

    // Build detailed referred users list
    const referredUsersDetailed = await Promise.all(
      referredUsers.map(async (refUser) => {
        const referral = await Referral.findOne({
          referrer: userId,
          referredUser: refUser._id,
        });

        let totalProducts = 0;
        let totalCommission = 0;
        let status = "PENDING";
        let productList = [];

        if (referral) {
          totalProducts = referral.purchases ? referral.purchases.length : 0;
          totalCommission = referral.purchases
            ? referral.purchases.reduce(
                (sum, p) => sum + ((p.commissionPerDay || 0) * (p.paidDays || 0)),
                0
              )
            : 0;
          status = referral.status;

          productList = referral.purchases.map((p) => ({
            productName: p.productSnapshot?.productName || null,
            productId: p.productSnapshot?.productId || null,
            totalAmount: p.amount,
            dateOfPurchase: p.date,
            days: p.days,
            paidDays: p.paidDays || 0,
            pendingDays: p.pendingDays || 0,
            commissionPerDay: p.commissionPerDay || 0,
            status: p.status,
          }));
        }

        return {
          userId: refUser._id,
          name: refUser.name,
          email: refUser.email,
          phoneNumber: refUser.phoneNumber,
          profilePicture: refUser.profilePicture || "",
          joinedAt: refUser.createdAt,
          status,
          totalProducts,
          totalCommission: Math.round(totalCommission * 100) / 100,
          products: productList,
        };
      })
    );

    res.json({
      success: true,
      data: {
        userInfo: {
          userId: user._id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          profilePicture: user.profilePicture,
          referralCode: user.referralCode,
          createdAt: user.createdAt,
        },
        referralStats: {
          totalReferrals,
          referralLimit,
          activeReferrals: referrals.filter((r) => r.status === "ACTIVE").length,
          pendingReferrals: referrals.filter((r) => r.status === "PENDING").length,
          completedReferrals: referrals.filter((r) => r.status === "COMPLETED").length,
          totalProducts: referrals.reduce(
            (sum, r) => sum + (r.purchases ? r.purchases.length : 0),
            0
          ),
        },
        earnings: {
          totalEarnings: Math.round(totalEarnings * 100) / 100,
          totalCommission: Math.round(totalCommission * 100) / 100,
          availableBalance: Math.round(availableBalance * 100) / 100,
          totalWithdrawn: Math.round(totalWithdrawn * 100) / 100,
        },
        referredUsers: referredUsersDetailed,
        withdrawals: withdrawals.map((w) => ({
          id: w._id,
          amount: w.amount,
          status: w.status,
          paymentMethod: w.paymentMethod,
          requestedAt: w.createdAt,
          processedAt: w.processedAt,
        })),
      },
    });
  } catch (error) {
    console.error("Error in getUserReferralDetailsById:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = exports;
