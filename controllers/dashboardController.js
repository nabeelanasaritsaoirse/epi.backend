const User = require("../models/User");
const Order = require("../models/Order");
const Kyc = require("../models/Kyc");

exports.getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0, 0, 0, 0
    );

    // Run everything in parallel for speed
    const [
      totalUsers,
      newUsersToday,
      totalOrders,
      pendingOrders,
      todayOrders,
      revenueAgg,
      pendingKyc,
      approvedKyc,
      rejectedKyc,
      todayKyc,
      walletAgg,
      recentUsers,
      recentOrders,
      recentKyc
    ] = await Promise.all([
      // ---------- USERS ----------
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: startOfToday } }),

      // ---------- ORDERS ----------
      Order.countDocuments(),
      // FIX: use orderStatus, not status
      Order.countDocuments({ orderStatus: "pending" }),
      Order.countDocuments({ createdAt: { $gte: startOfToday } }),

      // FIX: use paymentStatus + totalPaid/orderAmount instead of status/amount
      Order.aggregate([
        {
          $match: { paymentStatus: "completed" }
        },
        {
          $group: {
            _id: null,
            // if totalPaid is null, fall back to orderAmount
            total: {
              $sum: {
                $ifNull: ["$totalPaid", "$orderAmount"]
              }
            }
          }
        }
      ]),

      // ---------- KYC ----------
      Kyc.countDocuments({ status: "pending" }),
      Kyc.countDocuments({ status: "approved" }),
      Kyc.countDocuments({ status: "rejected" }),
      Kyc.countDocuments({ submittedAt: { $gte: startOfToday } }),

      // ---------- WALLET ----------
      User.aggregate([
        {
          $group: {
            _id: null,
            totalBalance: { $sum: "$wallet.balance" }
          }
        }
      ]),

      // ---------- RECENT ACTIVITY ----------
      User.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select("name email phoneNumber createdAt"),

      // FIX: use `user` field, not `userId`
      Order.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select("user orderAmount orderStatus paymentStatus createdAt")
        .populate("user", "name email phoneNumber"),

      // KYC: userId is correct here (matches schema)
      Kyc.find()
        .sort({ submittedAt: -1 })
        .limit(10)
        .select("userId status submittedAt")
        .populate("userId", "name email phoneNumber")
    ]);

    const totalRevenue = revenueAgg[0]?.total || 0;
    const totalSystemBalance = walletAgg[0]?.totalBalance || 0;

    return res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          newToday: newUsersToday
        },
        orders: {
          total: totalOrders,
          pending: pendingOrders,
          today: todayOrders,
          revenue: totalRevenue
        },
        kyc: {
          pending: pendingKyc,
          approved: approvedKyc,
          rejected: rejectedKyc,
          today: todayKyc
        },
        wallet: {
          systemBalance: totalSystemBalance
        },
        recentActivity: {
          // Option D: name + email + phone are all available
          users: recentUsers,
          orders: recentOrders,
          kyc: recentKyc
        }
      }
    });
  } catch (err) {
    console.error("Dashboard Stats Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard stats",
      error: err.message
    });
  }
};
