/**
 * Autopay Cron Job
 *
 * Handles automatic daily payment processing for installment orders.
 *
 * Schedule:
 * - MORNING_6AM: 6:00 AM IST
 * - AFTERNOON_12PM: 12:00 PM IST
 * - EVENING_6PM: 6:00 PM IST
 *
 * Also handles:
 * - Daily reminders (1 hour before payment)
 * - Low balance alerts (day before payment)
 * - Streak updates after payments
 */

const cron = require("node-cron");
const mongoose = require("mongoose");
const InstallmentOrder = require("../models/InstallmentOrder");
const User = require("../models/User");
const autopayService = require("../services/autopayService");

// ============================================
// CONFIGURATION
// ============================================

// Cron schedules (IST = UTC+5:30)
// Format: 'minute hour * * *' (runs daily at specified time)
const CRON_SCHEDULES = {
  MORNING_6AM: "30 0 * * *", // 6:00 AM IST = 00:30 UTC
  AFTERNOON_12PM: "30 6 * * *", // 12:00 PM IST = 06:30 UTC
  EVENING_6PM: "30 12 * * *", // 6:00 PM IST = 12:30 UTC
  REMINDER_5AM: "30 23 * * *", // 5:00 AM IST (1hr before 6AM) = 23:30 UTC (prev day)
  REMINDER_11AM: "30 5 * * *", // 11:00 AM IST (1hr before 12PM) = 05:30 UTC
  REMINDER_5PM: "30 11 * * *", // 5:00 PM IST (1hr before 6PM) = 11:30 UTC
  LOW_BALANCE_CHECK: "30 18 * * *", // 12:00 AM IST (midnight for next day check) = 18:30 UTC
};

// Batch size for processing
const BATCH_SIZE = 50;

// ============================================
// MAIN AUTOPAY PROCESSOR
// ============================================

/**
 * Process autopay for a specific time slot
 * NOTE: Currently, we only run at 6 AM and ignore timePreference.
 *       Time preference feature will be added later.
 *
 * @param {string} timeSlot - Time slot (MORNING_6AM, AFTERNOON_12PM, EVENING_6PM)
 */
async function processAutopayForTimeSlot(timeSlot) {
  console.log(`\n========================================`);
  console.log(`[Autopay Cron] Starting ${timeSlot} autopay processing`);
  console.log(`[Autopay Cron] Time: ${new Date().toISOString()}`);
  console.log(`========================================\n`);

  const startTime = Date.now();
  let totalProcessed = 0;
  let totalSuccess = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalInsufficientBalance = 0;

  try {
    // Get all users with autopay enabled (ignore timePreference for now)
    // Time preference feature will be added later
    const users = await User.find({
      "autopaySettings.enabled": true,
    }).select("_id wallet autopaySettings");

    console.log(`[Autopay Cron] Found ${users.length} users with autopay enabled`);

    // Process each user
    for (const user of users) {
      try {
        const userResult = await processAutopayForUser(user);

        totalProcessed += userResult.processed;
        totalSuccess += userResult.success;
        totalFailed += userResult.failed;
        totalSkipped += userResult.skipped;
        totalInsufficientBalance += userResult.insufficientBalance;

        // Update streak if any successful payment
        if (userResult.success > 0) {
          try {
            await autopayService.updatePaymentStreak(user._id);
          } catch (streakError) {
            console.error(`[Autopay Cron] Streak update failed for user ${user._id}:`, streakError);
          }

          // Send success notification
          await autopayService.sendAutopaySuccessNotification(user._id, {
            totalAmount: userResult.totalAmountPaid,
            orderCount: userResult.success,
            newBalance: userResult.newBalance,
          });
        }

        // Send failure notification if any failed
        if (userResult.failed > 0 || userResult.insufficientBalance > 0) {
          await autopayService.sendAutopayFailedNotification(user._id, {
            failedCount: userResult.failed + userResult.insufficientBalance,
            reason:
              userResult.insufficientBalance > 0
                ? "Insufficient wallet balance"
                : "Payment processing failed",
          });
        }
      } catch (userError) {
        console.error(`[Autopay Cron] Error processing user ${user._id}:`, userError);
      }
    }

    const duration = Date.now() - startTime;

    console.log(`\n========================================`);
    console.log(`[Autopay Cron] ${timeSlot} Processing Complete`);
    console.log(`[Autopay Cron] Duration: ${duration}ms`);
    console.log(`[Autopay Cron] Total Processed: ${totalProcessed}`);
    console.log(`[Autopay Cron] Success: ${totalSuccess}`);
    console.log(`[Autopay Cron] Failed: ${totalFailed}`);
    console.log(`[Autopay Cron] Skipped: ${totalSkipped}`);
    console.log(`[Autopay Cron] Insufficient Balance: ${totalInsufficientBalance}`);
    console.log(`========================================\n`);

    return {
      timeSlot,
      duration,
      totalProcessed,
      totalSuccess,
      totalFailed,
      totalSkipped,
      totalInsufficientBalance,
    };
  } catch (error) {
    console.error(`[Autopay Cron] Critical error in ${timeSlot} processing:`, error);
    throw error;
  }
}

