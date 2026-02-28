/**
 * Webhook Routes
 *
 * CRITICAL — route ordering in index.js:
 *   This file MUST be mounted BEFORE app.use(express.json(...)).
 *   Razorpay webhook signature verification requires the raw request body
 *   (a Buffer).  If express.json() processes the body first, the raw bytes
 *   are gone and every HMAC check will fail.
 *
 *   Correct order in index.js:
 *     app.use('/api/webhooks', require('./routes/webhook'));  // ← first
 *     app.use(express.json({ limit: '10mb' }));              // ← after
 *
 *   express.raw() is applied per-route here, so all other routes are
 *   completely unaffected.
 *
 * Razorpay Dashboard setup:
 *   URL:     https://api.epielio.com/api/webhook/razorpay
 *   Secret:  RAZORPAY_WEBHOOK_SECRET  (env var — different from RAZORPAY_KEY_SECRET)
 *   Events:  payment.captured, payment.failed
 */

const express = require('express');
const router  = express.Router();
const { handleRazorpayWebhook } = require('../controllers/webhookController');

/**
 * POST /api/webhooks/razorpay
 *
 * Receives Razorpay payment events.
 * express.raw() gives req.body as a Buffer — required for HMAC verification.
 * No JWT auth middleware — security is handled by X-Razorpay-Signature.
 */
router.post(
  '/razorpay',
  express.raw({ type: 'application/json' }),
  handleRazorpayWebhook
);

module.exports = router;
