/**
 * Autopay Workflow - Temporal Implementation
 *
 * Replaces: jobs/autopayCron.js
 *
 * This workflow handles daily autopay processing with:
 * - Durable execution across server restarts
 * - Automatic retries for transient failures
 * - Pause/Resume signals for operational control
 * - Full observability through event history
 */

import {
  proxyActivities,
  defineSignal,
  setHandler,
  condition,
  sleep,
  workflowInfo,
} from '@temporalio/workflow';
import type * as activities from '../activities/autopayActivities';

// Configure activities with retry policies
const {
  getUsersForAutopay,
  processUserAutopay,
  sendAutopayNotification,
  updatePaymentStreak,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumInterval: '1 minute',
    maximumAttempts: 5,
  },
});

// Notification activities have more lenient retry (non-critical)
const { sendLowBalanceAlert } = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 seconds',
  retry: {
    initialInterval: '500ms',
    maximumAttempts: 2,
  },
});

// ============================================
// SIGNAL DEFINITIONS
// ============================================

export const pauseProcessingSignal = defineSignal('pauseProcessing');
export const resumeProcessingSignal = defineSignal('resumeProcessing');
export const skipUserSignal = defineSignal<[string]>('skipUser');

// ============================================
// WORKFLOW INPUT/OUTPUT TYPES
// ============================================