/**
 * Process autopay for a single user
 *
 * @param {Object} user - User document
 * @returns {Object} Processing result
 */
async function processAutopayForUser(user) {
  const result = {
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    insufficientBalance: 0,
    totalAmountPaid: 0,
    newBalance: user.wallet?.balance || 0,
  };

  try {
    // Get active orders with autopay enabled, sorted by priority
    const orders = await InstallmentOrder.find({
      user: user._id,
      status: "ACTIVE",
      "autopay.enabled": true,
    }).sort({ "autopay.priority": 1 });

    if (orders.length === 0) {
      return result;
    }

    console.log(`[Autopay Cron] Processing ${orders.length} orders for user ${user._id}`);

    // Refresh user for latest balance
    const freshUser = await User.findById(user._id).select("wallet autopaySettings");

    for (const order of orders) {
      result.processed++;

      // Check if order can process autopay
      if (!order.canProcessAutopay()) {
        result.skipped++;
        console.log(`[Autopay Cron] Skipped order ${order.orderId}: Cannot process autopay`);
        continue;
      }

      // Process payment
      const paymentResult = await autopayService.processAutopayPayment(order, freshUser);

      if (paymentResult.success) {
        result.success++;
        result.totalAmountPaid += paymentResult.amount;
        result.newBalance = paymentResult.newBalance;

        // Update freshUser balance for next iteration
        freshUser.wallet.balance = paymentResult.newBalance;
      } else if (paymentResult.status === "INSUFFICIENT_BALANCE") {
        result.insufficientBalance++;
        // Stop processing more orders if insufficient balance
        console.log(`[Autopay Cron] Insufficient balance for user ${user._id}, stopping`);
        break;
      } else if (paymentResult.status === "SKIPPED") {
        result.skipped++;
      } else {
        result.failed++;
      }
    }

    return result;
  } catch (error) {
    console.error(`[Autopay Cron] Error in processAutopayForUser:`, error);
    result.failed = result.processed - result.success - result.skipped;
    return result;
  }
}

// ============================================
// REMINDER PROCESSOR
// ============================================

/**
 * Send daily reminders before autopay
 * NOTE: Currently ignores timePreference, sends to all users with reminder enabled
 *
 * @param {string} upcomingTimeSlot - The upcoming time slot
 */
async function sendDailyReminders(upcomingTimeSlot) {
  console.log(`[Autopay Cron] Sending reminders for ${upcomingTimeSlot}`);

  try {
    // Get all users with autopay enabled who have reminder enabled
    // (ignoring timePreference for now)
    const users = await User.find({
      "autopaySettings.enabled": true,
      "autopaySettings.sendDailyReminder": true,
    }).select("_id");

    console.log(`[Autopay Cron] Found ${users.length} users for reminders`);

    for (const user of users) {
      try {
        // Get today's pending autopay orders
        const orders = await InstallmentOrder.find({
          user: user._id,
          status: "ACTIVE",
          "autopay.enabled": true,
        }).select("orderId productName dailyPaymentAmount");

        // Filter orders that can pay today
        const payableOrders = orders.filter(
          (o) => o.canProcessAutopay && o.canProcessAutopay()
        );

        if (payableOrders.length > 0) {
          const totalAmount = payableOrders.reduce(
            (sum, o) => sum + o.dailyPaymentAmount,
            0
          );

          await autopayService.sendDailyReminder(user._id, {
            orderCount: payableOrders.length,
            totalAmount,
            scheduledTime: upcomingTimeSlot,
          });
        }
      } catch (userError) {
        console.error(`[Autopay Cron] Reminder error for user ${user._id}:`, userError);
      }
    }
  } catch (error) {
    console.error("[Autopay Cron] Error sending reminders:", error);
  }
}

