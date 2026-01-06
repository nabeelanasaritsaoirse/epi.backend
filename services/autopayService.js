/**
 * Autopay Service
 *
 * Handles all autopay-related business logic including:
 * - Enable/disable autopay for orders
 * - Pause/resume autopay
 * - Skip dates management
 * - Settings management
 * - Dashboard data
 * - Balance forecast
 * - Streak tracking
 *
 * IMPORTANT: This service does NOT modify existing payment flow.
 * It uses the existing installmentPaymentService for actual payment processing.
 */

const mongoose = require("mongoose");
const InstallmentOrder = require("../models/InstallmentOrder");
const PaymentRecord = require("../models/PaymentRecord");
const User = require("../models/User");
const { deductFromWallet } = require("./installmentWalletService");
const { sendPushNotification } = require("./fcmService");
const {
  generateIdempotencyKey,
  isOrderFullyPaid,
  calculateCommission,
} = require("../utils/installmentHelpers");
const { creditCommissionToWallet } = require("./installmentWalletService");
const StreakConfig = require("../models/StreakConfig");

/**
 * Build query to find order by ID (handles both ObjectId and string orderId)
 * @param {string} orderId - Order ID (can be ObjectId or orderId string)
 * @param {string} userId - User ID
 * @returns {Object} MongoDB query object
 */
function buildOrderQuery(orderId, userId) {
  const query = { user: userId };

  // Check if it's a valid 24-character hex string (ObjectId format)
  if (mongoose.Types.ObjectId.isValid(orderId) && String(orderId).match(/^[0-9a-fA-F]{24}$/)) {
    query.$or = [{ _id: orderId }, { orderId }];
  } else {
    query.orderId = orderId;
  }

  return query;
}

/**
 * Enable autopay for a specific order
 *
 * @param {string} orderId - Order ID
 * @param {string} userId - User ID
 * @param {Object} options - Optional settings
 * @returns {Promise<Object>} Updated order
 */
async function enableAutopayForOrder(orderId, userId, options = {}) {
  try {
    const order = await InstallmentOrder.findOne(buildOrderQuery(orderId, userId));

    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status !== "ACTIVE") {
      throw new Error("Autopay can only be enabled for active orders");
    }

    if (order.isFullyPaid()) {
      throw new Error("Order is already fully paid");
    }

    // Initialize autopay object if not exists
    if (!order.autopay) {
      order.autopay = {};
    }

    order.autopay.enabled = true;
    order.autopay.enabledAt = new Date();
    order.autopay.priority = options.priority || 1;
    order.autopay.pausedUntil = null;

    await order.save();

    console.log(`[Autopay] Enabled for order ${order.orderId} by user ${userId}`);

    return {
      success: true,
      message: "Autopay enabled successfully",
      order: {
        orderId: order.orderId,
        productName: order.productName,
        autopay: order.autopay,
      },
    };
  } catch (error) {
    console.error("[Autopay] Error enabling autopay:", error);
    throw error;
  }
}

/**
 * Disable autopay for a specific order
 *
 * @param {string} orderId - Order ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated order
 */
async function disableAutopayForOrder(orderId, userId) {
  try {
    const order = await InstallmentOrder.findOne(buildOrderQuery(orderId, userId));

    if (!order) {
      throw new Error("Order not found");
    }

    if (!order.autopay) {
      order.autopay = {};
    }

    order.autopay.enabled = false;

    await order.save();

    console.log(`[Autopay] Disabled for order ${order.orderId} by user ${userId}`);

    return {
      success: true,
      message: "Autopay disabled successfully",
      order: {
        orderId: order.orderId,
        productName: order.productName,
        autopay: order.autopay,
      },
    };
  } catch (error) {
    console.error("[Autopay] Error disabling autopay:", error);
    throw error;
  }
}

/**
 * Enable autopay for all active orders of a user
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Result with updated orders count
 */
async function enableAutopayForAllOrders(userId) {
  try {
    const result = await InstallmentOrder.updateMany(
      {
        user: userId,
        status: "ACTIVE",
      },
      {
        $set: {
          "autopay.enabled": true,
          "autopay.enabledAt": new Date(),
        },
      }
    );

    // Also enable global autopay setting
    await User.findByIdAndUpdate(userId, {
      $set: { "autopaySettings.enabled": true },
    });

    console.log(`[Autopay] Enabled for all orders of user ${userId}: ${result.modifiedCount} orders`);

    return {
      success: true,
      message: `Autopay enabled for ${result.modifiedCount} orders`,
      modifiedCount: result.modifiedCount,
    };
  } catch (error) {
    console.error("[Autopay] Error enabling autopay for all:", error);
    throw error;
  }
}

/**
 * Disable autopay for all orders of a user
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Result with updated orders count
 */
async function disableAutopayForAllOrders(userId) {
  try {
    const result = await InstallmentOrder.updateMany(
      { user: userId },
      { $set: { "autopay.enabled": false } }
    );

    // Also disable global autopay setting
    await User.findByIdAndUpdate(userId, {
      $set: { "autopaySettings.enabled": false },
    });

    console.log(`[Autopay] Disabled for all orders of user ${userId}: ${result.modifiedCount} orders`);

    return {
      success: true,
      message: `Autopay disabled for ${result.modifiedCount} orders`,
      modifiedCount: result.modifiedCount,
    };
  } catch (error) {
    console.error("[Autopay] Error disabling autopay for all:", error);
    throw error;
  }
}

