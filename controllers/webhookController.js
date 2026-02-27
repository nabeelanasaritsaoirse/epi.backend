/**
 * Razorpay Webhook Controller
 *
 * Handles server-side payment event notifications from Razorpay.
 * This is the secure way to capture payment status — Razorpay calls this
 * endpoint directly, so it cannot be faked by a malicious client.
 *
 * Supported Events:
 *   - payment.captured  → enrich PaymentRecord with full Razorpay data
 *   - payment.failed    → mark PaymentRecord as FAILED + store error details
 *   - refund.created    → add refund entry to PaymentRecord.refunds[]
 *   - refund.processed  → update refund status to 'processed'
 *   - refund.failed     → update refund status to 'failed'
 *
 * Security: Every request is verified against RAZORPAY_WEBHOOK_SECRET
 * before any processing occurs.
 *
 * Registration: This route MUST be mounted before express.json() in index.js
 * so that req.body contains the raw Buffer needed for HMAC verification.
 */

const crypto = require('crypto');
const PaymentRecord = require('../models/PaymentRecord');
const razorpay = require('../config/razorpay');

// ============================================================
// HELPER — Map Razorpay payment entity to PaymentRecord fields
// ============================================================

/**
 * Maps a full Razorpay payment object (from API fetch) onto a PaymentRecord document.
 * All fields are optional — if Razorpay doesn't return a value, the field stays null.
 *
 * @param {Object} record - Mongoose PaymentRecord document
 * @param {Object} rzpPayment - Razorpay payment entity from razorpay.payments.fetch()
 */
function mapRazorpayPaymentToRecord(record, rzpPayment) {
  // Core fields
  record.razorpayAmount       = rzpPayment.amount        ?? null;
  record.razorpayCurrency     = rzpPayment.currency       ?? null;
  record.razorpayStatus       = rzpPayment.status         ?? null;
  record.razorpayMethod       = rzpPayment.method         ?? null;
  record.razorpayCaptured     = rzpPayment.captured       ?? null;
  record.razorpayFee          = rzpPayment.fee            ?? null;
  record.razorpayTax          = rzpPayment.tax            ?? null;
  record.razorpayEmail        = rzpPayment.email          ?? null;
  record.razorpayContact      = rzpPayment.contact        ?? null;
  record.razorpayInternational = rzpPayment.international ?? false;
  record.razorpayNotes        = rzpPayment.notes          ?? {};
  record.razorpayAmountRefunded = rzpPayment.amount_refunded ?? 0;
  record.razorpayRefundStatus = rzpPayment.refund_status  ?? null;

  if (rzpPayment.created_at) {
    record.razorpayCreatedAt = new Date(rzpPayment.created_at * 1000); // Unix → Date
  }

  // Acquirer data (bank-level references available on all methods)
  if (rzpPayment.acquirer_data) {
    const a = rzpPayment.acquirer_data;
    record.acquirerData = {
      rrn:               a.rrn                ?? null,
      authCode:          a.auth_code          ?? null,
      bankTransactionId: a.bank_transaction_id ?? null,
      upiTransactionId:  a.upi_transaction_id  ?? null,
      arn:               a.arn                ?? null
    };
  }

  // Method-specific details
  switch (rzpPayment.method) {
    case 'card': {
      const c = rzpPayment.card || {};
      record.cardDetails = {
        cardId:        c.id            ?? null,
        name:          c.name          ?? null,
        last4:         c.last4         ?? null,
        network:       c.network       ?? null,
        type:          c.type          ?? null,
        issuer:        c.issuer        ?? null,
        international: c.international ?? false,
        subType:       c.sub_type      ?? null,
        iin:           c.iin           ?? null
      };
      break;
    }
    case 'upi': {
      const u = rzpPayment.upi || {};
      record.upiDetails = {
        vpa:      rzpPayment.vpa ?? u.vpa  ?? null,
        username: u.username               ?? null,
        handle:   u.handle                 ?? null
      };
      break;
    }
    case 'netbanking': {
      record.netbankingDetails = {
        bank:     rzpPayment.bank     ?? null,
        bankName: rzpPayment.bank_name ?? null
      };
      break;
    }
    case 'wallet': {
      record.walletDetails = {
        wallet: rzpPayment.wallet ?? null
      };
      break;
    }
    case 'emi': {
      const e = rzpPayment.emi || {};
      record.emiDetails = {
        issuer:        e.issuer         ?? null,
        rate:          e.rate           ?? null,
        duration:      e.duration       ?? null,
        monthlyAmount: e.monthly_amount ?? null
      };
      break;
    }
  }
}

