/**
 * Razorpay Webhook Controller
 *
 * Handles server-to-server payment events from Razorpay, making the system
 * resilient to Flutter app crashes that occur after payment but before the
 * client calls verify-payment.
 *
 * Security model:
 *   Every request is verified with HMAC-SHA256 over the raw body using
 *   RAZORPAY_WEBHOOK_SECRET (set in Razorpay Dashboard → Settings → Webhooks).
 *   This is completely separate from the per-payment RAZORPAY_KEY_SECRET used
 *   for client-side signature verification.
 *
 * Idempotency model:
 *   A WebhookEvent document is inserted (unique index on razorpayEventId)
 *   before any business logic runs.  Duplicate deliveries — or race conditions
 *   across multiple server instances — are caught by the 11000 duplicate-key
 *   error and return HTTP 200 immediately without re-processing.
 *
 * HTTP response policy:
 *   Always return HTTP 200, even on signature failure or processing errors.
 *   Razorpay retries events that receive non-2xx responses for up to 24 hours.
 *   We never want infinite retries for events we intentionally ignore.
 *
 * Events handled:
 *   payment.captured — credit the user (wallet deposit or installment payment)
 *   payment.failed   — mark the pending record as failed
 */

'use strict';

const crypto        = require('crypto');
const WebhookEvent  = require('../models/WebhookEvent');
const Transaction   = require('../models/Transaction');
const PaymentRecord = require('../models/PaymentRecord');
const InstallmentOrder = require('../models/InstallmentOrder');
const recalcWallet  = require('../services/walletCalculator');

// ─────────────────────────────────────────────────────────────────────────────
// SIGNATURE VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify Razorpay webhook HMAC-SHA256 signature.
 *
 * @param {Buffer} rawBody   - Raw request body from express.raw()
 * @param {string} signature - Value of X-Razorpay-Signature header
 * @returns {boolean}
 */
