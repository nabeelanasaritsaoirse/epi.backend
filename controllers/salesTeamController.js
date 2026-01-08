const User = require("../models/User");
const InstallmentOrder = require("../models/InstallmentOrder");
const Wishlist = require("../models/Wishlist");
const Cart = require("../models/Cart");
const Product = require("../models/Product");

/**
 * @route   GET /api/sales/dashboard-stats
 * @desc    Get dashboard statistics for sales team
 * @access  Sales Team, Admin, Super Admin
 */
exports.getDashboardStats = async (req, res) => {
  try {
    // Get total users (exclude admin roles)
    const totalUsers = await User.countDocuments({ role: "user" });

    // Get active orders
    const activeOrders = await InstallmentOrder.countDocuments({
      status: "ACTIVE",
    });

    // Get total revenue from completed and active orders
    const revenueAggregation = await InstallmentOrder.aggregate([
      { $match: { status: { $in: ["ACTIVE", "COMPLETED"] } } },
      { $group: { _id: null, total: { $sum: "$totalPaidAmount" } } },
    ]);
    const totalRevenue =
      revenueAggregation.length > 0 ? revenueAggregation[0].total : 0;

    // Get pending KYC count
    const pendingKYC = await User.countDocuments({
      role: "user",
      "kycDetails.aadharVerified": false,
    });

    res.json({
      success: true,
      data: {
        totalUsers,
        activeOrders,
        totalRevenue,
        pendingKYC,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/sales/users
 * @desc    Get all users with Level 1 referral counts
 * @access  Sales Team, Admin, Super Admin
 */
exports.getAllUsersWithReferrals = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "" } = req.query;

    // Build search query
    let query = { role: "user" };
    if (search) {
      query.$or = [
        { name: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
        { phoneNumber: new RegExp(search, "i") },
        { referralCode: new RegExp(search, "i") },
      ];
    }

    // Get users with pagination
    const users = await User.find(query)
      .select('name email phoneNumber profilePicture referralCode createdAt wallet.balance autopaySettings')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    // For each user, get Level 1 count
    const usersWithReferrals = await Promise.all(
      users.map(async (user) => {
        const level1Count = await User.countDocuments({ referredBy: user._id });

        return {
          ...user,
          level1Count,
          referralCode: user.referralCode || "N/A",
        };
      })
    );

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users: usersWithReferrals,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/sales/users/:userId
 * @desc    Get user detail with Level 1 & Level 2 referrals, wishlist, cart, orders
 * @access  Sales Team, Admin, Super Admin
 */
exports.getUserDetail = async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user with populated referral info
    const user = await User.findById(userId)
      .select("-password") // Exclude password
      .populate("referredBy", "name email referralCode")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get Level 1 referrals (direct)
    const level1Users = await User.find({ referredBy: userId })
      .select("name email phoneNumber profilePicture createdAt referralCode")
      .lean();

    // Get Level 2 referrals (indirect) - users referred by Level 1 users
    const level1Ids = level1Users.map((u) => u._id);
    const level2Users = await User.find({ referredBy: { $in: level1Ids } })
      .select("name email phoneNumber createdAt referredBy")
      .lean();

    // Group Level 2 by their Level 1 referrer
    const level2ByReferrer = level2Users.reduce((acc, user) => {
      const referrerId = user.referredBy.toString();
      if (!acc[referrerId]) acc[referrerId] = [];
      acc[referrerId].push(user);
      return acc;
    }, {});

    // Enrich Level 1 users with their Level 2 data
    const level1WithLevel2 = level1Users.map((l1User) => ({
      ...l1User,
      level2Users: level2ByReferrer[l1User._id.toString()] || [],
      level2Count: (level2ByReferrer[l1User._id.toString()] || []).length,
    }));

    // Get wishlist
    const wishlist = await Wishlist.findOne({ userId })
      .populate("products", "name price images brand")
      .lean();

    // Get cart
    const cart = await Cart.findOne({ userId }).lean();

    // Populate cart products
    let cartProducts = [];
    if (cart && cart.products && cart.products.length > 0) {
      cartProducts = await Promise.all(
        cart.products.map(async (item) => {
          const product = await Product.findById(item.productId)
            .select("name price images brand stock")
            .lean();
          return {
            ...item,
            productDetails: product,
          };
        })
      );
      // Filter out items where product was deleted
      cartProducts = cartProducts.filter(
        (item) => item.productDetails !== null
      );
    }

    // Get orders
    const orders = await InstallmentOrder.find({ userId })
      .select(
        "orderId productName status deliveryStatus totalDays paidInstallments totalPaidAmount remainingAmount createdAt"
      )
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      data: {
        user: {
          ...user,
          level1Count: level1Users.length,
          level2Count: level2Users.length,
        },
        level1Referrals: level1WithLevel2,
        wishlist: wishlist?.products || [],
        cart: cartProducts,
        orders,
      },
    });
  } catch (error) {
    console.error("Error fetching user detail:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user detail",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/sales/users/:userId/orders
 * @desc    Get user's order history
 * @access  Sales Team, Admin, Super Admin
 */
exports.getUserOrders = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const orders = await InstallmentOrder.find({ user: userId })
      .select(
        "orderId productName productSnapshot quantity pricePerUnit totalProductPrice totalDays dailyPaymentAmount paidInstallments totalPaidAmount remainingAmount status deliveryStatus deliveryAddress createdAt"
      )
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    // ✅ FIX: use SAME FIELD as find()
    const total = await InstallmentOrder.countDocuments({ user: userId });

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user orders",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/sales/users/:userId/wishlist
 * @desc    Get user's wishlist
 * @access  Sales Team, Admin, Super Admin
 */
exports.getUserWishlist = async (req, res) => {
  try {
    const { userId } = req.params;

    const wishlist = await Wishlist.findOne({ userId })
      .populate(
        "products",
        "name price finalPrice discount images brand stock isActive"
      )
      .lean();

    res.json({
      success: true,
      data: wishlist?.products || [],
    });
  } catch (error) {
    console.error("Error fetching user wishlist:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user wishlist",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/sales/users/:userId/cart
 * @desc    Get user's cart
 * @access  Sales Team, Admin, Super Admin
 */
exports.getUserCart = async (req, res) => {
  try {
    const { userId } = req.params;

    const cart = await Cart.findOne({ userId }).lean();

    if (!cart || !cart.products || cart.products.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    // Populate product details
    const cartWithProducts = await Promise.all(
      cart.products.map(async (item) => {
        const product = await Product.findById(item.productId)
          .select("name price finalPrice images brand stock")
          .lean();

        return {
          ...item,
          product: product || null,
        };
      })
    );

    // Filter out items where product was deleted
    const validCartItems = cartWithProducts.filter(
      (item) => item.product !== null
    );

    res.json({
      success: true,
      data: validCartItems,
    });
  } catch (error) {
    console.error("Error fetching user cart:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user cart",
      error: error.message,
    });
  }
};