// ============================================
// LOW BALANCE ALERT PROCESSOR
// ============================================

/**
 * Check and send low balance alerts for next day's payments
 */
async function checkLowBalanceAlerts() {
  console.log("[Autopay Cron] Checking low balance alerts");

  try {
    // Get all users with autopay enabled
    const users = await User.find({
      "autopaySettings.enabled": true,
    }).select("_id wallet autopaySettings");

    console.log(`[Autopay Cron] Checking ${users.length} users for low balance`);

    for (const user of users) {
      try {
        // Get tomorrow's expected payments
        const orders = await InstallmentOrder.find({
          user: user._id,
          status: "ACTIVE",
          "autopay.enabled": true,
        }).select("dailyPaymentAmount paymentSchedule autopay");

        // Calculate tomorrow's total
        const now = new Date();
        const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));

        let tomorrowTotal = 0;
        for (const order of orders) {
          // Check if there's a pending payment tomorrow
          const hasTomorrowPayment = order.paymentSchedule.some((inst) => {
            if (inst.status !== "PENDING") return false;
            const dueDate = new Date(inst.dueDate);
            const dueDateUTC = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate(), 0, 0, 0, 0));
            return dueDateUTC.getTime() === tomorrow.getTime();
          });

          // Check if it's not a skip date
          const isSkipped = order.autopay?.skipDates?.some((d) => {
            return d.getTime() === tomorrow.getTime();
          });

          if (hasTomorrowPayment && !isSkipped) {
            tomorrowTotal += order.dailyPaymentAmount;
          }
        }

        if (tomorrowTotal === 0) continue;

        // Check if balance is sufficient
        const balance = user.wallet?.balance || 0;
        const minimumLock = user.autopaySettings?.minimumBalanceLock || 0;
        const availableBalance = Math.max(0, balance - minimumLock);

        if (availableBalance < tomorrowTotal) {
          // Send low balance alert
          await autopayService.sendLowBalanceAlert(user._id, {
            balance: availableBalance,
            required: tomorrowTotal,
            shortfall: tomorrowTotal - availableBalance,
          });
        } else {
          // Check against threshold
          const threshold = user.autopaySettings?.lowBalanceThreshold || 500;
          const balanceAfterPayment = availableBalance - tomorrowTotal;

          if (balanceAfterPayment < threshold) {
            await autopayService.sendLowBalanceAlert(user._id, {
              balance: balanceAfterPayment,
              required: threshold,
              shortfall: threshold - balanceAfterPayment,
            });
          }
        }
      } catch (userError) {
        console.error(`[Autopay Cron] Low balance check error for user ${user._id}:`, userError);
      }
    }
  } catch (error) {
    console.error("[Autopay Cron] Error checking low balance:", error);
  }
}

// ============================================
// CRON JOB INITIALIZATION
// ============================================

/**
 * Start all autopay cron jobs
 */