// ============================================================
// HELPER — Map Razorpay error payload to PaymentRecord fields
// ============================================================

/**
 * @param {Object} record - Mongoose PaymentRecord document
 * @param {Object} errorObj - error object from Razorpay webhook payload
 */
function mapRazorpayErrorToRecord(record, errorObj) {
  if (!errorObj) return;
  record.errorCode        = errorObj.code        ?? null;
  record.errorDescription = errorObj.description ?? null;
  record.errorSource      = errorObj.source      ?? null;
  record.errorStep        = errorObj.step        ?? null;
  record.errorReason      = errorObj.reason      ?? null;
}

// ============================================================
// MAIN WEBHOOK HANDLER
// ============================================================

/**
 * POST /api/webhook/razorpay
 *
 * Entry point for all Razorpay webhook events.
 * Mounted with express.raw() so req.body is a Buffer for HMAC verification.
 */
exports.handleRazorpayWebhook = async (req, res) => {
  // --- 1. Verify webhook signature ---
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('❌ RAZORPAY_WEBHOOK_SECRET not set in environment');
    return res.status(500).json({ success: false, message: 'Webhook secret not configured' });
  }

  const receivedSignature = req.headers['x-razorpay-signature'];
  if (!receivedSignature) {
    console.warn('⚠️  Webhook received without signature header');
    return res.status(400).json({ success: false, message: 'Missing signature' });
  }

  // req.body is a raw Buffer (express.raw middleware)
  const rawBody = req.body;
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (expectedSignature !== receivedSignature) {
    console.warn('⚠️  Webhook signature mismatch — possible spoofed request');
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }

  // --- 2. Parse the verified payload ---
  let payload;
  try {
    payload = JSON.parse(rawBody.toString());
  } catch {
    return res.status(400).json({ success: false, message: 'Invalid JSON payload' });
  }

  const event   = payload.event;
  const entity  = payload.payload?.payment?.entity
                  || payload.payload?.refund?.entity
                  || null;

  console.log(`📩 Razorpay webhook: ${event}`);

  // --- 3. Always respond 200 immediately (Razorpay retries on non-200) ---
  // We process async after responding to avoid timeout retries.
  res.status(200).json({ success: true, message: 'Webhook received' });

  // --- 4. Process event asynchronously ---
  try {
    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(entity);
        break;
      case 'payment.failed':
        await handlePaymentFailed(entity, payload.payload?.payment?.error);
        break;
      case 'refund.created':
        await handleRefundCreated(payload.payload?.refund?.entity);
        break;
      case 'refund.processed':
        await handleRefundUpdated(payload.payload?.refund?.entity, 'processed');
        break;
      case 'refund.failed':
        await handleRefundUpdated(payload.payload?.refund?.entity, 'failed');
        break;
      default:
        console.log(`ℹ️  Unhandled webhook event: ${event}`);
    }
  } catch (err) {
    // Log but do NOT re-respond (we already sent 200)
    console.error(`❌ Error processing webhook event "${event}":`, err.message);
  }
};

// ============================================================
// EVENT HANDLERS
// ============================================================

/**
 * payment.captured
 * Razorpay confirmed the payment — fetch full details from API and enrich PaymentRecord.
 */
async function handlePaymentCaptured(paymentEntity) {
  if (!paymentEntity) {
    console.error('❌ payment.captured: No payment entity in payload');
    return;
  }

  const rzpPaymentId = paymentEntity.id;
  const rzpOrderId   = paymentEntity.order_id;

  if (!rzpOrderId) {
    console.warn(`⚠️  payment.captured: No order_id on payment ${rzpPaymentId}`);
    return;
  }

  // Find the PaymentRecord by Razorpay order ID
  const record = await PaymentRecord.findOne({ razorpayOrderId: rzpOrderId });
  if (!record) {
    console.warn(`⚠️  payment.captured: No PaymentRecord for razorpayOrderId=${rzpOrderId}`);
    return;
  }

  // Idempotency guard — skip if this exact payment was already verified
  // Razorpay can retry webhooks; we must not overwrite a good COMPLETED record
  if (record.razorpayVerified && record.razorpayPaymentId === rzpPaymentId) {
    console.log(`ℹ️  payment.captured: already processed ${rzpPaymentId}, skipping`);
    return;
  }

  // Fetch full payment details from Razorpay API (includes fee, tax, card, upi details)
  let fullPayment;
  try {
    fullPayment = await razorpay.payments.fetch(rzpPaymentId);
  } catch (err) {
    console.error(`❌ Failed to fetch payment ${rzpPaymentId} from Razorpay API:`, err.message);
    // Fall back to using the webhook payload directly
    fullPayment = paymentEntity;
  }

  // Map all fields onto the record
  mapRazorpayPaymentToRecord(record, fullPayment);

  // Update verification and status
  record.razorpayPaymentId = rzpPaymentId;
  record.razorpayVerified  = true;
  record.status            = 'COMPLETED';
  record.completedAt       = record.completedAt || new Date();

  await record.save();
  console.log(`✅ PaymentRecord enriched: ${record.paymentId} (Razorpay: ${rzpPaymentId})`);
}

