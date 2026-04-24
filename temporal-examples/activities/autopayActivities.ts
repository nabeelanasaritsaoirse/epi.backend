/**
 * Autopay Activities - Temporal Implementation
 *
 * These activities wrap the existing service layer to make them
 * compatible with Temporal's execution model.
 *
 * Key principles:
 * - Activities are idempotent where possible
 * - Activities are retry-safe
 * - Activities handle their own database connections
 */

import { Context } from '@temporalio/activity';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface UserAutopayData {
  userId: string;
  walletBalance: number;
  orders: OrderAutopayData[];
}

export interface OrderAutopayData {
  orderId: string;
  dailyAmount: number;
  productName: string;
  priority: number;
}

export interface ProcessUserAutopayInput {
  userId: string;
  timeSlot: string;
  orders: OrderAutopayData[];
  walletBalance: number;
}

export interface UserAutopayResult {
  userId: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'SKIPPED' | 'INSUFFICIENT_BALANCE';
  success: number;
  failed: number;
  skipped: number;
  totalAmountPaid: number;
  newBalance: number;
  failureReason?: string;
}

export interface NotificationData {
  type: 'SUCCESS' | 'FAILED' | 'REMINDER';
  totalAmount?: number;
  orderCount?: number;
  newBalance?: number;
  failedCount?: number;
  reason?: string;
  scheduledTime?: string;
}

export interface LowBalanceAlertData {
  currentBalance: number;
  requiredAmount: number;
}

// ============================================
// ACTIVITY IMPLEMENTATIONS
// ============================================

/**
 * Get all users eligible for autopay at a specific time slot
 *
 * This activity queries the database for users with:
 * - autopaySettings.enabled = true
 * - autopaySettings.timePreference matching the time slot
 * - At least one ACTIVE order with autopay enabled
 */
export async function getUsersForAutopay(timeSlot: string): Promise<UserAutopayData[]> {
  // Import models here to ensure proper initialization
  const User = require('../../models/User');
  const InstallmentOrder = require('../../models/InstallmentOrder');

  // Heartbeat for long-running activity
  Context.current().heartbeat('Fetching users for autopay');

  const users = await User.find({
    'autopaySettings.enabled': true,
    'autopaySettings.timePreference': timeSlot,
  }).select('_id wallet autopaySettings');

  const results: UserAutopayData[] = [];

  for (const user of users) {
    // Heartbeat periodically
    if (results.length % 50 === 0) {
      Context.current().heartbeat(`Processing user ${results.length + 1}`);
    }

    const orders = await InstallmentOrder.find({
      user: user._id,
      status: 'ACTIVE',
      'autopay.enabled': true,
    })
      .select('_id orderId dailyPaymentAmount productName autopay')
      .sort({ 'autopay.priority': 1 });

    if (orders.length > 0) {
      results.push({
        userId: user._id.toString(),
        walletBalance: user.wallet?.balance || 0,
        orders: orders.map((o: any) => ({
          orderId: o._id.toString(),
          dailyAmount: o.dailyPaymentAmount,
          productName: o.productName,
          priority: o.autopay?.priority || 1,
        })),
      });
    }
  }

  return results;
}

/**
 * Process autopay for a single user
 *
 * This is the main payment processing activity. It:
 * 1. Validates user can pay
 * 2. Processes each order in priority order
 * 3. Stops on insufficient balance
 * 4. Returns detailed results
 */