export interface AutopayWorkflowInput {
  timeSlot: 'MORNING_6AM' | 'AFTERNOON_12PM' | 'EVENING_6PM';
  date: string; // ISO date string
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

export interface AutopayWorkflowResult {
  timeSlot: string;
  date: string;
  workflowId: string;
  duration: number;
  totalUsers: number;
  totalProcessed: number;
  totalSuccess: number;
  totalFailed: number;
  totalSkipped: number;
  totalInsufficientBalance: number;
  totalAmountProcessed: number;
  results: UserAutopayResult[];
}

// ============================================
// MAIN WORKFLOW
// ============================================

export async function autopayWorkflow(
  input: AutopayWorkflowInput
): Promise<AutopayWorkflowResult> {
  const { timeSlot, date } = input;
  const startTime = Date.now();
  const workflowId = workflowInfo().workflowId;

  // Workflow state
  let isPaused = false;
  const skippedUserIds = new Set<string>();

  // Signal handlers
  setHandler(pauseProcessingSignal, () => {
    isPaused = true;
    console.log(`[Autopay Workflow] Processing paused`);
  });

  setHandler(resumeProcessingSignal, () => {
    isPaused = false;
    console.log(`[Autopay Workflow] Processing resumed`);
  });

  setHandler(skipUserSignal, (userId: string) => {
    skippedUserIds.add(userId);
    console.log(`[Autopay Workflow] User ${userId} added to skip list`);
  });

  console.log(`[Autopay Workflow] Starting ${timeSlot} processing for ${date}`);

  // ========================================
  // Step 1: Get users eligible for autopay
  // ========================================
  const users = await getUsersForAutopay(timeSlot);
  console.log(`[Autopay Workflow] Found ${users.length} users for ${timeSlot}`);

  // ========================================
  // Step 2: Process each user
  // ========================================
  const results: UserAutopayResult[] = [];
  let totalSuccess = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalInsufficientBalance = 0;
  let totalAmountProcessed = 0;

  for (const user of users) {
    // Check if paused - wait until resumed
    if (isPaused) {
      console.log(`[Autopay Workflow] Paused, waiting to resume...`);
      await condition(() => !isPaused);
      console.log(`[Autopay Workflow] Resumed processing`);
    }

    // Check if user should be skipped
    if (skippedUserIds.has(user.userId)) {
      results.push({
        userId: user.userId,
        status: 'SKIPPED',
        success: 0,
        failed: 0,
        skipped: user.orders.length,
        totalAmountPaid: 0,
        newBalance: user.walletBalance,
        failureReason: 'Manually skipped via signal',
      });
      totalSkipped++;
      continue;
    }

    try {
      // Process user's autopay orders
      const result = await processUserAutopay({
        userId: user.userId,
        timeSlot,
        orders: user.orders,
        walletBalance: user.walletBalance,
      });

      results.push(result);

      // Update counters
      if (result.status === 'SUCCESS' || result.status === 'PARTIAL') {
        totalSuccess += result.success;
        totalAmountProcessed += result.totalAmountPaid;

        // Update payment streak (non-critical)
        if (result.success > 0) {
          try {
            await updatePaymentStreak(user.userId);
          } catch (streakError) {
            console.log(`[Autopay Workflow] Streak update failed for ${user.userId}`);
          }

          // Send success notification (non-critical)
          try {
            await sendAutopayNotification(user.userId, {
              type: 'SUCCESS',
              totalAmount: result.totalAmountPaid,
              orderCount: result.success,
              newBalance: result.newBalance,
            });
          } catch (notifError) {
            console.log(`[Autopay Workflow] Notification failed for ${user.userId}`);
          }
        }
      }

      if (result.status === 'FAILED') {
        totalFailed++;

        // Send failure notification (non-critical)
        try {
          await sendAutopayNotification(user.userId, {
            type: 'FAILED',
            failedCount: result.failed,
            reason: result.failureReason || 'Payment processing error',
          });
        } catch (notifError) {
          console.log(`[Autopay Workflow] Failure notification failed for ${user.userId}`);
        }
      }

      if (result.status === 'INSUFFICIENT_BALANCE') {
        totalInsufficientBalance++;

        // Send low balance alert (non-critical)
        try {
          await sendLowBalanceAlert(user.userId, {
            currentBalance: result.newBalance,
            requiredAmount: user.orders.reduce((sum, o) => sum + o.dailyAmount, 0),
          });
        } catch (alertError) {
          console.log(`[Autopay Workflow] Low balance alert failed for ${user.userId}`);
        }
      }

      if (result.skipped > 0) {
        totalSkipped += result.skipped;
      }

      totalFailed += result.failed;

    } catch (error) {
      // Individual user failure doesn't stop the batch
      console.error(`[Autopay Workflow] Error processing user ${user.userId}:`, error);
      results.push({
        userId: user.userId,
        status: 'FAILED',
        success: 0,
        failed: user.orders.length,
        skipped: 0,
        totalAmountPaid: 0,
        newBalance: user.walletBalance,
        failureReason: error instanceof Error ? error.message : 'Unknown error',
      });
      totalFailed++;
    }

    // Small delay between users to prevent overwhelming the database
    await sleep('100ms');
  }

  const duration = Date.now() - startTime;

  console.log(`[Autopay Workflow] Completed ${timeSlot} processing`);
  console.log(`[Autopay Workflow] Duration: ${duration}ms`);
  console.log(`[Autopay Workflow] Success: ${totalSuccess}, Failed: ${totalFailed}`);

  return {
    timeSlot,
    date,
    workflowId,
    duration,
    totalUsers: users.length,
    totalProcessed: results.length,
    totalSuccess,
    totalFailed,
    totalSkipped,
    totalInsufficientBalance,
    totalAmountProcessed,
    results,
  };
}

// ============================================
// REMINDER WORKFLOW
// ============================================

export interface ReminderWorkflowInput {
  timeSlot: 'MORNING_6AM' | 'AFTERNOON_12PM' | 'EVENING_6PM';
  reminderHoursBefore: number;
}

export async function autopayReminderWorkflow(
  input: ReminderWorkflowInput
): Promise<{ sent: number; failed: number }> {
  const { timeSlot, reminderHoursBefore } = input;

  console.log(`[Reminder Workflow] Sending reminders for ${timeSlot}`);

  const users = await getUsersForAutopay(timeSlot);
  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const totalAmount = user.orders.reduce((sum, o) => sum + o.dailyAmount, 0);

      await sendAutopayNotification(user.userId, {
        type: 'REMINDER',
        orderCount: user.orders.length,
        totalAmount,
        scheduledTime: timeSlot,
      });

      sent++;
    } catch (error) {
      failed++;
    }
  }

  return { sent, failed };
}
