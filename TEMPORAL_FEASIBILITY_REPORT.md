# Temporal Integration Feasibility Report

## Executive Summary

This report analyzes the EPI Backend system to determine if integrating **Temporal** for durable execution will enhance system reliability and developer productivity. After thorough analysis of the codebase, the recommendation is **YES** - Temporal integration would provide significant benefits for this installment-based e-commerce platform.

**Key Finding:** The current system has multiple "brittle" patterns including cron-based autopay processing, manual state machine management, and lack of compensation logic for partial failures. Temporal would address these issues while providing automatic state persistence, retries, and observability.

---

## 1. Current Architecture Analysis

### 1.1 Technology Stack
- **Framework:** Express.js (v4.18.2)
- **Database:** MongoDB with Mongoose (v7.5.0)
- **Scheduler:** node-cron (v3.0.2)
- **External APIs:** Razorpay, Firebase FCM
- **Models:** 43 Mongoose schemas
- **Services:** 17 business logic modules

### 1.2 Critical Business Flows

| Flow | Duration | Current State Management | Risk Level |
|------|----------|-------------------------|------------|
| Installment Order Lifecycle | Days to Months | MongoDB + Mongoose methods | HIGH |
| Daily Autopay Processing | Hours (batch) | node-cron + for-loops | CRITICAL |
| Payment Processing | Seconds | Manual state updates | MEDIUM |
| Bulk Order Creation | Minutes | Partial atomic operations | HIGH |
| KYC Auto-Approval | Hours | node-cron without tracking | MEDIUM |
| Scheduled Notifications | Continuous | node-cron polling | LOW |

---

## 2. Identified "Brittle" Patterns

### 2.1 Autopay Cron Job (`jobs/autopayCron.js`)

**Current Implementation:**
```javascript
// Lines 74-113 - Processing without durability
for (const user of users) {
  try {
    const userResult = await processAutopayForUser(user);
    // ... counter updates ...
    if (userResult.success > 0) {
      await autopayService.updatePaymentStreak(user._id);  // Can fail silently
      await autopayService.sendAutopaySuccessNotification(...); // Can fail silently
    }
  } catch (userError) {
    console.error(`[Autopay Cron] Error processing user ${user._id}:`, userError);
    // User processing failure is logged but NO RETRY
  }
}
```

**Problems:**
1. **No durability**: If server crashes mid-batch, partial progress is lost
2. **No retry mechanism**: Failed users are simply logged, not retried
3. **No observability**: No way to see which users failed and why
4. **Race conditions**: Multiple cron triggers could process same user twice
5. **Memory pressure**: All users loaded into memory at once

### 2.2 Payment Processing State Machine (`services/installmentPaymentService.js`)

**Current Implementation (Lines 88-413):**
```javascript
// Manual state transitions without durability
order.paidInstallments += 1;
order.totalPaidAmount += paymentAmount;
order.paymentSchedule[scheduleIndex].status = "PAID";
await order.save(); // If this fails after Razorpay charged, inconsistent state

// Commission processing (Lines 346-375)
if (order.referrer) {
  const commissionResult = await creditCommissionToWallet(...);
  // If wallet credit fails after payment marked PAID, no rollback
}
```

**Problems:**
1. **Partial failure**: Payment marked complete but commission fails
2. **No compensation logic**: Cannot undo Razorpay charge on DB failure
3. **Idempotency gaps**: Some operations may double-execute on retry
4. **MongoDB transactions disabled**: Comment shows "session disabled for local development"

### 2.3 Manual Sleep/Delay Pattern (`services/fcmService.js`)

**Current Implementation (Line 383):**
```javascript
// Rate limiting with manual sleep
await new Promise(resolve => setTimeout(resolve, 1000));
```

**Problems:**
1. **Non-durable delays**: Server restart loses wait state
2. **No backoff strategy**: Fixed 1-second delay regardless of load
3. **Memory held during sleep**: Resources not released

### 2.4 KYC Auto-Approve Service (`services/kycAutoApproveService.js`)

