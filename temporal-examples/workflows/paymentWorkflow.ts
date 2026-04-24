/**
 * Payment Workflow with Saga Pattern - Temporal Implementation
 *
 * Replaces: services/installmentPaymentService.js
 *
 * This workflow implements the saga pattern for payment processing:
 * - Each step has a corresponding compensation action
 * - On failure, compensations run in reverse order
 * - Ensures consistency even with partial failures
 */

import {
  proxyActivities,
  ApplicationFailure,
  workflowInfo,
} from '@temporalio/workflow';
import type * as activities from '../activities/paymentActivities';

// Configure activities with appropriate retry policies
const {
  validatePaymentEligibility,
  deductFromUserWallet,
  createPaymentRecord,
  updateOrderPaymentSchedule,
  creditReferrerCommission,
  checkOrderCompletion,
  // Compensation activities
  refundUserWallet,
  voidPaymentRecord,
  revertPaymentSchedule,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    initialInterval: '500ms',
    backoffCoefficient: 2,
    maximumInterval: '30 seconds',
    maximumAttempts: 3,
  },
});

// Razorpay activities have longer timeout
const {
  verifyRazorpayPayment,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumInterval: '1 minute',
    maximumAttempts: 5,
  },
});

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface PaymentWorkflowInput {
  orderId: string;
  userId: string;
  paymentMethod: 'WALLET' | 'RAZORPAY';
  razorpayData?: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  };
}

export interface PaymentWorkflowResult {
  success: boolean;
  paymentId?: string;
  amount?: number;
  installmentNumber?: number;
  orderStatus?: string;
  newWalletBalance?: number;
  commission?: {
    amount: number;
    referrerId: string;
  };
  error?: string;
}

interface CompensationAction {
  name: string;
  execute: () => Promise<void>;
}

// ============================================
// MAIN PAYMENT WORKFLOW
// ============================================

export async function paymentWorkflow(
  input: PaymentWorkflowInput
): Promise<PaymentWorkflowResult> {
  const { orderId, userId, paymentMethod, razorpayData } = input;
  const workflowId = workflowInfo().workflowId;

  console.log(`[Payment Workflow ${workflowId}] Starting payment for order ${orderId}`);

  // Track compensations for saga pattern
  const compensations: CompensationAction[] = [];

  try {
    // ========================================
    // Step 1: Validate payment eligibility
    // ========================================
    console.log(`[Payment Workflow] Step 1: Validating payment eligibility`);

    const validation = await validatePaymentEligibility({
      orderId,
      userId,
      paymentMethod,
    });

    if (!validation.isValid) {
      throw ApplicationFailure.create({
        message: validation.error || 'Payment validation failed',
        nonRetryable: true, // Don't retry validation failures
      });
    }

    const { order, nextInstallment } = validation;

    // ========================================
    // Step 2: Verify Razorpay payment (if applicable)
    // ========================================
    if (paymentMethod === 'RAZORPAY') {
      if (!razorpayData) {
        throw ApplicationFailure.create({
          message: 'Razorpay payment data required',
          nonRetryable: true,
        });
      }

      console.log(`[Payment Workflow] Step 2: Verifying Razorpay payment`);

      const razorpayVerification = await verifyRazorpayPayment({
        razorpayOrderId: razorpayData.razorpayOrderId,
        razorpayPaymentId: razorpayData.razorpayPaymentId,
        razorpaySignature: razorpayData.razorpaySignature,
      });

      if (!razorpayVerification.valid) {
        throw ApplicationFailure.create({
          message: 'Razorpay signature verification failed',
          nonRetryable: true,
        });
      }
    }

    // ========================================
    // Step 3: Deduct from wallet (if wallet payment)
    // ========================================
    let walletDeductionResult: any = null;

    if (paymentMethod === 'WALLET') {
      console.log(`[Payment Workflow] Step 3: Deducting from wallet`);

      walletDeductionResult = await deductFromUserWallet({
        userId,
        amount: order.dailyPaymentAmount,
        orderId,
        installmentNumber: nextInstallment.installmentNumber,
      });

      // Register compensation for wallet deduction
      compensations.push({
        name: 'refundWallet',
        execute: async () => {
          console.log(`[Payment Workflow] Compensating: Refunding wallet`);
          await refundUserWallet({
            userId,
            amount: order.dailyPaymentAmount,
            reason: 'Payment workflow compensation',
            originalTransactionId: walletDeductionResult.transactionId,
          });
        },
      });
    }

    // ========================================
    // Step 4: Create payment record
    // ========================================
    console.log(`[Payment Workflow] Step 4: Creating payment record`);

    const paymentRecord = await createPaymentRecord({
      orderId,
      userId,
      amount: order.dailyPaymentAmount,
      installmentNumber: nextInstallment.installmentNumber,
      paymentMethod,
      razorpayData,
      walletTransactionId: walletDeductionResult?.transactionId,
      workflowId,
    });

    // Register compensation for payment record
    compensations.push({
      name: 'voidPaymentRecord',
      execute: async () => {
        console.log(`[Payment Workflow] Compensating: Voiding payment record`);
        await voidPaymentRecord({
          paymentId: paymentRecord.paymentId,
          reason: 'Payment workflow compensation',
        });
      },
    });

    // ========================================
    // Step 5: Update order payment schedule
    // ========================================
    console.log(`[Payment Workflow] Step 5: Updating order payment schedule`);

    const previousOrderState = await updateOrderPaymentSchedule({
      orderId,
      installmentNumber: nextInstallment.installmentNumber,
      paymentId: paymentRecord.paymentId,
    });

    // Register compensation for order update
    compensations.push({
      name: 'revertPaymentSchedule',
      execute: async () => {
        console.log(`[Payment Workflow] Compensating: Reverting payment schedule`);
        await revertPaymentSchedule({
          orderId,
          previousState: previousOrderState,
        });
      },
    });

    // ========================================
    // Step 6: Credit commission (if referrer exists)
    // ========================================
    let commissionResult: any = null;

    if (order.referrerId) {
      console.log(`[Payment Workflow] Step 6: Crediting commission to referrer`);

      try {
        commissionResult = await creditReferrerCommission({
          referrerId: order.referrerId,
          amount: order.dailyPaymentAmount,
          commissionPercentage: order.commissionPercentage || 10,
          orderId,
          paymentId: paymentRecord.paymentId,
        });
      } catch (commissionError) {
        // Commission failure is non-critical - log but don't fail the workflow
        console.error(`[Payment Workflow] Commission credit failed:`, commissionError);
        // Note: We could add this to a retry queue or dead letter queue
      }
    }

    // ========================================
    // Step 7: Check and update order completion
    // ========================================
    console.log(`[Payment Workflow] Step 7: Checking order completion`);

    const completionResult = await checkOrderCompletion({
      orderId,
      totalPaidAmount: order.totalPaidAmount + order.dailyPaymentAmount,
      productPrice: order.productPrice,
    });

    // ========================================
    // Success!
    // ========================================
    console.log(`[Payment Workflow ${workflowId}] Payment completed successfully`);

    return {
      success: true,
      paymentId: paymentRecord.paymentId,
      amount: order.dailyPaymentAmount,
      installmentNumber: nextInstallment.installmentNumber,
      orderStatus: completionResult.orderStatus,
      newWalletBalance: walletDeductionResult?.newBalance,
      commission: commissionResult
        ? {
            amount: commissionResult.commissionAmount,
            referrerId: order.referrerId,
          }
        : undefined,
    };

  } catch (error) {
    console.error(`[Payment Workflow ${workflowId}] Payment failed:`, error);

    // ========================================
    // Execute compensations in reverse order (saga rollback)
    // ========================================
    console.log(`[Payment Workflow] Executing ${compensations.length} compensations`);

    for (let i = compensations.length - 1; i >= 0; i--) {
      const compensation = compensations[i];
      try {
        console.log(`[Payment Workflow] Executing compensation: ${compensation.name}`);
        await compensation.execute();
      } catch (compError) {
        // Log compensation failure but continue with other compensations
        console.error(
          `[Payment Workflow] Compensation ${compensation.name} failed:`,
          compError
        );
        // In production, you might want to persist failed compensations
        // for manual intervention
      }
    }

    // Re-throw as ApplicationFailure for proper Temporal handling
    if (error instanceof ApplicationFailure) {
      throw error;
    }

    throw ApplicationFailure.create({
      message: error instanceof Error ? error.message : 'Payment failed',
      nonRetryable: false,
    });
  }
}

