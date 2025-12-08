const User = require("../models/User");
const Order = require("../models/Order");
const Kyc = require("../models/Kyc");

exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));

    // ---------------- USERS ----------------
    const totalUsers = await User.countDocuments();
    const newUsersToday = await User.countDocuments({
      createdAt: { $gte: startOfToday }
    });

    // ---------------- ORDERS ----------------
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: "pending" });
    const todayOrders = await Order.countDocuments({
      createdAt: { $gte: startOfToday }
    });

    // Revenue: handle "amount" OR "totalAmount"
    const revenueData = await Order.aggregate([
      { 
        $match: { status: "paid" } 
      },
      {
        $group: { 
          _id: null, 
          total: { 
            $sum: { 
              $ifNull: ["$amount", "$totalAmount"] 
            } 
          } 
        }
      }
    ]);

    const totalRevenue = revenueData.length ? revenueData[0].total : 0;

    // ---------------- KYC ----------------
    const pendingKyc = await Kyc.countDocuments({ status: "pending" });

    const approvedKyc = 
      await Kyc.countDocuments({ status: "approved" }) +
      await Kyc.countDocuments({ status: "auto_approved" });

    const rejectedKyc = await Kyc.countDocuments({ status: "rejected" });

    const todayKyc = await Kyc.countDocuments({
      submittedAt: { $gte: startOfToday }
    });

    // ---------------- WALLET ----------------
    const walletStats = await User.aggregate([
      { $group: { _id: null, totalBalance: { $sum: "$wallet.balance" } } }
    ]);

    const totalSystemBalance = walletStats.length ? walletStats[0].totalBalance : 0;

    // ---------------- RECENT ACTIVITY ----------------
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select("name email createdAt");

    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select("userId amount totalAmount status createdAt")
      .populate("userId", "name email");

    const recentKyc = await Kyc.find()
      .sort({ submittedAt: -1 })
      .limit(10)
      .select("userId status submittedAt")
      .populate("userId", "name email");

    // ---------------- RESPONSE ----------------
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
          users: recentUsers,
          orders: recentOrders,
          kyc: recentKyc
        }
      }
    });

  } catch (err) {
    console.error("Dashboard Stats Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load dashboard stats",
      error: err.message
    });
  }
};