/**
 * Pause autopay for an order until a specific date
 *
 * @param {string} orderId - Order ID
 * @param {string} userId - User ID
 * @param {Date} pauseUntil - Date to pause until
 * @returns {Promise<Object>} Updated order
 */
async function pauseAutopay(orderId, userId, pauseUntil) {
  try {
    const order = await InstallmentOrder.findOne(buildOrderQuery(orderId, userId));

    if (!order) {
      throw new Error("Order not found");
    }

    const pauseDate = new Date(pauseUntil);
    if (pauseDate <= new Date()) {
      throw new Error("Pause date must be in the future");
    }

    // Maximum pause period: 30 days
    const maxPause = new Date();
    maxPause.setDate(maxPause.getDate() + 30);
    if (pauseDate > maxPause) {
      throw new Error("Maximum pause period is 30 days");
    }

    if (!order.autopay) {
      order.autopay = {};
    }

    order.autopay.pausedUntil = pauseDate;

    await order.save();

    console.log(`[Autopay] Paused for order ${order.orderId} until ${pauseDate.toISOString()}`);

    return {
      success: true,
      message: `Autopay paused until ${pauseDate.toLocaleDateString()}`,
      order: {
        orderId: order.orderId,
        productName: order.productName,
        autopay: order.autopay,
      },
    };
  } catch (error) {
    console.error("[Autopay] Error pausing autopay:", error);
    throw error;
  }
}

/**
 * Resume autopay for an order (remove pause)
 *
 * @param {string} orderId - Order ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated order
 */
async function resumeAutopay(orderId, userId) {
  try {
    const order = await InstallmentOrder.findOne(buildOrderQuery(orderId, userId));

    if (!order) {
      throw new Error("Order not found");
    }

    if (!order.autopay) {
      order.autopay = {};
    }

    order.autopay.pausedUntil = null;

    await order.save();

    console.log(`[Autopay] Resumed for order ${order.orderId}`);

    return {
      success: true,
      message: "Autopay resumed successfully",
      order: {
        orderId: order.orderId,
        productName: order.productName,
        autopay: order.autopay,
      },
    };
  } catch (error) {
    console.error("[Autopay] Error resuming autopay:", error);
    throw error;
  }
}

/**
 * Add skip dates for autopay
 *
 * @param {string} orderId - Order ID
 * @param {string} userId - User ID
 * @param {Array<Date>} dates - Dates to skip
 * @returns {Promise<Object>} Updated order
 */
async function addSkipDates(orderId, userId, dates) {
  try {
    const order = await InstallmentOrder.findOne(buildOrderQuery(orderId, userId));

    if (!order) {
      throw new Error("Order not found");
    }

    if (!Array.isArray(dates) || dates.length === 0) {
      throw new Error("At least one date must be provided");
    }

    // Maximum 10 skip dates
    if (dates.length > 10) {
      throw new Error("Maximum 10 skip dates allowed");
    }

    if (!order.autopay) {
      order.autopay = { skipDates: [] };
    }
    if (!order.autopay.skipDates) {
      order.autopay.skipDates = [];
    }

    // Add new dates (avoid duplicates)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const dateStr of dates) {
      const date = new Date(dateStr);
      date.setHours(0, 0, 0, 0);

      // Only allow future dates
      if (date <= today) {
        continue;
      }

      // Check if already exists
      const exists = order.autopay.skipDates.some((d) => {
        const existing = new Date(d);
        existing.setHours(0, 0, 0, 0);
        return existing.getTime() === date.getTime();
      });

      if (!exists && order.autopay.skipDates.length < 10) {
        order.autopay.skipDates.push(date);
      }
    }

    await order.save();

    console.log(`[Autopay] Added skip dates for order ${order.orderId}: ${dates.length} dates`);

    return {
      success: true,
      message: `Skip dates updated`,
      skipDates: order.autopay.skipDates,
    };
  } catch (error) {
    console.error("[Autopay] Error adding skip dates:", error);
    throw error;
  }
}

/**
 * Remove a skip date
 *
 * @param {string} orderId - Order ID
 * @param {string} userId - User ID
 * @param {Date} date - Date to remove
 * @returns {Promise<Object>} Updated order
 */
async function removeSkipDate(orderId, userId, date) {
  try {
    const order = await InstallmentOrder.findOne(buildOrderQuery(orderId, userId));

    if (!order) {
      throw new Error("Order not found");
    }

    if (!order.autopay?.skipDates?.length) {
      return {
        success: true,
        message: "No skip dates to remove",
        skipDates: [],
      };
    }

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    order.autopay.skipDates = order.autopay.skipDates.filter((d) => {
      const existing = new Date(d);
      existing.setHours(0, 0, 0, 0);
      return existing.getTime() !== targetDate.getTime();
    });

    await order.save();

    console.log(`[Autopay] Removed skip date for order ${order.orderId}`);

    return {
      success: true,
      message: "Skip date removed",
      skipDates: order.autopay.skipDates,
    };
  } catch (error) {
    console.error("[Autopay] Error removing skip date:", error);
    throw error;
  }
}