function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[Webhook] RAZORPAY_WEBHOOK_SECRET is not set');
    return false;
  }
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  try {
    // timingSafeEqual prevents timing-based signature oracle attacks
    return crypto.timingSafeEqual(
      Buffer.from(expected,  'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch {
    // Throws if buffers have different lengths (tampered / missing header)
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/webhooks/razorpay
 */
exports.handleRazorpayWebhook = async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody   = req.body; // Buffer from express.raw()

  // 1. Verify signature — reject invalid requests but always return 200
  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    console.warn('[Webhook] Invalid or missing signature — ignoring');
    return res.status(200).json({ status: 'ignored', reason: 'invalid_signature' });
  }

  // 2. Parse JSON after signature check (raw bytes were needed above)
  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    console.error('[Webhook] Failed to parse body as JSON');
    return res.status(200).json({ status: 'ignored', reason: 'parse_error' });
  }

  const eventType     = payload.event;
  const paymentEntity = payload?.payload?.payment?.entity;

  if (!eventType || !paymentEntity) {
    console.warn('[Webhook] Unexpected payload structure');
    return res.status(200).json({ status: 'ignored', reason: 'unexpected_structure' });
  }

  const razorpayPaymentId = paymentEntity.id;
  const razorpayOrderId   = paymentEntity.order_id;
  const amountPaisa       = paymentEntity.amount;

  console.log(`[Webhook] ${eventType} | pay=${razorpayPaymentId} | order=${razorpayOrderId}`);

  // 3. Build idempotency key: payment ID + event type
  const razorpayEventId = `${razorpayPaymentId}:${eventType}`;

  // 4. Guard: check for an already-processed event
  const existing = await WebhookEvent.findOne({ razorpayEventId });
  if (existing) {
    console.log(`[Webhook] Duplicate ${razorpayEventId} (${existing.status}) — skipping`);
    return res.status(200).json({ status: 'duplicate' });
  }

  // 5. Claim the event by inserting a 'processing' record.
  //    The unique index turns any concurrent duplicate insert into an 11000 error.
  const record = new WebhookEvent({
    razorpayEventId,
    razorpayPaymentId,
    razorpayOrderId,
    eventType,
    status:     'processing',
    amountPaisa,
    rawPayload: payload,
    receivedAt: new Date()
  });

  try {
    await record.save();
  } catch (saveErr) {
    if (saveErr.code === 11000) {
      console.log(`[Webhook] Race condition on ${razorpayEventId} — another instance claimed it`);
      return res.status(200).json({ status: 'duplicate', reason: 'race_condition' });
    }
    // Non-duplicate save error — log and continue; processing must still happen
    console.error('[Webhook] WebhookEvent save error:', saveErr.message);
  }

  // 6. Dispatch to the appropriate handler
  try {
    if (eventType === 'payment.captured') {
      await handlePaymentCaptured(paymentEntity, record);
    } else if (eventType === 'payment.failed') {
      await handlePaymentFailed(paymentEntity, record);
    } else {
      record.status = 'ignored';
      record.processingNote = `Unhandled event: ${eventType}`;
      await record.save();
    }

    return res.status(200).json({ status: 'ok' });

  } catch (err) {
    console.error(`[Webhook] Handler error for ${razorpayEventId}:`, err.message);
    try {
      record.status = 'failed';
      record.processingNote = err.message;
      await record.save();
    } catch { /* best-effort */ }
    // Return 200 — Razorpay must not retry a server-side bug endlessly
    return res.status(200).json({ status: 'processing_error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// payment.captured
// ─────────────────────────────────────────────────────────────────────────────

async function handlePaymentCaptured(paymentEntity, record) {
  const notes             = paymentEntity.notes || {};
  const razorpayOrderId   = paymentEntity.order_id;
  const razorpayPaymentId = paymentEntity.id;
  const amountRupees      = paymentEntity.amount / 100;
  const paymentType       = determinePaymentType(notes);

  record.paymentType = paymentType;

  switch (paymentType) {
    case 'deposit':
      await handleWalletDeposit(razorpayOrderId, razorpayPaymentId, amountRupees, record);
      break;
    case 'daily_installment':
      await handleDailyInstallment(notes, razorpayOrderId, razorpayPaymentId, record);
      break;
    case 'first_payment':
      await handleFirstPayment(notes, razorpayOrderId, razorpayPaymentId, record);
      break;
    case 'combined_daily_payment':
      await handleCombinedDailyPayment(notes, razorpayOrderId, razorpayPaymentId, record);
      break;
    default:
      record.status = 'ignored';
      record.processingNote = `Unknown payment type. notes=${JSON.stringify(notes)}`;
      await record.save();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// payment.failed
// ─────────────────────────────────────────────────────────────────────────────

async function handlePaymentFailed(paymentEntity, record) {
  const notes             = paymentEntity.notes || {};
  const razorpayOrderId   = paymentEntity.order_id;
  const razorpayPaymentId = paymentEntity.id;
  const reason            = paymentEntity.error_description || 'Payment failed';
  const paymentType       = determinePaymentType(notes);

  record.paymentType = paymentType;

  if (paymentType === 'deposit') {
    const tx = await Transaction.findOne({
      'paymentDetails.orderId': razorpayOrderId,
      status: 'pending',
      type:   'deposit'
    });
    if (tx) {
      tx.status = 'failed';
      tx.paymentDetails.paymentId = razorpayPaymentId;
      await tx.save();
      record.userId = tx.user;
      console.log(`[Webhook] Deposit Transaction ${tx._id} marked failed`);
    } else {
      console.warn(`[Webhook] payment.failed: no pending deposit for order ${razorpayOrderId}`);
    }
  } else {
    // daily_installment / first_payment / combined
    const pr = await PaymentRecord.findOne({
      razorpayOrderId,
      status: { $in: ['PENDING', 'PROCESSING'] }
    });
    if (pr) {
      pr.status   = 'FAILED';
      pr.failedAt = new Date();
      await pr.save();
      console.log(`[Webhook] PaymentRecord ${pr.paymentId} marked FAILED`);
    } else {
      console.warn(`[Webhook] payment.failed: no pending PaymentRecord for order ${razorpayOrderId}`);
    }
  }

  record.status         = 'processed';
  record.processingNote = `Failed: ${reason}`;
  record.processedAt    = new Date();
  await record.save();
}

// ─────────────────────────────────────────────────────────────────────────────
// Wallet deposit handler
// Replicates the exact logic of routes/wallet.js verify-payment (lines 148-156)
// ─────────────────────────────────────────────────────────────────────────────

async function handleWalletDeposit(razorpayOrderId, razorpayPaymentId, amountRupees, record) {
  const tx = await Transaction.findOne({
    'paymentDetails.orderId': razorpayOrderId,
    type: 'deposit'
  });

  if (!tx) {
    record.status         = 'failed';
    record.processingNote = `No deposit Transaction found for orderId ${razorpayOrderId}`;
    await record.save();
    return;
  }

  if (tx.status === 'completed') {
    // Client verify-payment already ran — nothing to do
    record.status         = 'ignored';
    record.processingNote = 'Transaction already completed (client verified first)';
    record.userId         = tx.user;
    await record.save();
    return;
  }

  tx.status = 'completed';
  tx.paymentDetails.paymentId = razorpayPaymentId;
  await tx.save();

  await recalcWallet(tx.user);

  record.status         = 'processed';
  record.userId         = tx.user;
  record.processedAt    = new Date();
  record.processingNote = `Wallet deposit ₹${amountRupees} credited. tx=${tx._id}`;
  await record.save();

  console.log(`[Webhook] Wallet deposit ₹${amountRupees} for user ${tx.user}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily installment payment handler
// ─────────────────────────────────────────────────────────────────────────────

async function handleDailyInstallment(notes, razorpayOrderId, razorpayPaymentId, record) {
  // Guard: already completed by client verify call?
  const done = await PaymentRecord.findOne({ razorpayOrderId, status: 'COMPLETED' });
  if (done) {
    record.status         = 'ignored';
    record.processingNote = `PaymentRecord ${done.paymentId} already COMPLETED`;
    await record.save();
    return;
  }

  const mongoOrderId = notes.orderId || notes.order_id;
  if (!mongoOrderId) {
    record.status         = 'failed';
    record.processingNote = 'Missing orderId in payment notes';
    await record.save();
    return;
  }

  const order = await InstallmentOrder.findById(mongoOrderId).catch(() => null);
  if (!order) {
    record.status         = 'failed';
    record.processingNote = `InstallmentOrder not found: ${mongoOrderId}`;
    await record.save();
    return;
  }

  record.userId = order.user;

  // Lazy-require avoids circular dependency issues at module load time
  const paymentService = require('../services/installmentPaymentService');
  try {
    const result = await paymentService.processPayment({
      orderId:           mongoOrderId,
      userId:            order.user.toString(),
      paymentMethod:     'WEBHOOK',      // bypasses client-side sig check in the service
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature: null            // already verified via webhook HMAC above
    });

    record.status         = 'processed';
    record.processedAt    = new Date();
    record.processingNote = `Installment processed. payment=${result.payment?.paymentId}`;
    await record.save();
    console.log(`[Webhook] Daily installment done for order ${mongoOrderId}`);

  } catch (err) {
    const alreadyDone = /already/i.test(err.message);
    record.status         = alreadyDone ? 'ignored' : 'failed';
    record.processingNote = err.message;
    await record.save();
    if (!alreadyDone) throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// First payment / order activation handler
// ─────────────────────────────────────────────────────────────────────────────

async function handleFirstPayment(notes, razorpayOrderId, razorpayPaymentId, record) {
  const mongoOrderId = notes.orderId || notes.order_id;
  if (!mongoOrderId) {
    record.status         = 'failed';
    record.processingNote = 'Missing orderId in notes for first_payment';
    await record.save();
    return;
  }

  const order = await InstallmentOrder.findById(mongoOrderId).catch(() => null);
  if (!order) {
    record.status         = 'failed';
    record.processingNote = `InstallmentOrder not found: ${mongoOrderId}`;
    await record.save();
    return;
  }

  record.userId = order.user;

  if (['ACTIVE', 'COMPLETED'].includes(order.status)) {
    record.status         = 'ignored';
    record.processingNote = `Order already ${order.status}`;
    await record.save();
    return;
  }

  const orderService = require('../services/installmentOrderService');
  try {
    await orderService.verifyFirstPayment({
      orderId:                   mongoOrderId,
      userId:                    order.user.toString(),
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature:         null,
      skipSignatureVerification: true  // authenticated via webhook HMAC-SHA256 at route entry
    });

    record.status         = 'processed';
    record.processedAt    = new Date();
    record.processingNote = `First payment verified, order ${order.orderId} activated`;
    await record.save();
    console.log(`[Webhook] Order ${order.orderId} activated via first payment`);

  } catch (err) {
    record.status         = 'failed';
    record.processingNote = err.message;
    await record.save();
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined multi-order daily payment handler
// ─────────────────────────────────────────────────────────────────────────────

async function handleCombinedDailyPayment(notes, razorpayOrderId, razorpayPaymentId, record) {
  const orderIdsString = notes.orderIds;
  const userId         = notes.userId;

  if (!orderIdsString || !userId) {
    record.status         = 'failed';
    record.processingNote = 'Missing orderIds or userId in notes';
    await record.save();
    return;
  }

  const selectedOrders = orderIdsString.split(',').map(id => id.trim()).filter(Boolean);
  record.userId = userId;

  // Guard: already fully processed?
  const completedCount = await PaymentRecord.countDocuments({
    razorpayOrderId,
    status: 'COMPLETED'
  });
  if (completedCount >= selectedOrders.length) {
    record.status         = 'ignored';
    record.processingNote = 'All orders already processed';
    await record.save();
    return;
  }

  const paymentService = require('../services/installmentPaymentService');
  try {
    const result = await paymentService.processSelectedDailyPayments({
      userId,
      selectedOrders,
      paymentMethod:     'WEBHOOK',
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature: null
    });

    record.status         = 'processed';
    record.processedAt    = new Date();
    record.processingNote = `Combined: ${result.ordersProcessed} orders, ₹${result.totalAmount}`;
    await record.save();
    console.log(`[Webhook] Combined payment: ${result.ordersProcessed} orders for user ${userId}`);

  } catch (err) {
    record.status         = 'failed';
    record.processingNote = err.message;
    await record.save();
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Determine payment type from Razorpay order notes
//
// Notes are set at order-creation time in the respective service/controller:
//
//   Wallet deposit (routes/wallet.js add-money):
//     no notes set → identified by absence of installment keys → 'deposit'
//
//   Legacy installment (paymentController.createDailyInstallmentOrder):
//     notes.payment_type = 'daily_installment'  |  notes.order_id = mongoId
//
//   Modern installment (installmentPaymentService.createRazorpayOrderForPayment):
//     notes.orderId = mongoOrderId  |  notes.installmentNumber = N
//
//   First payment (installmentOrderService, notes.type = 'first_payment'):
//     notes.orderId = mongoOrderId  |  notes.type = 'first_payment'
//
//   Combined daily payment (installmentPaymentService.createCombinedRazorpayOrder):
//     notes.type = 'combined_daily_payment'
//     notes.orderIds = 'id1,id2,id3'
// ─────────────────────────────────────────────────────────────────────────────

function determinePaymentType(notes) {
  if (notes.type === 'combined_daily_payment')    return 'combined_daily_payment';
  if (notes.type === 'first_payment')             return 'first_payment';
  if (notes.payment_type === 'daily_installment') return 'daily_installment';
  if (notes.orderId || notes.order_id)            return 'daily_installment';
  return 'deposit';
}
