/**
 * WebhookEvent Model
 *
 * Tracks every Razorpay webhook event received by the server.
 * Serves two purposes:
 *
 *  1. Idempotency — before processing any event, the controller checks
 *     for an existing document with the same razorpayEventId.  If one
 *     exists the event is silently acknowledged (HTTP 200) without
 *     double-crediting the user.  The unique index on razorpayEventId
 *     also prevents race conditions across multiple server instances:
 *     the second concurrent insert throws a duplicate-key error (code
 *     11000) which the controller catches and treats as "already handled".
 *
 *  2. Audit trail — every received payload is stored in rawPayload so
 *     support can replay or investigate any payment event.
 *
 * Retention: a 90-day TTL index auto-deletes old documents so the
 * collection never grows unbounded (Razorpay retries span only 24 h).
 */

const mongoose = require('mongoose');

const webhookEventSchema = new mongoose.Schema(
  {
    // Composite key: razorpayPaymentId + ':' + eventType
    // e.g. "pay_ABC123:payment.captured"
    // Globally unique per (payment, event-type) pair.
    razorpayEventId: {
      type:     String,
      required: true,
      unique:   true,
      index:    true
    },

    razorpayPaymentId: { type: String, default: null, index: true },
    razorpayOrderId:   { type: String, default: null, index: true },

    // e.g. 'payment.captured' | 'payment.failed'
    eventType: { type: String, required: true },

    // Processing lifecycle
    status: {
      type:    String,
      enum:    ['received', 'processing', 'processed', 'failed', 'ignored'],
      default: 'received'
    },

    // Derived from Razorpay order notes
    paymentType: {
      type:    String,
      enum:    ['deposit', 'daily_installment', 'first_payment', 'combined_daily_payment', 'unknown'],
      default: 'unknown'
    },

    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    amountPaisa: { type: Number, default: 0 },

    // Full raw payload stored for debugging / support replay
    rawPayload: { type: Object, default: {} },

    // Human-readable result or error message
    processingNote: { type: String, default: null },

    receivedAt:  { type: Date, default: Date.now },
    processedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// Quick duplicate checks
webhookEventSchema.index({ razorpayPaymentId: 1, eventType: 1 });
webhookEventSchema.index({ status: 1, receivedAt: -1 });

// Auto-delete after 90 days — well beyond Razorpay's 24-hour retry window
webhookEventSchema.index(
  { receivedAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);