/**
 * Update user's global autopay settings
 *
 * @param {string} userId - User ID
 * @param {Object} settings - Settings to update
 * @returns {Promise<Object>} Updated settings
 */
async function updateAutopaySettings(userId, settings) {
  try {
    const updateObj = {};

    if (settings.enabled !== undefined) {
      updateObj["autopaySettings.enabled"] = settings.enabled;
    }
    if (settings.timePreference) {
      const validTimes = ["MORNING_6AM", "AFTERNOON_12PM", "EVENING_6PM"];
      if (!validTimes.includes(settings.timePreference)) {
        throw new Error("Invalid time preference");
      }
      updateObj["autopaySettings.timePreference"] = settings.timePreference;
    }
    if (settings.minimumBalanceLock !== undefined) {
      if (settings.minimumBalanceLock < 0) {
        throw new Error("Minimum balance lock cannot be negative");
      }
      updateObj["autopaySettings.minimumBalanceLock"] = settings.minimumBalanceLock;
    }
    if (settings.lowBalanceThreshold !== undefined) {
      if (settings.lowBalanceThreshold < 0) {
        throw new Error("Low balance threshold cannot be negative");
      }
      updateObj["autopaySettings.lowBalanceThreshold"] = settings.lowBalanceThreshold;
    }
    if (settings.sendDailyReminder !== undefined) {
      updateObj["autopaySettings.sendDailyReminder"] = settings.sendDailyReminder;
    }
    if (settings.reminderHoursBefore !== undefined) {
      if (settings.reminderHoursBefore < 1 || settings.reminderHoursBefore > 12) {
        throw new Error("Reminder hours must be between 1 and 12");
      }
      updateObj["autopaySettings.reminderHoursBefore"] = settings.reminderHoursBefore;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateObj },
      { new: true }
    ).select("autopaySettings");

    console.log(`[Autopay] Settings updated for user ${userId}`);

    return {
      success: true,
      message: "Settings updated successfully",
      settings: user.autopaySettings,
    };
  } catch (error) {
    console.error("[Autopay] Error updating settings:", error);
    throw error;
  }
}

/**
 * Get user's autopay settings
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Autopay settings
 */
async function getAutopaySettings(userId) {
  try {
    const user = await User.findById(userId).select("autopaySettings notificationPreferences");

    if (!user) {
      throw new Error("User not found");
    }

    return {
      success: true,
      settings: user.autopaySettings || {
        enabled: false,
        timePreference: "MORNING_6AM",
        minimumBalanceLock: 0,
        lowBalanceThreshold: 500,
        sendDailyReminder: true,
        reminderHoursBefore: 1,
      },
      notificationPreferences: {
        autopaySuccess: user.notificationPreferences?.autopaySuccess !== false,
        autopayFailed: user.notificationPreferences?.autopayFailed !== false,
        lowBalanceAlert: user.notificationPreferences?.lowBalanceAlert !== false,
        dailyReminder: user.notificationPreferences?.dailyReminder !== false,
      },
    };
  } catch (error) {
    console.error("[Autopay] Error getting settings:", error);
    throw error;
  }
}

/**
 * Get autopay status for all user's orders
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Orders with autopay status
 */
async function getAutopayStatus(userId) {
  try {
    const orders = await InstallmentOrder.find({
      user: userId,
      status: "ACTIVE",
    })
      .select(
        "orderId productName dailyPaymentAmount remainingAmount autopay status paidInstallments totalDays"
      )
      .sort({ "autopay.priority": 1, createdAt: -1 });

    const orderStatuses = orders.map((order) => ({
      orderId: order.orderId,
      productName: order.productName,
      dailyAmount: order.dailyPaymentAmount,
      remainingAmount: order.remainingAmount,
      progress: Math.round((order.paidInstallments / order.totalDays) * 100),
      autopay: {
        enabled: order.autopay?.enabled || false,
        priority: order.autopay?.priority || 1,
        pausedUntil: order.autopay?.pausedUntil || null,
        skipDates: order.autopay?.skipDates || [],
        isActive: order.isAutopayActive ? order.isAutopayActive() : false,
        lastAttempt: order.autopay?.lastAttempt || null,
        successCount: order.autopay?.successCount || 0,
        failedCount: order.autopay?.failedCount || 0,
      },
    }));

    const enabledCount = orderStatuses.filter((o) => o.autopay.enabled).length;
    const totalDailyAmount = orderStatuses
      .filter((o) => o.autopay.enabled)
      .reduce((sum, o) => sum + o.dailyAmount, 0);

    return {
      success: true,
      totalOrders: orders.length,
      autopayEnabled: enabledCount,
      totalDailyAmount,
      orders: orderStatuses,
    };
  } catch (error) {
    console.error("[Autopay] Error getting status:", error);
    throw error;
  }
}

