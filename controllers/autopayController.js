/**
 * Autopay Controller
 *
 * Handles all autopay-related API endpoints.
 * Uses existing code patterns and error handling.
 */

const autopayService = require("../services/autopayService");

// ============================================
// ENABLE/DISABLE AUTOPAY
// ============================================

/**
 * Enable autopay for a specific order
 * POST /api/installments/autopay/enable/:orderId
 */
exports.enableAutopay = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;
    const { priority } = req.body;

    const result = await autopayService.enableAutopayForOrder(orderId, userId, {
      priority: priority || 1,
    });

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.order,
    });
  } catch (error) {
    console.error("[Autopay Controller] Enable error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to enable autopay",
    });
  }
};

/**
 * Disable autopay for a specific order
 * POST /api/installments/autopay/disable/:orderId
 */
exports.disableAutopay = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    const result = await autopayService.disableAutopayForOrder(orderId, userId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.order,
    });
  } catch (error) {
    console.error("[Autopay Controller] Disable error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to disable autopay",
    });
  }
};

/**
 * Enable autopay for all orders
 * POST /api/installments/autopay/enable-all
 */
exports.enableAutopayForAll = async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await autopayService.enableAutopayForAllOrders(userId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error("[Autopay Controller] Enable all error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to enable autopay for all orders",
    });
  }
};

/**
 * Disable autopay for all orders
 * POST /api/installments/autopay/disable-all
 */
exports.disableAutopayForAll = async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await autopayService.disableAutopayForAllOrders(userId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error("[Autopay Controller] Disable all error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to disable autopay for all orders",
    });
  }
};

// ============================================
// PAUSE/RESUME/SKIP
// ============================================

/**
 * Pause autopay for an order
 * POST /api/installments/autopay/pause/:orderId
 */
exports.pauseAutopay = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;
    const { pauseUntil } = req.body;

    if (!pauseUntil) {
      return res.status(400).json({
        success: false,
        message: "pauseUntil date is required",
      });
    }

    const result = await autopayService.pauseAutopay(orderId, userId, pauseUntil);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.order,
    });
  } catch (error) {
    console.error("[Autopay Controller] Pause error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to pause autopay",
    });
  }
};

/**
 * Resume autopay for an order
 * POST /api/installments/autopay/resume/:orderId
 */
exports.resumeAutopay = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    const result = await autopayService.resumeAutopay(orderId, userId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.order,
    });
  } catch (error) {
    console.error("[Autopay Controller] Resume error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to resume autopay",
    });
  }
};

/**
 * Add skip dates for autopay
 * POST /api/installments/autopay/skip-dates/:orderId
 */
exports.addSkipDates = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;
    const { dates } = req.body;

    if (!dates || !Array.isArray(dates)) {
      return res.status(400).json({
        success: false,
        message: "dates array is required",
      });
    }

    const result = await autopayService.addSkipDates(orderId, userId, dates);

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        skipDates: result.skipDates,
      },
    });
  } catch (error) {
    console.error("[Autopay Controller] Add skip dates error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to add skip dates",
    });
  }
};

/**
 * Remove a skip date
 * DELETE /api/installments/autopay/skip-dates/:orderId
 */
exports.removeSkipDate = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "date is required",
      });
    }

    const result = await autopayService.removeSkipDate(orderId, userId, date);

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        skipDates: result.skipDates,
      },
    });
  } catch (error) {
    console.error("[Autopay Controller] Remove skip date error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to remove skip date",
    });
  }
};

// ============================================
// SETTINGS
// ============================================

/**
 * Update autopay settings
 * PUT /api/installments/autopay/settings
 */
exports.updateSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    const settings = req.body;

    const result = await autopayService.updateAutopaySettings(userId, settings);

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        settings: result.settings,
      },
    });
  } catch (error) {
    console.error("[Autopay Controller] Update settings error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to update settings",
    });
  }
};

/**
 * Get autopay settings
 * GET /api/installments/autopay/settings
 */
exports.getSettings = async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await autopayService.getAutopaySettings(userId);

    res.status(200).json({
      success: true,
      data: {
        settings: result.settings,
        notificationPreferences: result.notificationPreferences,
      },
    });
  } catch (error) {
    console.error("[Autopay Controller] Get settings error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to get settings",
    });
  }
};

/**
 * Get autopay status for all orders
 * GET /api/installments/autopay/status
 */
exports.getStatus = async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await autopayService.getAutopayStatus(userId);

    res.status(200).json({
      success: true,
      data: {
        totalOrders: result.totalOrders,
        autopayEnabled: result.autopayEnabled,
        totalDailyAmount: result.totalDailyAmount,
        orders: result.orders,
      },
    });
  } catch (error) {
    console.error("[Autopay Controller] Get status error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to get autopay status",
    });
  }
};

/**
 * Set autopay priority for an order
 * PUT /api/installments/autopay/priority/:orderId
 */