**Current Implementation:**
```javascript
cron.schedule("* * * * *", async () => {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const pendingKycs = await Kyc.find({ status: "pending", submittedAt: { $lte: sixHoursAgo } });
  for (let kyc of pendingKycs) {
    kyc.status = "auto_approved";
    await kyc.save();  // No error handling, no retry
  }
});
```

**Problems:**
1. **No error handling**: Single failure crashes entire batch
2. **No idempotency**: Could re-process on restart
3. **No audit trail**: No record of auto-approval decisions

### 2.5 Order State Machine (`models/InstallmentOrder.js` + `services/installmentOrderService.js`)

**State Transitions:**
```
PENDING -> ACTIVE -> COMPLETED
    \         |
     `------> CANCELLED
```

**Delivery Sub-States:**
```
PENDING -> APPROVED -> SHIPPED -> DELIVERED
```

**Problems:**
1. **Manual transitions**: Each service method updates status independently
2. **No saga pattern**: Multi-step operations can leave inconsistent state
3. **No history**: Cannot replay state transitions for debugging

---

## 3. Third-Party API Integration Analysis

### 3.1 Razorpay Integration

**Location:** `config/razorpay.js`, `services/installmentPaymentService.js`

**Current Error Handling:**
```javascript
// Line 306-311 in installmentOrderService.js
razorpayOrder = await razorpay.orders.create({
  amount: calculatedDailyAmount * 100,
  currency: "INR",
  receipt: `order_${Date.now()}`,
  payment_capture: 1,
});
// No retry on network failure
// No circuit breaker
```

**Recommended Temporal Activity:**
- Automatic retries with exponential backoff
- Timeout handling
- Heartbeating for long operations

### 3.2 Firebase FCM Integration

**Location:** `services/fcmService.js`

**Current Error Handling:**
```javascript
// Line 89-101 - Error handling exists but no retry
} catch (error) {
  if (error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered') {
    return { success: false, invalidToken: true, token };
  }
  return { success: false, error: error.message, token };
}
```

**Recommended Temporal Activity:**
- Retry on transient failures
- Circuit breaker for FCM outages
- Batch processing with progress tracking

---

## 4. Temporal Migration Benefits

### 4.1 Durability Across Infrastructure Failures

| Scenario | Current Behavior | With Temporal |
|----------|-----------------|---------------|
| Server crash during autopay | Partial users processed, manual intervention required | Workflow resumes from last checkpoint |
| Database connection drop | Transaction rollback, lost progress | Activity retry, automatic recovery |
| Razorpay timeout | Order stuck in PENDING | Configurable retry with backoff |
| Region outage | Complete service unavailable | Multi-region failover |

### 4.2 Developer Productivity Improvements

1. **No more cron debugging**: Replace fragile cron jobs with observable Workflows
2. **Built-in retry policies**: Remove boilerplate retry code
3. **Time travel debugging**: Replay any workflow execution
4. **Human-in-the-loop**: Native Signal support for approval flows

### 4.3 Operational Visibility

- **Event History**: Complete audit trail for every execution
- **Metrics**: Built-in latency, throughput, error rate tracking
- **Search**: Query workflows by any attribute

---

## 5. Step-by-Step Migration Plan

### Phase 1: Infrastructure Setup (Foundation)

1. **Install Temporal Server**
   ```bash
   # Using Docker Compose for development
   git clone https://github.com/temporalio/docker-compose.git
   cd docker-compose
   docker-compose up
   ```

2. **Add Temporal SDK to project**
   ```bash
   npm install @temporalio/client @temporalio/worker @temporalio/workflow @temporalio/activity
   ```

3. **Create Temporal Worker configuration**
   - Worker process separate from Express server
   - Configure task queues for different workload types

### Phase 2: Migrate Autopay Processing (High Impact)

**Priority: CRITICAL**

**Current:** `jobs/autopayCron.js`
**Target:** `workflows/autopayWorkflow.ts`

**Tasks:**
1. Convert `processAutopayForTimeSlot` to Temporal Workflow
2. Extract `processAutopayPayment` as Activity
3. Implement retry policies for payment activities
4. Add observability through Temporal UI
5. Remove node-cron dependency for autopay

### Phase 3: Migrate Payment Processing (Medium Impact)

**Priority: HIGH**

**Current:** `services/installmentPaymentService.js`
**Target:** `workflows/paymentWorkflow.ts`

**Tasks:**
1. Create Payment Workflow with saga pattern
2. Implement compensation activities for rollback
3. Add Razorpay Activity with retry policy
4. Add Commission Activity with retry policy
5. Implement idempotency through Workflow ID

### Phase 4: Migrate Order Lifecycle (Medium Impact)

**Priority: HIGH**

**Current:** `services/installmentOrderService.js`
**Target:** `workflows/orderWorkflow.ts`

**Tasks:**
1. Model order states as Workflow states
2. Implement delivery approval as Signal
3. Add bulk order as Child Workflows
4. Migrate order completion detection

### Phase 5: Migrate Scheduled Notifications (Low Impact)

**Priority: LOW**

**Current:** `jobs/notificationCron.js`
**Target:** `workflows/notificationWorkflow.ts`

**Tasks:**
1. Replace cron polling with Temporal schedules
2. Implement notification delivery as Activity
3. Add retry for FCM failures

### Phase 6: Migrate KYC Auto-Approval (Low Impact)

**Priority: LOW**

**Current:** `services/kycAutoApproveService.js`
**Target:** `workflows/kycWorkflow.ts`

**Tasks:**
1. Create KYC submission Workflow
2. Implement durable timer for 6-hour wait
3. Add auto-approval as Activity

---

## 6. Sample Temporal Implementation

### 6.1 Autopay Workflow (TypeScript)

```typescript
// workflows/autopayWorkflow.ts
import { proxyActivities, sleep, defineSignal, setHandler } from '@temporalio/workflow';
import type * as activities from '../activities/autopayActivities';