export async function processUserAutopay(
  input: ProcessUserAutopayInput
): Promise<UserAutopayResult> {
  const User = require('../../models/User');
  const InstallmentOrder = require('../../models/InstallmentOrder');
  const PaymentRecord = require('../../models/PaymentRecord');
  const { deductFromWallet, creditCommissionToWallet } = require('../../services/installmentWalletService');
  const { generateIdempotencyKey, isOrderFullyPaid } = require('../../utils/installmentHelpers');

  const { userId, orders } = input;

  // Get fresh user data
  const user = await User.findById(userId).select('wallet autopaySettings');
  if (!user) {
    return {
      userId,
      status: 'FAILED',
      success: 0,
      failed: orders.length,
      skipped: 0,
      totalAmountPaid: 0,
      newBalance: 0,
      failureReason: 'User not found',
    };
  }

  const minimumLock = user.autopaySettings?.minimumBalanceLock || 0;
  let availableBalance = Math.max(0, (user.wallet?.balance || 0) - minimumLock);

  let success = 0;
  let failed = 0;
  let skipped = 0;
  let totalAmountPaid = 0;
  let failureReason = '';

  for (const orderData of orders) {
    // Heartbeat for long operations
    Context.current().heartbeat(`Processing order ${orderData.orderId}`);

    // Get fresh order data
    const order = await InstallmentOrder.findById(orderData.orderId).populate('referrer');

    if (!order) {
      skipped++;
      continue;
    }

    // Check if order can process autopay today
    if (!order.canProcessAutopay || !order.canProcessAutopay()) {
      skipped++;
      continue;
    }

    // Check balance
    if (availableBalance < order.dailyPaymentAmount) {
      failed++;
      failureReason = 'INSUFFICIENT_BALANCE';
      // Don't break - continue to count remaining as insufficient
      continue;
    }

    try {
      // Generate idempotency key
      const nextInstallment = order.getNextPayableInstallment();
      if (!nextInstallment) {
        skipped++;
        continue;
      }

      const idempotencyKey = generateIdempotencyKey(
        order._id.toString(),
        userId,
        nextInstallment.installmentNumber
      );

      // Check if payment already exists (idempotency)
      const existingPayment = await PaymentRecord.findOne({ idempotencyKey });
      if (existingPayment && existingPayment.status === 'COMPLETED') {
        skipped++;
        continue;
      }

      // Deduct from wallet
      const walletResult = await deductFromWallet(
        userId,
        order.dailyPaymentAmount,
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
        user: userId,
        amount: order.dailyPaymentAmount,
        installmentNumber: nextInstallment.installmentNumber,
        paymentMethod: 'WALLET',
        walletTransactionId: walletResult.walletTransaction._id,
        status: 'COMPLETED',
        idempotencyKey,
        processedAt: new Date(),
        completedAt: new Date(),
        adminNote: 'Autopay - Temporal Workflow',
      });

      await payment.save();

      // Update order
      order.paidInstallments += 1;
      order.totalPaidAmount += order.dailyPaymentAmount;
      order.remainingAmount = Math.max(0, order.productPrice - order.totalPaidAmount);
      order.lastPaymentDate = new Date();

      // Update payment schedule
      const scheduleIndex = order.paymentSchedule.findIndex(
        (item: any) => item.installmentNumber === nextInstallment.installmentNumber
      );
      if (scheduleIndex !== -1) {
        order.paymentSchedule[scheduleIndex].status = 'PAID';
        order.paymentSchedule[scheduleIndex].paidDate = new Date();
        order.paymentSchedule[scheduleIndex].paymentId = payment._id;
      }

      // Check if order completed
      if (isOrderFullyPaid(order.productPrice, order.totalPaidAmount)) {
        order.status = 'COMPLETED';
        order.completedAt = new Date();
      }

      // Update autopay stats
      if (!order.autopay) order.autopay = {};
      order.autopay.lastAttempt = { date: new Date(), status: 'SUCCESS' };
      order.autopay.successCount = (order.autopay.successCount || 0) + 1;

      await order.save();

      // Credit commission if referrer exists
      if (order.referrer) {
        try {
          const commissionPercentage = order.productCommissionPercentage || 10;
          const commissionAmount = (order.dailyPaymentAmount * commissionPercentage) / 100;

          await creditCommissionToWallet(
            order.referrer._id || order.referrer,
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
          console.error(`[Autopay] Commission failed for order ${order.orderId}:`, commError);
          // Don't fail the payment for commission errors
        }
      }

      success++;
      totalAmountPaid += order.dailyPaymentAmount;
      availableBalance -= order.dailyPaymentAmount;

    } catch (error) {
      failed++;
      failureReason = error instanceof Error ? error.message : 'Payment processing error';

      // Update order with failure info
      try {
        const orderToUpdate = await InstallmentOrder.findById(orderData.orderId);
        if (orderToUpdate) {
          if (!orderToUpdate.autopay) orderToUpdate.autopay = {};
          orderToUpdate.autopay.lastAttempt = {
            date: new Date(),
            status: 'FAILED',
            errorMessage: failureReason,
          };
          orderToUpdate.autopay.failedCount = (orderToUpdate.autopay.failedCount || 0) + 1;
          await orderToUpdate.save();
        }
      } catch (updateError) {
        // Ignore update errors
      }
    }
  }

  // Determine overall status
  let status: UserAutopayResult['status'];
  if (success === orders.length) {
    status = 'SUCCESS';
  } else if (success > 0) {
    status = 'PARTIAL';
  } else if (failureReason === 'INSUFFICIENT_BALANCE') {
    status = 'INSUFFICIENT_BALANCE';
  } else if (skipped === orders.length) {
    status = 'SKIPPED';
  } else {
    status = 'FAILED';
  }

  return {
    userId,
    status,
    success,
    failed,
    skipped,
    totalAmountPaid,
    newBalance: availableBalance,
    failureReason: failureReason || undefined,
  };
}