exports.setPriority = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;
    const { priority } = req.body;

    if (priority === undefined) {
      return res.status(400).json({
        success: false,
        message: "priority is required",
      });
    }

    const result = await autopayService.setAutopayPriority(orderId, userId, priority);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.order,
    });
  } catch (error) {
    console.error("[Autopay Controller] Set priority error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to set priority",
    });
  }
};

// ============================================
// DASHBOARD & FORECAST
// ============================================

/**
 * Get autopay dashboard
 * GET /api/installments/autopay/dashboard
 */
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await autopayService.getAutopayDashboard(userId);

    res.status(200).json({
      success: true,
      data: result.dashboard,
    });
  } catch (error) {
    console.error("[Autopay Controller] Get dashboard error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to get dashboard",
    });
  }
};

/**
 * Get balance forecast
 * GET /api/installments/autopay/forecast
 */
exports.getForecast = async (req, res) => {
  try {
    const userId = req.user._id;
    const { days } = req.query;

    const forecastDays = Math.min(Math.max(parseInt(days) || 30, 1), 90);

    const result = await autopayService.getBalanceForecast(userId, forecastDays);

    res.status(200).json({
      success: true,
      data: result.forecast,
    });
  } catch (error) {
    console.error("[Autopay Controller] Get forecast error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to get forecast",
    });
  }
};

/**
 * Get autopay history
 * GET /api/installments/autopay/history
 */
exports.getHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page, limit } = req.query;

    const result = await autopayService.getAutopayHistory(userId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });

    res.status(200).json({
      success: true,
      data: {
        history: result.history,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    console.error("[Autopay Controller] Get history error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to get history",
    });
  }
};

// ============================================
// STREAK
// ============================================

/**
 * Get streak information
 * GET /api/installments/autopay/streak
 */
exports.getStreak = async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await autopayService.getStreakInfo(userId);

    res.status(200).json({
      success: true,
      data: result.streak,
    });
  } catch (error) {
    console.error("[Autopay Controller] Get streak error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to get streak info",
    });
  }
};

// ============================================
// SUGGESTED TOP-UP
// ============================================

/**
 * Get suggested top-up amount
 * GET /api/installments/autopay/suggested-topup
 */
exports.getSuggestedTopup = async (req, res) => {
  try {
    const userId = req.user._id;
    const { days } = req.query;

    const result = await autopayService.getAutopayDashboard(userId);

    const targetDays = parseInt(days) || 7;
    const dailyDeduction = result.dashboard.autopay.totalDailyDeduction;
    const currentBalance = result.dashboard.wallet.balance;
    const minimumLock = result.dashboard.wallet.minimumLock;

    const targetBalance = dailyDeduction * targetDays + minimumLock;
    const suggestedTopup = Math.max(0, targetBalance - currentBalance);

    res.status(200).json({
      success: true,
      data: {
        currentBalance,
        minimumLock,
        dailyDeduction,
        targetDays,
        targetBalance,
        suggestedTopup,
        suggestions: {
          for7Days: dailyDeduction * 7 - (currentBalance - minimumLock),
          for14Days: dailyDeduction * 14 - (currentBalance - minimumLock),
          for30Days: dailyDeduction * 30 - (currentBalance - minimumLock),
        },
      },
    });
  } catch (error) {
    console.error("[Autopay Controller] Get suggested topup error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to get suggested topup",
    });
  }
};

// ============================================
// NOTIFICATION PREFERENCES
// ============================================

/**
 * Update autopay notification preferences
 * PUT /api/installments/autopay/notification-preferences
 */
exports.updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user._id;
    const { autopaySuccess, autopayFailed, lowBalanceAlert, dailyReminder } = req.body;

    const User = require("../models/User");

    const updateObj = {};
    if (autopaySuccess !== undefined) {
      updateObj["notificationPreferences.autopaySuccess"] = autopaySuccess;
    }
    if (autopayFailed !== undefined) {
      updateObj["notificationPreferences.autopayFailed"] = autopayFailed;
    }
    if (lowBalanceAlert !== undefined) {
      updateObj["notificationPreferences.lowBalanceAlert"] = lowBalanceAlert;
    }
    if (dailyReminder !== undefined) {
      updateObj["notificationPreferences.dailyReminder"] = dailyReminder;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateObj },
      { new: true }
    ).select("notificationPreferences");

    res.status(200).json({
      success: true,
      message: "Notification preferences updated",
      data: {
        autopaySuccess: user.notificationPreferences?.autopaySuccess !== false,
        autopayFailed: user.notificationPreferences?.autopayFailed !== false,
        lowBalanceAlert: user.notificationPreferences?.lowBalanceAlert !== false,
        dailyReminder: user.notificationPreferences?.dailyReminder !== false,
      },
    });
  } catch (error) {
    console.error("[Autopay Controller] Update notification preferences error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to update notification preferences",
    });
  }
};