const {
  getUsersForAutopay,
  processUserAutopay,
  sendAutopayNotification,
  updatePaymentStreak
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumInterval: '1 minute',
    maximumAttempts: 5,
  },
});

export const pauseAutopaySignal = defineSignal<[string]>('pauseAutopay');
export const resumeAutopaySignal = defineSignal('resumeAutopay');

interface AutopayWorkflowInput {
  timeSlot: 'MORNING_6AM' | 'AFTERNOON_12PM' | 'EVENING_6PM';
  date: string;
}

export async function autopayWorkflow(input: AutopayWorkflowInput): Promise<AutopayResult> {
  const { timeSlot, date } = input;
  let isPaused = false;
  const pausedUsers: string[] = [];

  // Handle pause/resume signals
  setHandler(pauseAutopaySignal, (userId: string) => {
    pausedUsers.push(userId);
  });

  setHandler(resumeAutopaySignal, () => {
    isPaused = false;
  });

  // Get users for this time slot
  const users = await getUsersForAutopay(timeSlot);

  const results: UserAutopayResult[] = [];
  let totalSuccess = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const user of users) {
    // Check if paused
    if (isPaused || pausedUsers.includes(user.userId)) {
      results.push({ userId: user.userId, status: 'SKIPPED', reason: 'paused' });
      totalSkipped++;
      continue;
    }

    try {
      // Process user's autopay - Activity handles retries automatically
      const result = await processUserAutopay({
        userId: user.userId,
        timeSlot,
        orders: user.orders,
      });

      results.push(result);

      if (result.success > 0) {
        totalSuccess += result.success;

        // Update streak (non-critical, can fail)
        await updatePaymentStreak(user.userId).catch(() => {});

        // Send notification (non-critical, can fail)
        await sendAutopayNotification(user.userId, {
          type: 'SUCCESS',
          totalAmount: result.totalAmountPaid,
          orderCount: result.success,
        }).catch(() => {});
      }

      if (result.failed > 0) {
        totalFailed += result.failed;

        // Notify about failures
        await sendAutopayNotification(user.userId, {
          type: 'FAILED',
          failedCount: result.failed,
          reason: result.failureReason,
        }).catch(() => {});
      }
    } catch (error) {
      // Individual user error doesn't stop batch
      results.push({
        userId: user.userId,
        status: 'ERROR',
        error: error.message
      });
      totalFailed++;
    }
  }

  return {
    timeSlot,
    date,
    totalProcessed: users.length,
    totalSuccess,
    totalFailed,
    totalSkipped,
    results,
  };
}
```

### 6.2 Autopay Activities

```typescript
// activities/autopayActivities.ts
import { User } from '../models/User';
import { InstallmentOrder } from '../models/InstallmentOrder';
import { deductFromWallet, creditCommissionToWallet } from '../services/installmentWalletService';
import { sendPushNotification } from '../services/fcmService';

