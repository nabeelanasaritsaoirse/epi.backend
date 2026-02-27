/**
 * Razorpay Webhook Routes
 *
 * IMPORTANT: This file must be imported and mounted in index.js
 * BEFORE app.use(express.json()) so that req.body remains a raw Buffer.
 * The HMAC signature verification in webhookController requires the raw body.
 *
 * Mount in index.js:
 *   const webhookRoutes = require('./routes/webhook');
 *   app.use('/api/webhook', webhookRoutes);   // <-- BEFORE express.json()
 */

const express = require('express');
const router  = express.Router();
const webhookController = require('../controllers/webhookController');

/**
 * POST /api/webhook/razorpay
 *
 * Receives Razorpay payment events.
 * express.raw() captures the body as a Buffer so we can compute the HMAC
 * signature for verification before parsing the JSON.
 *
 * Configure in Razorpay Dashboard:
 *   Webhook URL:    https://api.epielio.com/api/webhook/razorpay
 *   Secret:         value of RAZORPAY_WEBHOOK_SECRET in .env
 *   Active Events:  payment.captured, payment.failed,
 *                   refund.created, refund.processed, refund.failed
 */
router.post(
  '/razorpay',
  express.raw({ type: 'application/json' }),
  webhookController.handleRazorpayWebhook
);

module.exports = router;