/**
 * Set autopay priority for an order
 *
 * @param {string} orderId - Order ID
 * @param {string} userId - User ID
 * @param {number} priority - Priority (1-100, lower = higher priority)
 * @returns {Promise<Object>} Updated order
 */
async function setAutopayPriority(orderId, userId, priority) {
  try {
    if (priority < 1 || priority > 100) {
      throw new Error("Priority must be between 1 and 100");
    }

    const order = await InstallmentOrder.findOneAndUpdate(
      buildOrderQuery(orderId, userId),
      { $set: { "autopay.priority": priority } },
      { new: true }
    );

    if (!order) {
      throw new Error("Order not found");
    }

    console.log(`[Autopay] Priority set to ${priority} for order ${order.orderId}`);

    return {
      success: true,
      message: `Priority set to ${priority}`,
      order: {
        orderId: order.orderId,
        autopay: order.autopay,
      },
    };
  } catch (error) {
    console.error("[Autopay] Error setting priority:", error);
    throw error;
  }
}

/**
 * Get autopay dashboard data for user
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Dashboard data
 */
async function getAutopayDashboard(userId) {
  try {
    // Get user with wallet and streak info
    const user = await User.findById(userId).select(
      "wallet autopaySettings paymentStreak"
    );

    if (!user) {
      throw new Error("User not found");
    }

    // Get active orders with autopay
    const orders = await InstallmentOrder.find({
      user: userId,
      status: "ACTIVE",
    })
      .select(
        "orderId productName dailyPaymentAmount remainingAmount autopay paidInstallments totalDays"
      )
      .sort({ "autopay.priority": 1 });

    // Calculate daily deduction
    const autopayOrders = orders.filter((o) => o.autopay?.enabled);
    const totalDailyDeduction = autopayOrders.reduce(
      (sum, o) => sum + o.dailyPaymentAmount,
      0
    );

    // Calculate balance forecast
    const walletBalance = user.wallet?.balance || 0;
    const minimumLock = user.autopaySettings?.minimumBalanceLock || 0;
    const availableForAutopay = Math.max(0, walletBalance - minimumLock);

    let daysBalanceLasts = 0;
    if (totalDailyDeduction > 0) {
      daysBalanceLasts = Math.floor(availableForAutopay / totalDailyDeduction);
    }

    // Get next payment time based on preference
    const timePreference = user.autopaySettings?.timePreference || "MORNING_6AM";
    const nextPaymentTime = getNextPaymentTime(timePreference);

    // Calculate this month's payments
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    const monthlyPayments = await PaymentRecord.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          status: "COMPLETED",
          completedAt: { $gte: thisMonthStart },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const thisMonthPaid = monthlyPayments[0]?.totalAmount || 0;
    const thisMonthPaymentsCount = monthlyPayments[0]?.count || 0;

    // Streak info
    const streak = user.paymentStreak || { current: 0, longest: 0 };

    // Low balance warning
    const lowBalanceThreshold = user.autopaySettings?.lowBalanceThreshold || 500;
    const isLowBalance = availableForAutopay < lowBalanceThreshold;

    // Suggested top-up amount
    let suggestedTopUp = 0;
    if (totalDailyDeduction > 0) {
      // Suggest enough for 7 days
      const targetDays = 7;
      const targetBalance = totalDailyDeduction * targetDays + minimumLock;
      suggestedTopUp = Math.max(0, targetBalance - walletBalance);
    }

    return {
      success: true,
      dashboard: {
        wallet: {
          balance: walletBalance,
          minimumLock,
          availableForAutopay,
          isLowBalance,
          lowBalanceThreshold,
        },
        autopay: {
          enabled: user.autopaySettings?.enabled || false,
          totalOrders: orders.length,
          autopayEnabledOrders: autopayOrders.length,
          totalDailyDeduction,
          daysBalanceLasts,
          nextPaymentTime: nextPaymentTime.toISOString(),
          timePreference,
        },
        stats: {
          thisMonthPaid,
          thisMonthPaymentsCount,
        },
        streak: {
          current: streak.current,
          longest: streak.longest,
          lastPaymentDate: streak.lastPaymentDate,
          nextMilestone: getNextStreakMilestone(streak.current),
        },
        suggestions: {
          suggestedTopUp,
          topUpFor7Days: totalDailyDeduction * 7,
          topUpFor30Days: totalDailyDeduction * 30,
        },
        orders: orders.map((o) => ({
          orderId: o.orderId,
          productName: o.productName,
          dailyAmount: o.dailyPaymentAmount,
          remainingAmount: o.remainingAmount,
          progress: Math.round((o.paidInstallments / o.totalDays) * 100),
          autopayEnabled: o.autopay?.enabled || false,
          priority: o.autopay?.priority || 1,
        })),
      },
    };
  } catch (error) {
    console.error("[Autopay] Error getting dashboard:", error);
    throw error;
  }
}

/**
 * Get balance forecast for user
 *
 * @param {string} userId - User ID
 * @param {number} days - Number of days to forecast (default 30)
 * @returns {Promise<Object>} Forecast data
 */