export async function getUsersForAutopay(timeSlot: string): Promise<UserAutopayData[]> {
  const users = await User.find({
    'autopaySettings.enabled': true,
    'autopaySettings.timePreference': timeSlot,
  }).select('_id wallet autopaySettings');

  const results: UserAutopayData[] = [];

  for (const user of users) {
    const orders = await InstallmentOrder.find({
      user: user._id,
      status: 'ACTIVE',
      'autopay.enabled': true,
    }).sort({ 'autopay.priority': 1 });

    if (orders.length > 0) {
      results.push({
        userId: user._id.toString(),
        walletBalance: user.wallet?.balance || 0,
        orders: orders.map(o => ({
          orderId: o._id.toString(),
          dailyAmount: o.dailyPaymentAmount,
          productName: o.productName,
        })),
      });
    }
  }

  return results;
}

export async function processUserAutopay(input: ProcessUserAutopayInput): Promise<UserAutopayResult> {
  const { userId, orders } = input;

  let success = 0;
  let failed = 0;
  let totalAmountPaid = 0;
  let failureReason = '';

  // Get fresh user balance
  const user = await User.findById(userId).select('wallet autopaySettings');
  let availableBalance = (user?.wallet?.balance || 0) - (user?.autopaySettings?.minimumBalanceLock || 0);

  for (const orderData of orders) {
    const order = await InstallmentOrder.findById(orderData.orderId);

    if (!order || !order.canProcessAutopay()) {
      continue;
    }

    if (availableBalance < order.dailyPaymentAmount) {
      failed++;
      failureReason = 'INSUFFICIENT_BALANCE';
      break; // Stop processing for this user
    }

    try {
      // Deduct from wallet
      const walletResult = await deductFromWallet(
        userId,
        order.dailyPaymentAmount,
        `Autopay: Installment for ${order.productName}`,
        null,
        { orderId: order._id, isAutopay: true }
      );

      // Update order
      const nextInstallment = order.getNextPayableInstallment();
      order.paidInstallments += 1;
      order.totalPaidAmount += order.dailyPaymentAmount;
      order.remainingAmount = Math.max(0, order.productPrice - order.totalPaidAmount);
      order.lastPaymentDate = new Date();
      order.paymentSchedule[nextInstallment.installmentNumber - 1].status = 'PAID';
      order.paymentSchedule[nextInstallment.installmentNumber - 1].paidDate = new Date();
      await order.save();

      success++;
      totalAmountPaid += order.dailyPaymentAmount;
      availableBalance -= order.dailyPaymentAmount;

      // Credit commission if referrer exists
      if (order.referrer) {
        const commissionAmount = order.dailyPaymentAmount * 0.1; // 10%
        await creditCommissionToWallet(
          order.referrer.toString(),
          commissionAmount,
          order._id.toString(),
          'autopay-payment',
          null
        );
      }
    } catch (error) {
      failed++;
      failureReason = error.message;
    }
  }

  return {
    userId,
    status: success > 0 ? 'SUCCESS' : 'FAILED',
    success,
    failed,
    totalAmountPaid,
    failureReason,
    newBalance: availableBalance,
  };
}

