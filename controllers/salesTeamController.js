const User = require("../models/User");
const InstallmentOrder = require("../models/InstallmentOrder");
const Wishlist = require("../models/Wishlist");
const Cart = require("../models/Cart");
const Product = require("../models/Product");

/**
 * Helper function to get the effective user ID for sales team APIs
 * If the logged-in admin/sales_team member has a linkedUserId, use that
 * Otherwise use their own _id (for regular users or admins without linked account)
 */
const getEffectiveUserId = (user) => {
  // If linkedUserId exists and is populated, use it
  if (user.linkedUserId) {
    // Handle both populated object and ObjectId
    return user.linkedUserId._id || user.linkedUserId;
  }
  return user._id;
};

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

// ========== MY TEAM APIs (Logged-in User's Own Referral Data) ==========

/**
 * @route   GET /api/sales/my-team
 * @desc    Get logged-in user's direct referrals (L1 team members)
 * @access  Sales Team, Admin, Super Admin
 */
exports.getMyTeam = async (req, res) => {
  try {
    // Use linkedUserId if available (for sub-admins linked to a user account)
    const myId = getEffectiveUserId(req.user);
    const { page = 1, limit = 20, search = '', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Build search query for L1 members (users referred by me)
    let query = { referredBy: myId };
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { phoneNumber: new RegExp(search, 'i') },
        { referralCode: new RegExp(search, 'i') }
      ];
    }

    // Get L1 team members with pagination
    const teamMembers = await User.find(query)
      .select('name email phoneNumber profilePicture referralCode createdAt')
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const total = await User.countDocuments(query);

    // Get stats for each team member
    const teamMemberIds = teamMembers.map(m => m._id);

    // Get L2 counts for each L1 member
    const l2Counts = await User.aggregate([
      { $match: { referredBy: { $in: teamMemberIds } } },
      { $group: { _id: '$referredBy', count: { $sum: 1 } } }
    ]);
    const l2CountMap = l2Counts.reduce((acc, item) => {
      acc[item._id.toString()] = item.count;
      return acc;
    }, {});

    // Get order stats for each L1 member
    const orderStats = await InstallmentOrder.aggregate([
      { $match: { user: { $in: teamMemberIds } } },
      {
        $group: {
          _id: '$user',
          totalOrders: { $sum: 1 },
          activeOrders: { $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] } },
          totalOrderValue: { $sum: '$productPrice' },
          totalPaidAmount: { $sum: '$totalPaidAmount' }
        }
      }
    ]);
    const orderStatsMap = orderStats.reduce((acc, item) => {
      acc[item._id.toString()] = item;
      return acc;
    }, {});

    // Enrich team members with stats
    const enrichedMembers = teamMembers.map(member => {
      const memberId = member._id.toString();
      const stats = orderStatsMap[memberId] || {};
      return {
        ...member,
        stats: {
          level2Count: l2CountMap[memberId] || 0,
          totalOrders: stats.totalOrders || 0,
          activeOrders: stats.activeOrders || 0,
          totalOrderValue: stats.totalOrderValue || 0,
          totalPaidAmount: stats.totalPaidAmount || 0
        }
      };
    });

    // Calculate summary
    const totalL1 = await User.countDocuments({ referredBy: myId });
    const totalL2 = await User.countDocuments({ referredBy: { $in: teamMemberIds } });
    const activeMembers = enrichedMembers.filter(m => m.stats.totalOrders > 0).length;

    res.json({
      success: true,
      data: {
        teamMembers: enrichedMembers,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        },
        summary: {
          totalL1,
          totalL2,
          activeMembers
        }
      }
    });

  } catch (error) {
    console.error('Error fetching my team:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team members',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/sales/my-team/users
 * @desc    Get all users in logged-in user's referral chain (L1 + L2)
 * @access  Sales Team, Admin, Super Admin
 */
exports.getMyTeamUsers = async (req, res) => {
  try {
    // Use linkedUserId if available (for sub-admins linked to a user account)
    const myId = getEffectiveUserId(req.user);
    const { page = 1, limit = 20, search = '', level, referrerId, hasOrders } = req.query;

    // Get L1 member IDs
    const l1Members = await User.find({ referredBy: myId }).select('_id').lean();
    const l1Ids = l1Members.map(m => m._id);

    // Build query based on level filter
    let users = [];

    if (level === '1') {
      // Only L1 users
      let query = { referredBy: myId };
      if (search) {
        query.$or = [
          { name: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') },
          { phoneNumber: new RegExp(search, 'i') }
        ];
      }
      users = await User.find(query)
        .select('name email phoneNumber profilePicture createdAt referredBy')
        .populate('referredBy', 'name referralCode')
        .lean();
      users = users.map(u => ({ ...u, level: 1 }));
    } else if (level === '2') {
      // Only L2 users
      let query = { referredBy: { $in: l1Ids } };
      if (referrerId) {
        query.referredBy = referrerId;
      }
      if (search) {
        query.$or = [
          { name: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') },
          { phoneNumber: new RegExp(search, 'i') }
        ];
      }
      users = await User.find(query)
        .select('name email phoneNumber profilePicture createdAt referredBy')
        .populate('referredBy', 'name referralCode')
        .lean();
      users = users.map(u => ({ ...u, level: 2 }));
    } else {
      // Both L1 and L2
      let l1Query = { referredBy: myId };
      let l2Query = { referredBy: { $in: l1Ids } };

      if (search) {
        const searchCondition = {
          $or: [
            { name: new RegExp(search, 'i') },
            { email: new RegExp(search, 'i') },
            { phoneNumber: new RegExp(search, 'i') }
          ]
        };
        l1Query = { ...l1Query, ...searchCondition };
        l2Query = { ...l2Query, ...searchCondition };
      }

      const l1Users = await User.find(l1Query)
        .select('name email phoneNumber profilePicture createdAt referredBy')
        .populate('referredBy', 'name referralCode')
        .lean();

      const l2Users = await User.find(l2Query)
        .select('name email phoneNumber profilePicture createdAt referredBy')
        .populate('referredBy', 'name referralCode')
        .lean();

      users = [
        ...l1Users.map(u => ({ ...u, level: 1 })),
        ...l2Users.map(u => ({ ...u, level: 2 }))
      ];
    }

    // Get order stats for all users
    const userIds = users.map(u => u._id);
    const orderStats = await InstallmentOrder.aggregate([
      { $match: { user: { $in: userIds } } },
      {
        $group: {
          _id: '$user',
          totalOrders: { $sum: 1 },
          activeOrders: { $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] } },
          totalPaid: { $sum: '$totalPaidAmount' }
        }
      }
    ]);
    const orderStatsMap = orderStats.reduce((acc, item) => {
      acc[item._id.toString()] = item;
      return acc;
    }, {});

    // Enrich users with order stats
    let enrichedUsers = users.map(user => ({
      ...user,
      orderStats: orderStatsMap[user._id.toString()] || { totalOrders: 0, activeOrders: 0, totalPaid: 0 }
    }));

    // Filter by hasOrders if specified
    if (hasOrders === 'true') {
      enrichedUsers = enrichedUsers.filter(u => u.orderStats.totalOrders > 0);
    } else if (hasOrders === 'false') {
      enrichedUsers = enrichedUsers.filter(u => u.orderStats.totalOrders === 0);
    }

    // Sort by createdAt desc
    enrichedUsers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination
    const total = enrichedUsers.length;
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const paginatedUsers = enrichedUsers.slice(startIndex, startIndex + parseInt(limit));

    // Calculate breakdown
    const level1Count = await User.countDocuments({ referredBy: myId });
    const level2Count = await User.countDocuments({ referredBy: { $in: l1Ids } });
    const usersWithOrders = enrichedUsers.filter(u => u.orderStats.totalOrders > 0).length;

    res.json({
      success: true,
      data: {
        users: paginatedUsers,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        },
        breakdown: {
          level1Users: level1Count,
          level2Users: level2Count,
          usersWithOrders
        }
      }
    });

  } catch (error) {
    console.error('Error fetching my team users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team users',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/sales/my-team/:userId
 * @desc    Get detail view of specific team member (must be in L1/L2 chain)
 * @access  Sales Team, Admin, Super Admin
 */
exports.getMyTeamMemberDetail = async (req, res) => {
  try {
    // Use linkedUserId if available (for sub-admins linked to a user account)
    const myId = getEffectiveUserId(req.user);
    const { userId } = req.params;

    // First, verify the user is in my L1 or L2 chain
    const l1Check = await User.findOne({ _id: userId, referredBy: myId });
    let userLevel = null;

    if (l1Check) {
      userLevel = 1;
    } else {
      // Check L2
      const l1Ids = await User.find({ referredBy: myId }).distinct('_id');
      const l2Check = await User.findOne({ _id: userId, referredBy: { $in: l1Ids } });
      if (l2Check) {
        userLevel = 2;
      }
    }

    if (!userLevel) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. User is not in your referral chain.',
        code: 'NOT_IN_CHAIN'
      });
    }

    // Get user details
    const user = await User.findById(userId)
      .select('-password')
      .populate('referredBy', 'name email referralCode')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get L1 referrals of this user
    const level1Users = await User.find({ referredBy: userId })
      .select('name email phoneNumber profilePicture createdAt referralCode')
      .lean();

    // Get L2 count for each L1 user
    const l1Ids = level1Users.map(u => u._id);
    const l2Counts = await User.aggregate([
      { $match: { referredBy: { $in: l1Ids } } },
      { $group: { _id: '$referredBy', count: { $sum: 1 } } }
    ]);
    const l2CountMap = l2Counts.reduce((acc, item) => {
      acc[item._id.toString()] = item.count;
      return acc;
    }, {});

    // Get order count for each L1 user
    const orderCounts = await InstallmentOrder.aggregate([
      { $match: { user: { $in: l1Ids } } },
      { $group: { _id: '$user', count: { $sum: 1 } } }
    ]);
    const orderCountMap = orderCounts.reduce((acc, item) => {
      acc[item._id.toString()] = item.count;
      return acc;
    }, {});

    const level1WithStats = level1Users.map(l1User => ({
      ...l1User,
      level2Count: l2CountMap[l1User._id.toString()] || 0,
      orderCount: orderCountMap[l1User._id.toString()] || 0
    }));

    // Get total L2 count
    const totalL2Count = await User.countDocuments({ referredBy: { $in: l1Ids } });

    // Get recent orders
    const recentOrders = await InstallmentOrder.find({ user: userId })
      .select('orderId productName status totalProductPrice totalPaidAmount createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Get wishlist
    const wishlist = await Wishlist.findOne({ userId })
      .populate('products', 'name price images brand')
      .lean();

    // Get cart
    const cart = await Cart.findOne({ userId }).lean();
    let cartProducts = [];
    if (cart && cart.products && cart.products.length > 0) {
      cartProducts = await Promise.all(cart.products.map(async (item) => {
        const product = await Product.findById(item.productId)
          .select('name price images brand stock')
          .lean();
        return { ...item, productDetails: product };
      }));
      cartProducts = cartProducts.filter(item => item.productDetails !== null);
    }

    res.json({
      success: true,
      data: {
        user: {
          ...user,
          level: userLevel
        },
        referralStats: {
          level1Count: level1Users.length,
          level2Count: totalL2Count
        },
        level1Referrals: level1WithStats,
        recentOrders,
        wishlist: wishlist?.products || [],
        cart: cartProducts
      }
    });

  } catch (error) {
    console.error('Error fetching team member detail:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team member detail',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/sales/my-stats
 * @desc    Get dashboard stats for logged-in user's team only
 * @access  Sales Team, Admin, Super Admin
 */
exports.getMyStats = async (req, res) => {
  try {
    // Use linkedUserId if available (for sub-admins linked to a user account)
    const myId = getEffectiveUserId(req.user);
    const { period = 'all' } = req.query;

    // Calculate date range based on period
    let startDate = null;
    const now = new Date();

    switch (period) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = null;
    }

    // Get my user data
    const myUser = await User.findById(myId)
      .select('name referralCode referralLimit')
      .lean();

    // Get L1 members
    const l1Members = await User.find({ referredBy: myId }).select('_id').lean();
    const l1Ids = l1Members.map(m => m._id);

    // Get L2 members
    const l2Count = await User.countDocuments({ referredBy: { $in: l1Ids } });

    // Calculate new members this period
    let newThisPeriod = 0;
    if (startDate) {
      newThisPeriod = await User.countDocuments({
        referredBy: myId,
        createdAt: { $gte: startDate }
      });
    }

    // Get all users in my chain (L1 + L2)
    const l2Members = await User.find({ referredBy: { $in: l1Ids } }).select('_id').lean();
    const allUserIds = [...l1Ids, ...l2Members.map(m => m._id)];

    // Order stats
    let orderQuery = { user: { $in: allUserIds } };
    if (startDate) {
      orderQuery.createdAt = { $gte: startDate };
    }

    const orderAggregation = await InstallmentOrder.aggregate([
      { $match: orderQuery },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          activeOrders: { $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] } },
          completedOrders: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
          cancelledOrders: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] } },
          totalOrderValue: { $sum: '$productPrice' },
          totalPaidAmount: { $sum: '$totalPaidAmount' },
          totalCommission: { $sum: '$totalCommissionPaid' }
        }
      }
    ]);

    const orderStats = orderAggregation[0] || {
      totalOrders: 0,
      activeOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      totalOrderValue: 0,
      totalPaidAmount: 0,
      totalCommission: 0
    };

    // Commission breakdown (L1 vs L2)
    const l1CommissionAgg = await InstallmentOrder.aggregate([
      { $match: { user: { $in: l1Ids }, ...(startDate ? { createdAt: { $gte: startDate } } : {}) } },
      { $group: { _id: null, commission: { $sum: '$totalCommissionPaid' } } }
    ]);
    const l1Commission = l1CommissionAgg[0]?.commission || 0;

    const l2MemberIds = l2Members.map(m => m._id);
    const l2CommissionAgg = await InstallmentOrder.aggregate([
      { $match: { user: { $in: l2MemberIds }, ...(startDate ? { createdAt: { $gte: startDate } } : {}) } },
      { $group: { _id: null, commission: { $sum: '$totalCommissionPaid' } } }
    ]);
    const l2Commission = l2CommissionAgg[0]?.commission || 0;

    // Count active members (with at least 1 order)
    const activeMembers = await InstallmentOrder.distinct('user', { user: { $in: allUserIds } });

    // Conversion rate
    const totalTeamSize = l1Members.length + l2Count;
    const conversionRate = totalTeamSize > 0 ? ((activeMembers.length / totalTeamSize) * 100).toFixed(2) : 0;

    // Remaining referrals
    const referralLimit = myUser.referralLimit || 50;
    const remainingReferrals = Math.max(0, referralLimit - l1Members.length);

    res.json({
      success: true,
      data: {
        user: {
          _id: myId,
          name: myUser.name,
          referralCode: myUser.referralCode,
          referralLimit,
          remainingReferrals
        },
        teamStats: {
          totalL1Members: l1Members.length,
          totalL2Users: l2Count,
          totalTeamSize,
          activeMembers: activeMembers.length,
          newThisPeriod
        },
        orderStats: {
          totalOrders: orderStats.totalOrders,
          activeOrders: orderStats.activeOrders,
          completedOrders: orderStats.completedOrders,
          cancelledOrders: orderStats.cancelledOrders,
          totalOrderValue: orderStats.totalOrderValue
        },
        revenueStats: {
          totalPaidAmount: orderStats.totalPaidAmount,
          pendingAmount: orderStats.totalOrderValue - orderStats.totalPaidAmount
        },
        commissionStats: {
          totalEarned: orderStats.totalCommission,
          fromL1: l1Commission,
          fromL2: l2Commission,
          pendingCommission: 0 // Can be calculated if needed
        },
        conversionRate: parseFloat(conversionRate)
      }
    });

  } catch (error) {
    console.error('Error fetching my stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stats',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/sales/my-opportunities
 * @desc    Get hot leads from logged-in user's referral chain
 * @access  Sales Team, Admin, Super Admin
 */
exports.getMyOpportunities = async (req, res) => {
  try {
    // Use linkedUserId if available (for sub-admins linked to a user account)
    const myId = getEffectiveUserId(req.user);
    const { page = 1, limit = 20, type } = req.query;

    // Get all users in my chain
    const l1Members = await User.find({ referredBy: myId }).select('_id').lean();
    const l1Ids = l1Members.map(m => m._id);
    const l2Members = await User.find({ referredBy: { $in: l1Ids } }).select('_id').lean();
    const allUserIds = [...l1Ids, ...l2Members.map(m => m._id)];

    // Get users with orders
    const usersWithOrders = await InstallmentOrder.distinct('user', { user: { $in: allUserIds } });
    const usersWithOrdersSet = new Set(usersWithOrders.map(id => id.toString()));

    let opportunities = [];

    // Get all potential opportunities based on type
    if (!type || type === 'cart') {
      // Users with cart items but no orders
      const carts = await Cart.find({ userId: { $in: allUserIds } }).lean();
      for (const cart of carts) {
        if (!usersWithOrdersSet.has(cart.userId.toString()) && cart.products && cart.products.length > 0) {
          const user = await User.findById(cart.userId)
            .select('name email phoneNumber profilePicture referredBy')
            .populate('referredBy', 'name')
            .lean();
          if (user) {
            const level = l1Ids.some(id => id.toString() === cart.userId.toString()) ? 1 : 2;
            // Calculate cart value
            let cartValue = 0;
            for (const item of cart.products) {
              const product = await Product.findById(item.productId).select('price').lean();
              if (product) {
                cartValue += (product.price || 0) * (item.quantity || 1);
              }
            }
            opportunities.push({
              ...user,
              type: 'cart',
              level,
              details: {
                cartItems: cart.products.length,
                cartValue,
                lastActivity: cart.updatedAt
              }
            });
          }
        }
      }
    }

    if (!type || type === 'wishlist') {
      // Users with wishlist items but no orders
      const wishlists = await Wishlist.find({ userId: { $in: allUserIds } }).lean();
      for (const wishlist of wishlists) {
        if (!usersWithOrdersSet.has(wishlist.userId.toString()) && wishlist.products && wishlist.products.length > 0) {
          // Skip if already added from cart
          if (opportunities.some(o => o._id.toString() === wishlist.userId.toString())) continue;

          const user = await User.findById(wishlist.userId)
            .select('name email phoneNumber profilePicture referredBy')
            .populate('referredBy', 'name')
            .lean();
          if (user) {
            const level = l1Ids.some(id => id.toString() === wishlist.userId.toString()) ? 1 : 2;
            opportunities.push({
              ...user,
              type: 'wishlist',
              level,
              details: {
                wishlistItems: wishlist.products.length,
                lastActivity: wishlist.updatedAt
              }
            });
          }
        }
      }
    }

    if (!type || type === 'inactive') {
      // Users inactive for 30+ days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const inactiveUsers = await User.find({
        _id: { $in: allUserIds },
        $or: [
          { lastLogin: { $lt: thirtyDaysAgo } },
          { lastLogin: { $exists: false } }
        ]
      })
        .select('name email phoneNumber profilePicture referredBy lastLogin createdAt')
        .populate('referredBy', 'name')
        .lean();

      for (const user of inactiveUsers) {
        // Skip if already added
        if (opportunities.some(o => o._id.toString() === user._id.toString())) continue;

        const level = l1Ids.some(id => id.toString() === user._id.toString()) ? 1 : 2;
        opportunities.push({
          ...user,
          type: 'inactive',
          level,
          details: {
            lastLogin: user.lastLogin,
            daysSinceActivity: Math.floor((new Date() - new Date(user.lastLogin || user.createdAt)) / (1000 * 60 * 60 * 24))
          }
        });
      }
    }

    if (!type || type === 'new') {
      // New signups in last 7 days without orders
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const newUsers = await User.find({
        _id: { $in: allUserIds },
        createdAt: { $gte: sevenDaysAgo }
      })
        .select('name email phoneNumber profilePicture referredBy createdAt')
        .populate('referredBy', 'name')
        .lean();

      for (const user of newUsers) {
        if (!usersWithOrdersSet.has(user._id.toString())) {
          // Skip if already added
          if (opportunities.some(o => o._id.toString() === user._id.toString())) continue;

          const level = l1Ids.some(id => id.toString() === user._id.toString()) ? 1 : 2;
          opportunities.push({
            ...user,
            type: 'new',
            level,
            details: {
              signupDate: user.createdAt,
              daysSinceSignup: Math.floor((new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24))
            }
          });
        }
      }
    }

    // Calculate summary
    const summary = {
      withCart: opportunities.filter(o => o.type === 'cart').length,
      withWishlist: opportunities.filter(o => o.type === 'wishlist').length,
      inactive: opportunities.filter(o => o.type === 'inactive').length,
      newSignups: opportunities.filter(o => o.type === 'new').length
    };

    // Pagination
    const total = opportunities.length;
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const paginatedOpportunities = opportunities.slice(startIndex, startIndex + parseInt(limit));

    res.json({
      success: true,
      data: {
        opportunities: paginatedOpportunities,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        },
        summary
      }
    });

  } catch (error) {
    console.error('Error fetching opportunities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch opportunities',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/sales/my-activity
 * @desc    Get recent activity feed from logged-in user's team
 * @access  Sales Team, Admin, Super Admin
 */
exports.getMyActivity = async (req, res) => {
  try {
    // Use linkedUserId if available (for sub-admins linked to a user account)
    const myId = getEffectiveUserId(req.user);
    const { page = 1, limit = 20, type } = req.query;

    // Get all users in my chain
    const l1Members = await User.find({ referredBy: myId }).select('_id').lean();
    const l1Ids = l1Members.map(m => m._id);
    const l2Members = await User.find({ referredBy: { $in: l1Ids } }).select('_id').lean();
    const allUserIds = [...l1Ids, ...l2Members.map(m => m._id)];

    let activities = [];

    // Get signups
    if (!type || type === 'signup' || type === 'all') {
      const recentSignups = await User.find({ _id: { $in: allUserIds } })
        .select('name email phoneNumber profilePicture createdAt referredBy')
        .populate('referredBy', 'name referralCode')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      for (const user of recentSignups) {
        const level = l1Ids.some(id => id.toString() === user._id.toString()) ? 1 : 2;
        activities.push({
          type: 'signup',
          user: { _id: user._id, name: user.name, email: user.email, profilePicture: user.profilePicture },
          referredBy: user.referredBy,
          level,
          timestamp: user.createdAt,
          details: {}
        });
      }
    }

    // Get orders
    if (!type || type === 'order' || type === 'all') {
      const recentOrders = await InstallmentOrder.find({ user: { $in: allUserIds } })
        .select('user orderId productName productPrice status createdAt')
        .populate('user', 'name email profilePicture')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      for (const order of recentOrders) {
        if (order.user) {
          const level = l1Ids.some(id => id.toString() === order.user._id.toString()) ? 1 : 2;
          activities.push({
            type: 'order',
            user: { _id: order.user._id, name: order.user.name, email: order.user.email, profilePicture: order.user.profilePicture },
            level,
            timestamp: order.createdAt,
            details: {
              orderId: order.orderId,
              productName: order.productName,
              amount: order.productPrice,
              status: order.status
            }
          });
        }
      }
    }

    // Get payments (from installment payments)
    if (!type || type === 'payment' || type === 'all') {
      const ordersWithPayments = await InstallmentOrder.find({
        user: { $in: allUserIds },
        'payments.0': { $exists: true }
      })
        .select('user orderId payments')
        .populate('user', 'name email profilePicture')
        .lean();

      for (const order of ordersWithPayments) {
        if (order.user && order.payments) {
          const level = l1Ids.some(id => id.toString() === order.user._id.toString()) ? 1 : 2;
          // Get recent payments
          const recentPayments = order.payments
            .filter(p => p.status === 'PAID')
            .sort((a, b) => new Date(b.paidAt || b.dueDate) - new Date(a.paidAt || a.dueDate))
            .slice(0, 5);

          for (const payment of recentPayments) {
            activities.push({
              type: 'payment',
              user: { _id: order.user._id, name: order.user.name, email: order.user.email, profilePicture: order.user.profilePicture },
              level,
              timestamp: payment.paidAt || payment.dueDate,
              details: {
                orderId: order.orderId,
                amount: payment.amount,
                commission: payment.commission || 0
              }
            });
          }
        }
      }
    }

    // Sort all activities by timestamp
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Filter by type if specified
    if (type && type !== 'all') {
      activities = activities.filter(a => a.type === type);
    }

    // Pagination
    const total = activities.length;
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const paginatedActivities = activities.slice(startIndex, startIndex + parseInt(limit));

    res.json({
      success: true,
      data: {
        activities: paginatedActivities,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/sales/my-leaderboard
 * @desc    Get top performers in logged-in user's team
 * @access  Sales Team, Admin, Super Admin
 */
exports.getMyLeaderboard = async (req, res) => {
  try {
    // Use linkedUserId if available (for sub-admins linked to a user account)
    const myId = getEffectiveUserId(req.user);
    const { period = 'all', metric = 'revenue' } = req.query;

    // Calculate date range
    let startDate = null;
    const now = new Date();

    switch (period) {
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      default:
        startDate = null;
    }

    // Get L1 members only (leaderboard is for direct team)
    const l1Members = await User.find({ referredBy: myId })
      .select('name email profilePicture referralCode')
      .lean();

    const l1Ids = l1Members.map(m => m._id);

    // Get stats for each L1 member
    let leaderboardData = [];

    for (const member of l1Members) {
      // Get orders
      let orderQuery = { user: member._id };
      if (startDate) {
        orderQuery.createdAt = { $gte: startDate };
      }

      const orderStats = await InstallmentOrder.aggregate([
        { $match: orderQuery },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: '$totalPaidAmount' },
            commissionGenerated: { $sum: '$totalCommissionPaid' }
          }
        }
      ]);

      const stats = orderStats[0] || { totalOrders: 0, totalRevenue: 0, commissionGenerated: 0 };

      // Get referral count
      let referralQuery = { referredBy: member._id };
      if (startDate) {
        referralQuery.createdAt = { $gte: startDate };
      }
      const totalReferrals = await User.countDocuments(referralQuery);

      leaderboardData.push({
        user: {
          _id: member._id,
          name: member.name,
          email: member.email,
          profilePicture: member.profilePicture,
          referralCode: member.referralCode
        },
        metrics: {
          totalOrders: stats.totalOrders,
          totalRevenue: stats.totalRevenue,
          totalReferrals,
          commissionGenerated: stats.commissionGenerated
        }
      });
    }

    // Sort by selected metric
    const sortKey = metric === 'orders' ? 'totalOrders' :
                    metric === 'referrals' ? 'totalReferrals' :
                    metric === 'commission' ? 'commissionGenerated' : 'totalRevenue';

    leaderboardData.sort((a, b) => b.metrics[sortKey] - a.metrics[sortKey]);

    // Add rank
    leaderboardData = leaderboardData.map((item, index) => ({
      rank: index + 1,
      ...item
    }));

    // Limit to top 20
    const topPerformers = leaderboardData.slice(0, 20);

    res.json({
      success: true,
      data: {
        leaderboard: topPerformers,
        period,
        metric
      }
    });

  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/sales/my-trends
 * @desc    Get time-series data for charts (logged-in user's team)
 * @access  Sales Team, Admin, Super Admin
 */
exports.getMyTrends = async (req, res) => {
  try {
    // Use linkedUserId if available (for sub-admins linked to a user account)
    const myId = getEffectiveUserId(req.user);
    const { period = 'month', metric = 'orders' } = req.query;

    // Calculate date range and grouping
    let startDate = new Date();
    let groupByFormat;
    let labelFormat;

    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        groupByFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
        labelFormat = 'day';
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        groupByFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
        labelFormat = 'month';
        break;
      default: // month
        startDate.setMonth(startDate.getMonth() - 1);
        groupByFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
        labelFormat = 'day';
    }

    // Get all users in my chain
    const l1Members = await User.find({ referredBy: myId }).select('_id').lean();
    const l1Ids = l1Members.map(m => m._id);
    const l2Members = await User.find({ referredBy: { $in: l1Ids } }).select('_id').lean();
    const allUserIds = [...l1Ids, ...l2Members.map(m => m._id)];

    let trendData = [];
    let labels = [];
    let data = [];

    if (metric === 'signups') {
      // Signups trend
      trendData = await User.aggregate([
        { $match: { _id: { $in: allUserIds }, createdAt: { $gte: startDate } } },
        { $group: { _id: groupByFormat, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);
    } else if (metric === 'orders') {
      // Orders trend
      trendData = await InstallmentOrder.aggregate([
        { $match: { user: { $in: allUserIds }, createdAt: { $gte: startDate } } },
        { $group: { _id: groupByFormat, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);
    } else if (metric === 'revenue') {
      // Revenue trend
      trendData = await InstallmentOrder.aggregate([
        { $match: { user: { $in: allUserIds }, createdAt: { $gte: startDate } } },
        { $group: { _id: groupByFormat, count: { $sum: '$totalPaidAmount' } } },
        { $sort: { _id: 1 } }
      ]);
    } else if (metric === 'commission') {
      // Commission trend
      trendData = await InstallmentOrder.aggregate([
        { $match: { user: { $in: allUserIds }, createdAt: { $gte: startDate } } },
        { $group: { _id: groupByFormat, count: { $sum: '$totalCommissionPaid' } } },
        { $sort: { _id: 1 } }
      ]);
    }

    // Format labels and data
    labels = trendData.map(item => {
      if (labelFormat === 'day') {
        const date = new Date(item._id);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        const date = new Date(item._id + '-01');
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }
    });
    data = trendData.map(item => item.count);

    // Calculate summary
    const total = data.reduce((sum, val) => sum + val, 0);
    const average = data.length > 0 ? (total / data.length).toFixed(2) : 0;
    const highest = data.length > 0 ? Math.max(...data) : 0;
    const lowest = data.length > 0 ? Math.min(...data) : 0;

    res.json({
      success: true,
      data: {
        period,
        metric,
        labels,
        data,
        summary: {
          total,
          average: parseFloat(average),
          highest,
          lowest
        }
      }
    });

  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trends',
      error: error.message
    });
  }
};