// ============================================
// BULK PAYMENT WORKFLOW
// ============================================

export interface BulkPaymentInput {
  userId: string;
  orderIds: string[];
  paymentMethod: 'WALLET' | 'RAZORPAY';
  razorpayData?: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  };
}

export interface BulkPaymentResult {
  success: boolean;
  totalAmount: number;
  successCount: number;
  failedCount: number;
  payments: Array<{
    orderId: string;
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
    paymentId?: string;
    error?: string;
  }>;
}

/**
 * Process multiple payments in a single workflow
 *
 * Note: For Razorpay, a single combined order should have been created
 * before this workflow starts
 */
export async function bulkPaymentWorkflow(
  input: BulkPaymentInput
): Promise<BulkPaymentResult> {
  const { userId, orderIds, paymentMethod, razorpayData } = input;
  const workflowId = workflowInfo().workflowId;

  console.log(`[Bulk Payment ${workflowId}] Processing ${orderIds.length} orders`);

  // Verify Razorpay once for all payments
  if (paymentMethod === 'RAZORPAY' && razorpayData) {
    const verification = await verifyRazorpayPayment({
      razorpayOrderId: razorpayData.razorpayOrderId,
      razorpayPaymentId: razorpayData.razorpayPaymentId,
      razorpaySignature: razorpayData.razorpaySignature,
    });

    if (!verification.valid) {
      throw ApplicationFailure.create({
        message: 'Razorpay signature verification failed',
        nonRetryable: true,
      });
    }
  }

  const results: BulkPaymentResult['payments'] = [];
  let totalAmount = 0;
  let successCount = 0;
  let failedCount = 0;

  // Process each order
  for (const orderId of orderIds) {
    try {
      // Use the single payment workflow as a "sub-workflow" concept
      // In practice, you might use child workflows here
      const result = await paymentWorkflow({
        orderId,
        userId,
        paymentMethod,
        razorpayData,
      });

      if (result.success) {
        successCount++;
        totalAmount += result.amount || 0;
        results.push({
          orderId,
          status: 'SUCCESS',
          paymentId: result.paymentId,
        });
      } else {
        failedCount++;
        results.push({
          orderId,
          status: 'FAILED',
          error: result.error,
        });
      }
    } catch (error) {
      failedCount++;
      results.push({
        orderId,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    success: successCount > 0,
    totalAmount,
    successCount,
    failedCount,
    payments: results,
  };
}