export async function updatePaymentStreak(userId: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!user.paymentStreak) {
    user.paymentStreak = { current: 1, longest: 1, lastPaymentDate: today };
  } else {
    const lastPayment = user.paymentStreak.lastPaymentDate
      ? new Date(user.paymentStreak.lastPaymentDate)
      : null;

    if (lastPayment) {
      lastPayment.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - lastPayment.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        user.paymentStreak.current += 1;
        if (user.paymentStreak.current > user.paymentStreak.longest) {
          user.paymentStreak.longest = user.paymentStreak.current;
        }
      } else if (diffDays > 1) {
        user.paymentStreak.current = 1;
      }
    }
    user.paymentStreak.lastPaymentDate = today;
  }

  await user.save();
}

export async function sendAutopayNotification(
  userId: string,
  data: NotificationData
): Promise<void> {
  const title = data.type === 'SUCCESS' ? 'Autopay Successful' : 'Autopay Failed';
  const body = data.type === 'SUCCESS'
    ? `₹${data.totalAmount} paid for ${data.orderCount} order(s)`
    : `${data.failedCount} payment(s) failed: ${data.reason}`;

  await sendPushNotification(userId, { title, body, data: { type: `AUTOPAY_${data.type}` } });
}
```

### 6.3 Payment Workflow with Saga Pattern

```typescript
// workflows/paymentWorkflow.ts
import { proxyActivities, ApplicationFailure } from '@temporalio/workflow';
import type * as activities from '../activities/paymentActivities';

const {
  validatePayment,
  deductWallet,
  creditWallet,
  createPaymentRecord,
  updateOrderStatus,
  creditCommission,
  // Compensation activities
  refundWallet,
  voidPaymentRecord,
  revertOrderStatus,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    initialInterval: '500ms',
    backoffCoefficient: 2,
    maximumInterval: '30 seconds',
    maximumAttempts: 3,
  },
});

interface PaymentInput {
  orderId: string;
  userId: string;
  amount: number;
  installmentNumber: number;
  paymentMethod: 'WALLET' | 'RAZORPAY';
  razorpayData?: RazorpayData;
}

export async function paymentWorkflow(input: PaymentInput): Promise<PaymentResult> {
  const compensations: Array<() => Promise<void>> = [];

  try {
    // Step 1: Validate payment can be made
    await validatePayment(input);

    // Step 2: Deduct from wallet (if wallet payment)
    if (input.paymentMethod === 'WALLET') {
      const walletResult = await deductWallet({
        userId: input.userId,
        amount: input.amount,
        orderId: input.orderId,
        installmentNumber: input.installmentNumber,
      });

      // Register compensation
      compensations.push(async () => {
        await refundWallet({
          userId: input.userId,
          amount: input.amount,
          reason: 'Payment workflow compensation',
          originalTransactionId: walletResult.transactionId,
        });
      });
    }

    // Step 3: Create payment record
    const paymentRecord = await createPaymentRecord({
      orderId: input.orderId,
      userId: input.userId,
      amount: input.amount,
      installmentNumber: input.installmentNumber,
      paymentMethod: input.paymentMethod,
      razorpayData: input.razorpayData,
    });

    compensations.push(async () => {
      await voidPaymentRecord(paymentRecord.paymentId);
    });

    // Step 4: Update order status
    const previousOrderState = await updateOrderStatus({
      orderId: input.orderId,
      installmentNumber: input.installmentNumber,
      paymentId: paymentRecord.paymentId,
    });

    compensations.push(async () => {
      await revertOrderStatus({
        orderId: input.orderId,
        previousState: previousOrderState,
      });
    });

    // Step 5: Credit commission (non-critical, don't add to compensation)
    try {
      await creditCommission({
        orderId: input.orderId,
        paymentId: paymentRecord.paymentId,
        amount: input.amount,
      });
    } catch (error) {
      // Log but don't fail the workflow
      console.error('Commission credit failed:', error);
    }

    return {
      success: true,
      paymentId: paymentRecord.paymentId,
      newBalance: paymentRecord.newBalance,
    };

  } catch (error) {
    // Execute compensations in reverse order (saga rollback)
    for (let i = compensations.length - 1; i >= 0; i--) {
      try {
        await compensations[i]();
      } catch (compError) {
        // Log compensation failure but continue
        console.error(`Compensation ${i} failed:`, compError);
      }
    }

    throw ApplicationFailure.create({
      message: `Payment workflow failed: ${error.message}`,
      nonRetryable: false,
    });
  }
}
```

### 6.4 Order Lifecycle Workflow

```typescript
// workflows/orderWorkflow.ts
import {
  proxyActivities,
  condition,
  defineSignal,
  setHandler,
  sleep
} from '@temporalio/workflow';
import type * as activities from '../activities/orderActivities';