async function getBalanceForecast(userId, days = 30) {
  try {
    const user = await User.findById(userId).select("wallet autopaySettings");

    if (!user) {
      throw new Error("User not found");
    }

    const orders = await InstallmentOrder.find({
      user: userId,
      status: "ACTIVE",
      "autopay.enabled": true,
    }).select("orderId productName dailyPaymentAmount remainingAmount paymentSchedule autopay");

    const walletBalance = user.wallet?.balance || 0;
    const minimumLock = user.autopaySettings?.minimumBalanceLock || 0;

    // Generate day-by-day forecast
    const forecast = [];
    let runningBalance = walletBalance;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < days; i++) {
      const forecastDate = new Date(today);
      forecastDate.setDate(forecastDate.getDate() + i);

      let dailyDeduction = 0;
      const paymentsToday = [];

      for (const order of orders) {
        // Check if this order has a payment due on this date
        const hasPending = order.paymentSchedule.some((inst) => {
          if (inst.status !== "PENDING") return false;
          const dueDate = new Date(inst.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate.getTime() === forecastDate.getTime();
        });

        if (hasPending) {
          // Check if it's a skip date
          const isSkip = order.autopay?.skipDates?.some((d) => {
            const skip = new Date(d);
            skip.setHours(0, 0, 0, 0);
            return skip.getTime() === forecastDate.getTime();
          });

          if (!isSkip) {
            dailyDeduction += order.dailyPaymentAmount;
            paymentsToday.push({
              orderId: order.orderId,
              productName: order.productName,
              amount: order.dailyPaymentAmount,
            });
          }
        }
      }

      // Check if balance is sufficient
      const availableBalance = Math.max(0, runningBalance - minimumLock);
      const canPay = availableBalance >= dailyDeduction;

      if (canPay && dailyDeduction > 0) {
        runningBalance -= dailyDeduction;
      }

      forecast.push({
        date: forecastDate.toISOString().split("T")[0],
        dayNumber: i + 1,
        startBalance: runningBalance + (canPay ? dailyDeduction : 0),
        deduction: canPay ? dailyDeduction : 0,
        endBalance: runningBalance,
        payments: paymentsToday,
        insufficientFunds: !canPay && dailyDeduction > 0,
        shortfall: canPay ? 0 : dailyDeduction - availableBalance,
      });
    }

    // Find when balance runs out
    const insufficientDay = forecast.find((f) => f.insufficientFunds);
    const daysUntilInsufficient = insufficientDay
      ? forecast.indexOf(insufficientDay) + 1
      : null;

    return {
      success: true,
      forecast: {
        currentBalance: walletBalance,
        minimumLock,
        availableForAutopay: Math.max(0, walletBalance - minimumLock),
        totalOrders: orders.length,
        daysForecasted: days,
        daysUntilInsufficient,
        dailyForecast: forecast,
        summary: {
          totalExpectedDeduction: forecast.reduce((sum, f) => sum + f.deduction, 0),
          totalPayments: forecast.reduce((sum, f) => sum + f.payments.length, 0),
          daysWithInsufficientFunds: forecast.filter((f) => f.insufficientFunds).length,
        },
      },
    };
  } catch (error) {
    console.error("[Autopay] Error getting forecast:", error);
    throw error;
  }
}

/**
 * Get autopay history for user
 *
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Autopay history
 */