/**
 * payment.failed
 * Payment attempt failed — update status and store Razorpay error details.
 */
async function handlePaymentFailed(paymentEntity, errorObj) {
  if (!paymentEntity) {
    console.error('❌ payment.failed: No payment entity in payload');
    return;
  }

  const rzpOrderId = paymentEntity.order_id;
  if (!rzpOrderId) return;

  const record = await PaymentRecord.findOne({ razorpayOrderId: rzpOrderId });
  if (!record) {
    console.warn(`⚠️  payment.failed: No PaymentRecord for razorpayOrderId=${rzpOrderId}`);
    return;
  }

  // Only update if not already completed (prevent overwriting a success)
  if (record.status === 'COMPLETED') {
    console.log(`ℹ️  Skipping failed event — PaymentRecord ${record.paymentId} already COMPLETED`);
    return;
  }

  mapRazorpayPaymentToRecord(record, paymentEntity);
  mapRazorpayErrorToRecord(record, errorObj || paymentEntity.error);

  record.status    = 'FAILED';
  record.failedAt  = new Date();
  record.retryCount += 1;

  await record.save();
  console.log(`⚠️  PaymentRecord marked FAILED: ${record.paymentId} (reason: ${record.errorReason})`);
}

/**
 * refund.created
 * A refund was initiated (from admin dashboard or Razorpay dashboard).
 * Add or update the refund entry in PaymentRecord.refunds[].
 */
async function handleRefundCreated(refundEntity) {
  if (!refundEntity) return;

  const rzpPaymentId = refundEntity.payment_id;
  const record = await PaymentRecord.findOne({ razorpayPaymentId: rzpPaymentId });
  if (!record) {
    console.warn(`⚠️  refund.created: No PaymentRecord for razorpayPaymentId=${rzpPaymentId}`);
    return;
  }

  // Idempotency guard — avoid double-processing on webhook retry
  const alreadyExists = record.refunds.some(r => r.razorpayRefundId === refundEntity.id);
  if (alreadyExists) {
    console.log(`ℹ️  refund.created: ${refundEntity.id} already recorded, skipping`);
    return;
  }

  record.refunds.push({
    razorpayRefundId: refundEntity.id,
    amount:           refundEntity.amount,
    status:           refundEntity.status || 'pending',
    speedProcessed:   refundEntity.speed_processed ?? null,
    arn:              refundEntity.arn ?? null,
    createdAt:        refundEntity.created_at
      ? new Date(refundEntity.created_at * 1000)
      : new Date()
  });

  // Keep razorpayAmountRefunded in sync.
  // Prefer Razorpay's authoritative total if provided; otherwise accumulate.
  // This update is inside the alreadyExists guard so it only runs once per refund.
  record.razorpayAmountRefunded = refundEntity.payment_amount_refunded
    ?? (record.razorpayAmountRefunded + refundEntity.amount);

  // Determine overall refund status
  if (record.razorpayAmountRefunded >= (record.razorpayAmount || record.amount * 100)) {
    record.status               = 'REFUNDED';
    record.razorpayRefundStatus = 'full';
  } else {
    record.razorpayRefundStatus = 'partial';
  }

  await record.save();
  console.log(`💸 Refund recorded on PaymentRecord ${record.paymentId}: ₹${refundEntity.amount / 100}`);
}

/**
 * refund.processed / refund.failed
 * Update the status of an existing refund entry.
 */
async function handleRefundUpdated(refundEntity, newStatus) {
  if (!refundEntity) return;

  const rzpPaymentId = refundEntity.payment_id;
  const record = await PaymentRecord.findOne({ razorpayPaymentId: rzpPaymentId });
  if (!record) return;

  const refundEntry = record.refunds.find(r => r.razorpayRefundId === refundEntity.id);
  if (refundEntry) {
    refundEntry.status        = newStatus;
    refundEntry.speedProcessed = refundEntity.speed_processed ?? refundEntry.speedProcessed;
    refundEntry.arn           = refundEntity.arn              ?? refundEntry.arn;
  }

  await record.save();
  console.log(`🔄 Refund ${refundEntity.id} status → ${newStatus} on PaymentRecord ${record.paymentId}`);
}