const {
  createOrder,
  processFirstPayment,
  markOrderActive,
  markOrderCompleted,
  processDelivery,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
});

// Signals for human-in-the-loop
export const approveDeliverySignal = defineSignal<[{ adminId: string; notes?: string }]>('approveDelivery');
export const updateDeliveryStatusSignal = defineSignal<[string]>('updateDeliveryStatus');
export const cancelOrderSignal = defineSignal<[{ reason: string; userId: string }]>('cancelOrder');

export async function orderWorkflow(input: CreateOrderInput): Promise<OrderResult> {
  let deliveryApproved = false;
  let deliveryStatus = 'PENDING';
  let isCancelled = false;
  let cancellationData: { reason: string; userId: string } | null = null;

  // Handle delivery approval signal
  setHandler(approveDeliverySignal, async (data) => {
    deliveryApproved = true;
    deliveryStatus = 'APPROVED';
  });

  // Handle delivery status updates
  setHandler(updateDeliveryStatusSignal, (status) => {
    deliveryStatus = status;
  });

  // Handle cancellation
  setHandler(cancelOrderSignal, (data) => {
    isCancelled = true;
    cancellationData = data;
  });

  // Step 1: Create order in PENDING state
  const order = await createOrder(input);

  // Check for early cancellation
  if (isCancelled) {
    return { success: false, status: 'CANCELLED', reason: cancellationData?.reason };
  }

  // Step 2: Process first payment
  const firstPayment = await processFirstPayment({
    orderId: order.orderId,
    userId: input.userId,
    paymentMethod: input.paymentMethod,
    razorpayData: input.razorpayData,
  });

  if (!firstPayment.success) {
    return { success: false, status: 'PAYMENT_FAILED', error: firstPayment.error };
  }

  // Step 3: Activate order
  await markOrderActive(order.orderId);

  // Note: Daily payments are handled by separate autopay workflow
  // This workflow now waits for order completion (all payments done)
  // which is detected by the payment workflow updating order status

  // Wait for order completion (with periodic checks)
  // In practice, this would query order status or wait for a signal
  // For demo, we assume order is completed by external payment workflows

  return {
    success: true,
    orderId: order.orderId,
    status: 'ACTIVE',
    firstPayment: firstPayment,
  };
}

// Separate workflow for delivery process (started when order is COMPLETED)
export async function deliveryWorkflow(input: DeliveryInput): Promise<DeliveryResult> {
  let deliveryApproved = false;
  let deliveryStatus: DeliveryStatus = 'PENDING';
  let adminApprovalData: AdminApproval | null = null;

  // Wait for admin approval
  setHandler(approveDeliverySignal, (data) => {
    deliveryApproved = true;
    adminApprovalData = data;
  });

  // Wait up to 7 days for approval
  const approved = await condition(() => deliveryApproved, '7 days');

  if (!approved) {
    // Auto-escalate after 7 days
    return {
      success: false,
      status: 'ESCALATED',
      reason: 'Approval timeout - requires manual intervention',
    };
  }

  // Process delivery steps
  deliveryStatus = 'APPROVED';
  await processDelivery(input.orderId, 'APPROVED');

  // Wait for shipment confirmation
  setHandler(updateDeliveryStatusSignal, (status) => {
    deliveryStatus = status as DeliveryStatus;
  });

  // Wait for DELIVERED status
  await condition(() => deliveryStatus === 'DELIVERED', '30 days');

  return {
    success: true,
    status: deliveryStatus,
    completedAt: new Date().toISOString(),
  };
}
```

### 6.5 Temporal Worker Setup

```typescript
// workers/worker.ts
import { Worker, NativeConnection } from '@temporalio/worker';
import * as autopayActivities from '../activities/autopayActivities';
import * as paymentActivities from '../activities/paymentActivities';
import * as orderActivities from '../activities/orderActivities';