async function getAutopayHistory(userId, options = {}) {
  try {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    // Get all orders with autopay history
    const orders = await InstallmentOrder.find({
      user: userId,
      "autopay.history.0": { $exists: true },
    }).select("orderId productName autopay.history");

    // Flatten and sort all history entries
    let allHistory = [];
    for (const order of orders) {
      if (order.autopay?.history) {
        for (const entry of order.autopay.history) {
          allHistory.push({
            orderId: order.orderId,
            productName: order.productName,
            ...entry.toObject(),
          });
        }
      }
    }

    // Sort by date descending
    allHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Paginate
    const total = allHistory.length;
    const paginatedHistory = allHistory.slice(skip, skip + limit);

    return {
      success: true,
      history: paginatedHistory,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[Autopay] Error getting history:", error);
    throw error;
  }
}

/**
 * Process autopay payment for a single order
 * Called by the cron job
 *
 * @param {Object} order - InstallmentOrder document
 * @param {Object} user - User document
 * @returns {Promise<Object>} Payment result
 */
async function processAutopayPayment(order, user) {
  try {
    // Double-check order can process autopay
    if (!order.canProcessAutopay()) {
      return {
        success: false,
        status: "SKIPPED",
        reason: "Order cannot process autopay today",
      };
    }

    const nextInstallment = order.getNextPayableInstallment();
    if (!nextInstallment) {
      return {
        success: false,
        status: "SKIPPED",
        reason: "No pending installments",
      };
    }

    const paymentAmount = order.dailyPaymentAmount;
    const minimumLock = user.autopaySettings?.minimumBalanceLock || 0;
    const availableBalance = Math.max(0, (user.wallet?.balance || 0) - minimumLock);

    // Check if sufficient balance
    if (availableBalance < paymentAmount) {
      // Update autopay attempt info
      order.autopay.lastAttempt = {
        date: new Date(),
        status: "INSUFFICIENT_BALANCE",
        errorMessage: `Insufficient balance. Required: ${paymentAmount}, Available: ${availableBalance}`,
      };
      order.autopay.failedCount = (order.autopay.failedCount || 0) + 1;
      order.addAutopayHistory({
        status: "INSUFFICIENT_BALANCE",
        amount: paymentAmount,
        errorMessage: `Balance: ${availableBalance}, Required: ${paymentAmount}`,
      });
      await order.save();

      return {
        success: false,
        status: "INSUFFICIENT_BALANCE",
        reason: `Insufficient balance. Required: ${paymentAmount}, Available: ${availableBalance}`,
        order: order.orderId,
      };
    }

    // Generate idempotency key
    const idempotencyKey = generateIdempotencyKey(
      order._id.toString(),
      user._id.toString(),
      nextInstallment.installmentNumber
    );

    // Check for existing payment
    const existingPayment = await PaymentRecord.findOne({ idempotencyKey });
    if (existingPayment && existingPayment.status === "COMPLETED") {
      return {
        success: false,
        status: "SKIPPED",
        reason: "Payment already processed",
      };
    }

    // Process wallet deduction
    const walletDeduction = await deductFromWallet(
      user._id,
      paymentAmount,
      `Autopay: Installment ${nextInstallment.installmentNumber} for ${order.productName}`,
      null,
      {
        orderId: order._id,
        installmentNumber: nextInstallment.installmentNumber,
        isAutopay: true,
      }
    );

    // Create payment record
    const payment = new PaymentRecord({
      order: order._id,
      user: user._id,
      amount: paymentAmount,
      installmentNumber: nextInstallment.installmentNumber,
      paymentMethod: "WALLET",
      walletTransactionId: walletDeduction.walletTransaction._id,
      status: "COMPLETED",
      idempotencyKey,
      processedAt: new Date(),
      completedAt: new Date(),
      adminNote: "Autopay",
    });

    await payment.save();

    // Update order
    order.paidInstallments += 1;
    order.totalPaidAmount += paymentAmount;
    order.remainingAmount = Math.max(0, order.productPrice - order.totalPaidAmount);
    order.lastPaymentDate = new Date();

    // Update payment schedule
    const scheduleIndex = order.paymentSchedule.findIndex(
      (item) => item.installmentNumber === nextInstallment.installmentNumber
    );
    if (scheduleIndex !== -1) {
      order.paymentSchedule[scheduleIndex].status = "PAID";
      order.paymentSchedule[scheduleIndex].paidDate = new Date();
      order.paymentSchedule[scheduleIndex].paymentId = payment._id;
    }

    // Check if order is completed
    if (isOrderFullyPaid(order.productPrice, order.totalPaidAmount)) {
      order.status = "COMPLETED";
      order.completedAt = new Date();
    }

    // Update autopay info
    order.autopay.lastAttempt = {
      date: new Date(),
      status: "SUCCESS",
      errorMessage: null,
    };
    order.autopay.successCount = (order.autopay.successCount || 0) + 1;
    order.addAutopayHistory({
      status: "SUCCESS",
      amount: paymentAmount,
      paymentId: payment._id,
    });

    await order.save();

    // Process commission if referrer exists
    if (order.referrer) {
      try {
        const commissionPercentage = order.productCommissionPercentage || 10;
        const commissionAmount = calculateCommission(paymentAmount, commissionPercentage);

        await creditCommissionToWallet(
          order.referrer,
          commissionAmount,
          order._id.toString(),
          payment._id.toString(),
          null
        );

        payment.commissionCalculated = true;
        payment.commissionAmount = commissionAmount;
        payment.commissionCreditedToReferrer = true;
        await payment.save();
      } catch (commError) {
        console.error("[Autopay] Commission credit failed:", commError);
      }
    }

    console.log(`[Autopay] Payment successful for order ${order.orderId}: ${paymentAmount}`);

    return {
      success: true,
      status: "SUCCESS",
      order: order.orderId,
      amount: paymentAmount,
      installmentNumber: nextInstallment.installmentNumber,
      paymentId: payment._id,
      newBalance: walletDeduction.newBalance,
    };
  } catch (error) {
    console.error(`[Autopay] Payment failed for order ${order.orderId}:`, error);

    // Update order with failure info
    try {
      order.autopay.lastAttempt = {
        date: new Date(),
        status: "FAILED",
        errorMessage: error.message,
      };
      order.autopay.failedCount = (order.autopay.failedCount || 0) + 1;
      order.addAutopayHistory({
        status: "FAILED",
        amount: order.dailyPaymentAmount,
        errorMessage: error.message,
      });
      await order.save();
    } catch (saveError) {
      console.error("[Autopay] Failed to save error state:", saveError);
    }

    return {
      success: false,
      status: "FAILED",
      reason: error.message,
      order: order.orderId,
    };
  }
}

/**
 * Update user's payment streak
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated streak info
 */
async function updatePaymentStreak(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastPayment = user.paymentStreak?.lastPaymentDate
      ? new Date(user.paymentStreak.lastPaymentDate)
      : null;

    if (!user.paymentStreak) {
      user.paymentStreak = {
        current: 0,
        longest: 0,
        lastPaymentDate: null,
        totalRewardsEarned: 0,
        milestonesAchieved: [],
      };
    }

    if (lastPayment) {
      lastPayment.setHours(0, 0, 0, 0);

      const diffDays = Math.floor((today - lastPayment) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        // Same day, streak already counted
        return { success: true, streak: user.paymentStreak };
      } else if (diffDays === 1) {
        // Consecutive day, increment streak
        user.paymentStreak.current += 1;
      } else {
        // Streak broken, reset to 1
        user.paymentStreak.current = 1;
      }
    } else {
      // First payment ever
      user.paymentStreak.current = 1;
    }

    // Update longest streak
    if (user.paymentStreak.current > user.paymentStreak.longest) {
      user.paymentStreak.longest = user.paymentStreak.current;
    }

    user.paymentStreak.lastPaymentDate = today;

    // Check for milestone achievements (only if admin has configured streak system)
    const milestone = await checkStreakMilestone(user);
    let rewardEarned = null;

    if (milestone) {
      // Add reward to wallet
      user.wallet.balance = (user.wallet.balance || 0) + milestone.reward;
      user.paymentStreak.totalRewardsEarned =
        (user.paymentStreak.totalRewardsEarned || 0) + milestone.reward;
      user.paymentStreak.milestonesAchieved.push({
        days: milestone.days,
        achievedAt: new Date(),
        rewardAmount: milestone.reward,
      });

      rewardEarned = milestone;

      console.log(`[Streak] User ${userId} achieved ${milestone.days}-day milestone! Reward: ${milestone.reward}`);
    }

    await user.save();

    return {
      success: true,
      streak: user.paymentStreak,
      rewardEarned,
    };
  } catch (error) {
    console.error("[Autopay] Error updating streak:", error);
    throw error;
  }
}