function startAutopayCron() {
  console.log("========================================");
  console.log("[Autopay Cron] Initializing autopay cron jobs...");
  console.log("========================================");

  // Morning 6 AM autopay - This is the ONLY autopay slot for now
  // Time preference feature will be added later
  cron.schedule(CRON_SCHEDULES.MORNING_6AM, async () => {
    try {
      await processAutopayForTimeSlot("MORNING_6AM");
    } catch (error) {
      console.error("[Autopay Cron] MORNING_6AM job failed:", error);
    }
  });
  console.log("[Autopay Cron] ✅ MORNING_6AM job scheduled (6:00 AM IST)");

  // NOTE: AFTERNOON and EVENING slots disabled for now
  // Will be enabled when time preference feature is added
  //
  // // Afternoon 12 PM autopay
  // cron.schedule(CRON_SCHEDULES.AFTERNOON_12PM, async () => {
  //   try {
  //     await processAutopayForTimeSlot("AFTERNOON_12PM");
  //   } catch (error) {
  //     console.error("[Autopay Cron] AFTERNOON_12PM job failed:", error);
  //   }
  // });
  // console.log("[Autopay Cron] ✅ AFTERNOON_12PM job scheduled");

  // // Evening 6 PM autopay
  // cron.schedule(CRON_SCHEDULES.EVENING_6PM, async () => {
  //   try {
  //     await processAutopayForTimeSlot("EVENING_6PM");
  //   } catch (error) {
  //     console.error("[Autopay Cron] EVENING_6PM job failed:", error);
  //   }
  // });
  // console.log("[Autopay Cron] ✅ EVENING_6PM job scheduled");

  // Morning reminder (5 AM for 6 AM slot)
  cron.schedule(CRON_SCHEDULES.REMINDER_5AM, async () => {
    try {
      await sendDailyReminders("MORNING_6AM");
    } catch (error) {
      console.error("[Autopay Cron] REMINDER_5AM job failed:", error);
    }
  });
  console.log("[Autopay Cron] ✅ REMINDER_5AM job scheduled (5:00 AM IST)");

  // NOTE: Other reminder slots disabled for now
  //
  // // Afternoon reminder (11 AM for 12 PM slot)
  // cron.schedule(CRON_SCHEDULES.REMINDER_11AM, async () => {
  //   try {
  //     await sendDailyReminders("AFTERNOON_12PM");
  //   } catch (error) {
  //     console.error("[Autopay Cron] REMINDER_11AM job failed:", error);
  //   }
  // });
  // console.log("[Autopay Cron] ✅ REMINDER_11AM job scheduled");

  // // Evening reminder (5 PM for 6 PM slot)
  // cron.schedule(CRON_SCHEDULES.REMINDER_5PM, async () => {
  //   try {
  //     await sendDailyReminders("EVENING_6PM");
  //   } catch (error) {
  //     console.error("[Autopay Cron] REMINDER_5PM job failed:", error);
  //   }
  // });
  // console.log("[Autopay Cron] ✅ REMINDER_5PM job scheduled");

  // Low balance check (midnight for next day)
  cron.schedule(CRON_SCHEDULES.LOW_BALANCE_CHECK, async () => {
    try {
      await checkLowBalanceAlerts();
    } catch (error) {
      console.error("[Autopay Cron] LOW_BALANCE_CHECK job failed:", error);
    }
  });
  console.log("[Autopay Cron] ✅ LOW_BALANCE_CHECK job scheduled");

  console.log("========================================");
  console.log("[Autopay Cron] All cron jobs initialized successfully!");
  console.log("========================================\n");
}

/**
 * Manual trigger for testing (call from admin endpoint)
 *
 * @param {string} timeSlot - Time slot to process
 * @returns {Object} Processing result
 */
async function manualTriggerAutopay(timeSlot) {
  console.log(`[Autopay Cron] Manual trigger for ${timeSlot}`);

  const validSlots = ["MORNING_6AM", "AFTERNOON_12PM", "EVENING_6PM"];
  if (!validSlots.includes(timeSlot)) {
    throw new Error(`Invalid time slot. Valid options: ${validSlots.join(", ")}`);
  }

  return await processAutopayForTimeSlot(timeSlot);
}

/**
 * Get cron job status
 */
function getCronStatus() {
  return {
    schedules: CRON_SCHEDULES,
    serverTime: new Date().toISOString(),
    timezone: process.env.TZ || "UTC",
    jobs: [
      { name: "MORNING_6AM", schedule: CRON_SCHEDULES.MORNING_6AM, description: "6:00 AM IST autopay" },
      { name: "AFTERNOON_12PM", schedule: CRON_SCHEDULES.AFTERNOON_12PM, description: "12:00 PM IST autopay" },
      { name: "EVENING_6PM", schedule: CRON_SCHEDULES.EVENING_6PM, description: "6:00 PM IST autopay" },
      { name: "REMINDER_5AM", schedule: CRON_SCHEDULES.REMINDER_5AM, description: "5:00 AM IST reminder" },
      { name: "REMINDER_11AM", schedule: CRON_SCHEDULES.REMINDER_11AM, description: "11:00 AM IST reminder" },
      { name: "REMINDER_5PM", schedule: CRON_SCHEDULES.REMINDER_5PM, description: "5:00 PM IST reminder" },
      { name: "LOW_BALANCE_CHECK", schedule: CRON_SCHEDULES.LOW_BALANCE_CHECK, description: "Midnight low balance check" },
    ],
  };
}

module.exports = {
  startAutopayCron,
  processAutopayForTimeSlot,
  sendDailyReminders,
  checkLowBalanceAlerts,
  manualTriggerAutopay,
  getCronStatus,
};