async function run() {
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  const worker = await Worker.create({
    connection,
    namespace: 'default',
    taskQueue: 'epi-backend',
    workflowsPath: require.resolve('../workflows'),
    activities: {
      ...autopayActivities,
      ...paymentActivities,
      ...orderActivities,
    },
    maxConcurrentActivityExecutions: 100,
    maxConcurrentWorkflowTaskExecutions: 100,
  });

  console.log('Temporal worker started');
  await worker.run();
}

run().catch((err) => {
  console.error('Worker error:', err);
  process.exit(1);
});
```

### 6.6 Scheduled Autopay Trigger (replacing cron)

```typescript
// schedules/autopaySchedule.ts
import { Client, Connection } from '@temporalio/client';

async function setupAutopaySchedules() {
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  const client = new Client({ connection });

  // Morning 6 AM IST autopay
  await client.schedule.create({
    scheduleId: 'autopay-morning-6am',
    spec: {
      cronExpressions: ['30 0 * * *'], // 00:30 UTC = 6:00 IST
    },
    action: {
      type: 'startWorkflow',
      workflowType: 'autopayWorkflow',
      args: [{
        timeSlot: 'MORNING_6AM',
        date: new Date().toISOString().split('T')[0]
      }],
      taskQueue: 'epi-backend',
      workflowId: `autopay-morning-${Date.now()}`,
    },
  });

  // Afternoon 12 PM IST autopay
  await client.schedule.create({
    scheduleId: 'autopay-afternoon-12pm',
    spec: {
      cronExpressions: ['30 6 * * *'], // 06:30 UTC = 12:00 IST
    },
    action: {
      type: 'startWorkflow',
      workflowType: 'autopayWorkflow',
      args: [{
        timeSlot: 'AFTERNOON_12PM',
        date: new Date().toISOString().split('T')[0]
      }],
      taskQueue: 'epi-backend',
      workflowId: `autopay-afternoon-${Date.now()}`,
    },
  });

  // Evening 6 PM IST autopay
  await client.schedule.create({
    scheduleId: 'autopay-evening-6pm',
    spec: {
      cronExpressions: ['30 12 * * *'], // 12:30 UTC = 18:00 IST
    },
    action: {
      type: 'startWorkflow',
      workflowType: 'autopayWorkflow',
      args: [{
        timeSlot: 'EVENING_6PM',
        date: new Date().toISOString().split('T')[0]
      }],
      taskQueue: 'epi-backend',
      workflowId: `autopay-evening-${Date.now()}`,
    },
  });

  console.log('Autopay schedules created');
}
```

---

## 7. Comparison: Current vs Temporal

### 7.1 Autopay Processing

| Aspect | Current (node-cron) | With Temporal |
|--------|---------------------|---------------|
| **Server crash mid-batch** | Lost progress, manual recovery | Auto-resume from checkpoint |
| **User processing failure** | Logged only, no retry | Automatic retry with backoff |
| **Duplicate execution** | Possible on clock skew | Workflow ID prevents duplicates |
| **Observability** | Console logs only | Full event history, metrics |
| **Pause/Resume** | Not supported | Native Signal support |
| **Testing** | Difficult | Time-skipping test framework |

### 7.2 Payment Processing

| Aspect | Current | With Temporal |
|--------|---------|---------------|
| **Partial failure** | Inconsistent state possible | Saga compensation |
| **Razorpay timeout** | Stuck order | Configurable retry |
| **Commission failure** | Silent failure | Tracked, retryable |
| **Idempotency** | Manual implementation | Workflow ID-based |
| **Debugging** | Read logs | Replay execution |

### 7.3 Long-Running Processes

| Aspect | Current | With Temporal |
|--------|---------|---------------|
| **Order lifecycle** | Manual state tracking | Workflow state |
| **Human approval** | API polling | Native Signals |
| **Timer-based actions** | node-cron polling | Durable timers |
| **Multi-step orchestration** | Service calls | Child Workflows |

---

## 8. Risk Assessment & Mitigation

### 8.1 Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Learning curve | Medium | TypeScript familiarity helps, good documentation |
| Infrastructure complexity | High | Start with Temporal Cloud managed service |
| Migration downtime | High | Gradual migration, feature flags |
| MongoDB transaction compatibility | Medium | Activities can use existing service layer |

### 8.2 Mitigation Strategy

1. **Start small**: Migrate KYC auto-approve first (low risk)
2. **Run parallel**: Keep cron jobs running while testing Temporal
3. **Feature flags**: Toggle between old and new implementations
4. **Monitoring**: Set up alerts for workflow failures

---

## 9. Resource Requirements

### 9.1 Infrastructure

| Component | Development | Production |
|-----------|-------------|------------|
| Temporal Server | Docker Compose | Temporal Cloud or K8s |
| Workers | 1 process | 3+ for HA |
| Database | SQLite (dev) | PostgreSQL cluster |

### 9.2 Code Changes

| Area | Estimated LOC |
|------|---------------|
| Workflows | ~500 |
| Activities | ~800 |
| Worker setup | ~100 |
| Schedule setup | ~100 |
| **Total** | **~1,500** |

---

## 10. Recommendations

### 10.1 Immediate Actions

1. **Set up Temporal development environment** using Docker Compose
2. **Migrate KYC auto-approve** as proof of concept (lowest risk)
3. **Add Temporal metrics** to existing monitoring stack

### 10.2 Short-Term (1-2 months)

1. **Migrate autopay processing** to Temporal Workflows
2. **Implement payment saga** with compensation
3. **Remove node-cron dependency** for migrated flows

### 10.3 Long-Term (3-6 months)

1. **Migrate order lifecycle** to Workflows
2. **Implement delivery approval** with Signals
3. **Add child workflows** for bulk orders
4. **Full observability** through Temporal UI

---

## 11. Conclusion

Temporal integration is **highly recommended** for the EPI Backend system. The current architecture has multiple brittle patterns that would benefit from durable execution:

1. **Autopay cron jobs** lack durability and retry capabilities
2. **Payment processing** has partial failure scenarios without compensation
3. **Order lifecycle** involves manual state machine management
4. **Human-in-the-loop** approvals require polling instead of signals

Temporal would provide:
- Automatic state persistence across infrastructure failures
- Built-in retry policies for external API calls (Razorpay, FCM)
- Event history for debugging and compliance
- Native support for long-running processes and human approval flows

The migration can be done incrementally, starting with low-risk workflows (KYC auto-approve) and progressing to critical paths (autopay, payments).

---

## Appendix A: File References

| Current File | Temporal Migration Target |
|--------------|---------------------------|
| [jobs/autopayCron.js](jobs/autopayCron.js) | `workflows/autopayWorkflow.ts` |
| [services/installmentPaymentService.js](services/installmentPaymentService.js) | `workflows/paymentWorkflow.ts` |
| [services/installmentOrderService.js](services/installmentOrderService.js) | `workflows/orderWorkflow.ts` |
| [services/autopayService.js](services/autopayService.js) | `activities/autopayActivities.ts` |
| [services/installmentWalletService.js](services/installmentWalletService.js) | `activities/walletActivities.ts` |
| [jobs/notificationCron.js](jobs/notificationCron.js) | `workflows/notificationWorkflow.ts` |
| [services/kycAutoApproveService.js](services/kycAutoApproveService.js) | `workflows/kycWorkflow.ts` |

---

*Report generated: January 2026*
*Analyzed by: Backend Architecture Audit System*