/**
 * Get user's streak information
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Streak info
 */
async function getStreakInfo(userId) {
  try {
    const user = await User.findById(userId).select("paymentStreak");

    if (!user) {
      throw new Error("User not found");
    }

    const streak = user.paymentStreak || {
      current: 0,
      longest: 0,
      lastPaymentDate: null,
      totalRewardsEarned: 0,
      milestonesAchieved: [],
    };

    // Check if streak is still active
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let isActive = false;
    if (streak.lastPaymentDate) {
      const lastPayment = new Date(streak.lastPaymentDate);
      lastPayment.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today - lastPayment) / (1000 * 60 * 60 * 24));
      isActive = diffDays <= 1;
    }

    // Get config from database (admin configured)
    const streakConfig = await StreakConfig.getConfig();
    const allMilestones = streakConfig.milestones || [];
    const nextMilestone = await getNextStreakMilestone(streak.current);

    return {
      success: true,
      streak: {
        current: streak.current,
        longest: streak.longest,
        isActive,
        lastPaymentDate: streak.lastPaymentDate,
        totalRewardsEarned: streak.totalRewardsEarned,
        milestonesAchieved: streak.milestonesAchieved,
        nextMilestone,
        daysUntilNextMilestone: nextMilestone
          ? nextMilestone.days - streak.current
          : null,
        allMilestones: allMilestones,
        isConfigured: streakConfig.isConfigured,
        isEnabled: streakConfig.enabled,
      },
    };
  } catch (error) {
    console.error("[Autopay] Error getting streak info:", error);
    throw error;
  }
}

/**
 * Send low balance alert to user
 *
 * @param {string} userId - User ID
 * @param {Object} data - Alert data
 * @returns {Promise<void>}
 */
async function sendLowBalanceAlert(userId, data) {
  try {
    const user = await User.findById(userId).select(
      "deviceToken notificationPreferences name"
    );

    if (!user?.deviceToken) return;
    if (user.notificationPreferences?.lowBalanceAlert === false) return;

    await sendPushNotification(userId, {
      title: "Low Wallet Balance Alert",
      body: `Your wallet balance is ${data.balance}. You need ${data.required} for tomorrow's autopay. Add ${data.shortfall} to continue autopay.`,
      data: {
        type: "LOW_BALANCE_ALERT",
        balance: String(data.balance),
        required: String(data.required),
        shortfall: String(data.shortfall),
      },
    });

    console.log(`[Autopay] Low balance alert sent to user ${userId}`);
  } catch (error) {
    console.error("[Autopay] Error sending low balance alert:", error);
  }
}

/**
 * Send daily autopay reminder
 *
 * @param {string} userId - User ID
 * @param {Object} data - Reminder data
 * @returns {Promise<void>}
 */
async function sendDailyReminder(userId, data) {
  try {
    const user = await User.findById(userId).select(
      "deviceToken notificationPreferences name"
    );

    if (!user?.deviceToken) return;
    if (user.notificationPreferences?.dailyReminder === false) return;

    await sendPushNotification(userId, {
      title: "Autopay Reminder",
      body: `${data.orderCount} payment(s) of ${data.totalAmount} will be deducted today via autopay.`,
      data: {
        type: "AUTOPAY_REMINDER",
        orderCount: String(data.orderCount),
        totalAmount: String(data.totalAmount),
        scheduledTime: data.scheduledTime,
      },
    });

    console.log(`[Autopay] Daily reminder sent to user ${userId}`);
  } catch (error) {
    console.error("[Autopay] Error sending daily reminder:", error);
  }
}