/**
 * Update user's payment streak
 */
export async function updatePaymentStreak(userId: string): Promise<void> {
  const User = require('../../models/User');

  const user = await User.findById(userId);
  if (!user) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!user.paymentStreak) {
    user.paymentStreak = {
      current: 1,
      longest: 1,
      lastPaymentDate: today,
    };
  } else {
    const lastPayment = user.paymentStreak.lastPaymentDate
      ? new Date(user.paymentStreak.lastPaymentDate)
      : null;

    if (lastPayment) {
      lastPayment.setHours(0, 0, 0, 0);
      const diffDays = Math.floor(
        (today.getTime() - lastPayment.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 0) {
        // Same day, already counted
        return;
      } else if (diffDays === 1) {
        // Consecutive day
        user.paymentStreak.current += 1;
        if (user.paymentStreak.current > user.paymentStreak.longest) {
          user.paymentStreak.longest = user.paymentStreak.current;
        }
      } else {
        // Streak broken
        user.paymentStreak.current = 1;
      }
    } else {
      user.paymentStreak.current = 1;
    }

    user.paymentStreak.lastPaymentDate = today;
  }

  await user.save();
}

/**
 * Send autopay notification to user
 */
export async function sendAutopayNotification(
  userId: string,
  data: NotificationData
): Promise<void> {
  const { sendPushNotification } = require('../../services/fcmService');

  let title: string;
  let body: string;

  switch (data.type) {
    case 'SUCCESS':
      title = 'Autopay Successful';
      body = `${data.totalAmount} paid for ${data.orderCount} order(s). New balance: ${data.newBalance}`;
      break;
    case 'FAILED':
      title = 'Autopay Failed';
      body = `${data.failedCount} payment(s) failed: ${data.reason}`;
      break;
    case 'REMINDER':
      title = 'Autopay Reminder';
      body = `${data.orderCount} payment(s) totaling ${data.totalAmount} scheduled for ${data.scheduledTime}`;
      break;
    default:
      title = 'Autopay Update';
      body = 'Your autopay has been processed';
  }

  await sendPushNotification(userId, {
    title,
    body,
    data: {
      type: `AUTOPAY_${data.type}`,
      ...Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
    },
  });
}

/**
 * Send low balance alert to user
 */
export async function sendLowBalanceAlert(
  userId: string,
  data: LowBalanceAlertData
): Promise<void> {
  const { sendPushNotification } = require('../../services/fcmService');

  const shortfall = data.requiredAmount - data.currentBalance;

  await sendPushNotification(userId, {
    title: 'Low Wallet Balance Alert',
    body: `Your balance (${data.currentBalance}) is insufficient for tomorrow's autopay (${data.requiredAmount}). Add ${shortfall} to continue.`,
    data: {
      type: 'LOW_BALANCE_ALERT',
      currentBalance: String(data.currentBalance),
      requiredAmount: String(data.requiredAmount),
      shortfall: String(shortfall),
    },
  });
}