/**
 * Send autopay success notification
 *
 * @param {string} userId - User ID
 * @param {Object} data - Success data
 * @returns {Promise<void>}
 */
async function sendAutopaySuccessNotification(userId, data) {
  try {
    const user = await User.findById(userId).select(
      "deviceToken notificationPreferences"
    );

    if (!user?.deviceToken) return;
    if (user.notificationPreferences?.autopaySuccess === false) return;

    await sendPushNotification(userId, {
      title: "Autopay Successful",
      body: `${data.totalAmount} paid for ${data.orderCount} order(s). New balance: ${data.newBalance}`,
      data: {
        type: "AUTOPAY_SUCCESS",
        totalAmount: String(data.totalAmount),
        orderCount: String(data.orderCount),
        newBalance: String(data.newBalance),
      },
    });

    console.log(`[Autopay] Success notification sent to user ${userId}`);
  } catch (error) {
    console.error("[Autopay] Error sending success notification:", error);
  }
}

/**
 * Send autopay failed notification
 *
 * @param {string} userId - User ID
 * @param {Object} data - Failure data
 * @returns {Promise<void>}
 */
async function sendAutopayFailedNotification(userId, data) {
  try {
    const user = await User.findById(userId).select(
      "deviceToken notificationPreferences"
    );

    if (!user?.deviceToken) return;
    if (user.notificationPreferences?.autopayFailed === false) return;

    await sendPushNotification(userId, {
      title: "Autopay Failed",
      body: data.reason || "Autopay could not be processed. Please pay manually.",
      data: {
        type: "AUTOPAY_FAILED",
        reason: data.reason || "Unknown error",
        orderCount: String(data.failedCount || 0),
      },
    });

    console.log(`[Autopay] Failure notification sent to user ${userId}`);
  } catch (error) {
    console.error("[Autopay] Error sending failure notification:", error);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get next payment time based on time preference
 */
function getNextPaymentTime(timePreference) {
  const now = new Date();
  const next = new Date();

  switch (timePreference) {
    case "MORNING_6AM":
      next.setHours(6, 0, 0, 0);
      break;
    case "AFTERNOON_12PM":
      next.setHours(12, 0, 0, 0);
      break;
    case "EVENING_6PM":
      next.setHours(18, 0, 0, 0);
      break;
    default:
      next.setHours(6, 0, 0, 0);
  }

  // If time has passed today, set for tomorrow
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

/**
 * Get next streak milestone from admin config
 * Returns null if streak system not configured/enabled
 */
async function getNextStreakMilestone(currentStreak) {
  try {
    const milestones = await StreakConfig.getActiveMilestones();

    if (!milestones || milestones.length === 0) {
      return null; // No milestones configured by admin
    }

    for (const milestone of milestones) {
      if (currentStreak < milestone.days) {
        return milestone;
      }
    }

    return null; // All milestones achieved
  } catch (error) {
    console.error("[Streak] Error getting next milestone:", error);
    return null;
  }
}

/**
 * Check if user has achieved a new streak milestone
 * Returns null if streak system not configured/enabled
 */
async function checkStreakMilestone(user) {
  try {
    // Check if streak system is enabled
    const isEnabled = await StreakConfig.isEnabled();
    if (!isEnabled) {
      return null; // Streak rewards not enabled by admin
    }

    const milestones = await StreakConfig.getActiveMilestones();
    if (!milestones || milestones.length === 0) {
      return null; // No milestones configured
    }

    const currentStreak = user.paymentStreak?.current || 0;
    const achievedDays = (user.paymentStreak?.milestonesAchieved || []).map(
      (m) => m.days
    );

    for (const milestone of milestones) {
      if (currentStreak >= milestone.days && !achievedDays.includes(milestone.days)) {
        return milestone;
      }
    }

    return null;
  } catch (error) {
    console.error("[Streak] Error checking milestone:", error);
    return null;
  }
}

module.exports = {
  // Enable/Disable
  enableAutopayForOrder,
  disableAutopayForOrder,
  enableAutopayForAllOrders,
  disableAutopayForAllOrders,

  // Pause/Resume/Skip
  pauseAutopay,
  resumeAutopay,
  addSkipDates,
  removeSkipDate,

  // Settings
  updateAutopaySettings,
  getAutopaySettings,
  getAutopayStatus,
  setAutopayPriority,

  // Dashboard & Forecast
  getAutopayDashboard,
  getBalanceForecast,
  getAutopayHistory,

  // Payment Processing (for cron)
  processAutopayPayment,

  // Streak
  updatePaymentStreak,
  getStreakInfo,

  // Notifications
  sendLowBalanceAlert,
  sendDailyReminder,
  sendAutopaySuccessNotification,
  sendAutopayFailedNotification,
};
