# Automated Withdrawal System - Quick Start Guide

## Overview
This guide helps you quickly implement automated withdrawals using Razorpay X Payouts API.

---

## Prerequisites Checklist

### 1. Razorpay X Account Setup
- [ ] Activate Razorpay X on dashboard
- [ ] Complete business KYC (takes 24-48 hours)
- [ ] Add ₹10,000 to Razorpay X balance for testing
- [ ] Generate API keys (test mode first)

**Get Keys From:**
```
Dashboard → Settings → API Keys → RazorpayX Tab
```

### 2. Environment Variables
Add to your `.env` file:

```env
# Razorpay X (Payouts)
RAZORPAYX_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAYX_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAYX_ACCOUNT_NUMBER=2323230000000000

# Webhook Secret (generate random string)
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
```

### 3. Webhook Configuration
```
Dashboard → Settings → Developer Controls → Add Webhook

URL: https://your-domain.com/api/webhooks/razorpay/payouts
Secret: (use RAZORPAY_WEBHOOK_SECRET value)
Events: ☑ payout.processed, payout.failed, payout.reversed
```

---

## Installation Steps

### Step 1: Install Dependencies
```bash
# Already have razorpay v2.9.1, no new dependencies needed
npm install
```

### Step 2: Create Required Files

**File Structure:**
```
config/
  └── razorpayX.js                    # NEW

models/
  └── PayoutBeneficiary.js            # NEW

services/
  └── razorpayX/
      ├── contactService.js           # NEW
      ├── fundAccountService.js       # NEW
      ├── payoutService.js            # NEW
      └── webhookService.js           # NEW

routes/
  └── webhooks.js                     # NEW
  └── adminWallet.js                  # MODIFY (update approval endpoint)

index.js                              # MODIFY (add webhook route)
```

All code provided in the main guide: [AUTOMATED_WITHDRAWAL_IMPLEMENTATION_GUIDE.md](./AUTOMATED_WITHDRAWAL_IMPLEMENTATION_GUIDE.md)

### Step 3: Database Updates

**Update Transaction Model:**
```javascript
// Add to models/Transaction.js → paymentDetails object
razorpayPayoutId: String,
razorpayContactId: String,
razorpayFundAccountId: String,
razorpayPayoutStatus: String,
razorpayUTR: String,
razorpayPayoutMode: String,
razorpayFailureReason: String,
razorpayProcessedAt: Date,
razorpayIdempotencyKey: String
```

**Create PayoutBeneficiary Model:**
```javascript
// See section 4.1 in main guide for full schema
```

### Step 4: Implement Services

Copy all service files from the main guide:
- [contactService.js](./AUTOMATED_WITHDRAWAL_IMPLEMENTATION_GUIDE.md#72-contact-service)
- [fundAccountService.js](./AUTOMATED_WITHDRAWAL_IMPLEMENTATION_GUIDE.md#73-fund-account-service)
- [payoutService.js](./AUTOMATED_WITHDRAWAL_IMPLEMENTATION_GUIDE.md#74-payout-service)
- [webhookService.js](./AUTOMATED_WITHDRAWAL_IMPLEMENTATION_GUIDE.md#75-webhook-service)

### Step 5: Update Routes

**Modify admin approval endpoint:**
```javascript
// routes/adminWallet.js
// Replace existing /withdrawals/approve with version from section 7.6
```

**Create webhook route:**
```javascript
// routes/webhooks.js
// Copy from section 7.7
```

**Update index.js:**
```javascript
// Add webhook route
const webhookRoutes = require('./routes/webhooks');
app.use('/api/webhooks', webhookRoutes);
```

---

## Testing Flow

### Test in Test Mode First!

**1. Create Test Withdrawal**
```bash
POST /api/payments/withdraw
Headers: { Authorization: Bearer <user_token> }
Body: {
  "amount": 1000,
  "paymentMethod": "bank_transfer",
  "bankDetailsId": "<bank_details_id>"
}
```

**2. Admin Approves (triggers payout)**
```bash
POST /api/admin-wallet/withdrawals/approve
Headers: { Authorization: Bearer <admin_token> }
Body: {
  "transactionId": "<transaction_id>",
  "autoProcess": true
}
```

**3. Verify in Razorpay Dashboard**
```
Dashboard → RazorpayX → Payouts
Should see payout created with status "processed" (test mode is instant)
```

**4. Check Webhook Received**
```
Check your server logs for:
"📥 Webhook received: payout.processed"

Verify transaction status updated to "completed"
```

---

## Workflow Diagram

```
┌────────────────────────────────────────────────────────────┐
│ USER CREATES WITHDRAWAL REQUEST                           │
│ POST /api/payments/withdraw                               │
│ ✓ KYC verified                                            │
│ ✓ Wallet balance sufficient                              │
│ ✓ Bank details available                                 │
│ → Transaction created (status: pending)                   │
└─────────────────────┬──────────────────────────────────────┘
                      │
                      ↓
┌────────────────────────────────────────────────────────────┐
│ ADMIN APPROVES WITHDRAWAL                                 │
│ POST /api/admin-wallet/withdrawals/approve                │
│ → Creates Razorpay Contact (if not exists)               │
│ → Creates Fund Account (if not exists)                   │
│ → Creates Payout via Razorpay X                          │
│ → Transaction status: processing                          │
└─────────────────────┬──────────────────────────────────────┘
                      │
                      ↓
┌────────────────────────────────────────────────────────────┐
│ RAZORPAY PROCESSES PAYOUT                                 │
│ Status: queued → pending → processing → processed         │
│ Time: IMPS (instant), NEFT (2-3 hours)                   │
└─────────────────────┬──────────────────────────────────────┘
                      │
                      ↓
┌────────────────────────────────────────────────────────────┐
│ WEBHOOK NOTIFIES YOUR SERVER                              │
│ POST /api/webhooks/razorpay/payouts                       │
│ Event: payout.processed                                   │
│ → Updates transaction status: completed                   │
│ → Adds UTR number                                         │
│ → Sends notification to user                              │
└────────────────────────────────────────────────────────────┘
```

---

## API Endpoints Summary

### User Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/withdraw` | Create withdrawal request |
| GET | `/api/payments/withdrawals` | Get withdrawal history |

### Admin Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin-wallet/withdrawals` | List all withdrawals |
| POST | `/api/admin-wallet/withdrawals/approve` | Approve & auto-payout |
| POST | `/api/admin-wallet/withdrawals/reject` | Reject withdrawal |

### Webhook Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/razorpay/payouts` | Receive Razorpay webhooks |

---

## Common Issues & Quick Fixes

### Issue: "RazorpayX not configured"
**Fix:** Add RAZORPAYX_KEY_ID and RAZORPAYX_KEY_SECRET to .env

### Issue: "Invalid fund account"
**Fix:** Verify IFSC code and account number are correct

### Issue: "Webhook signature invalid"
**Fix:** Verify RAZORPAY_WEBHOOK_SECRET matches dashboard

### Issue: "Insufficient balance"
**Fix:** Add funds to Razorpay X account

### Issue: Webhook not received
**Fix:**
1. Check webhook URL is publicly accessible
2. Test with ngrok in local development
3. Verify webhook secret is correct

---

## Monitoring Dashboard Queries

### Get Payout Success Rate
```javascript
// Last 24 hours
const stats = await Transaction.aggregate([
  {
    $match: {
      type: 'withdrawal',
      createdAt: { $gte: new Date(Date.now() - 24*60*60*1000) }
    }
  },
  {
    $group: {
      _id: '$status',
      count: { $sum: 1 }
    }
  }
]);

// Calculate success rate
const completed = stats.find(s => s._id === 'completed')?.count || 0;
const total = stats.reduce((sum, s) => sum + s.count, 0);
const successRate = (completed / total * 100).toFixed(2);
console.log(`Success Rate: ${successRate}%`);
```

### Get Failed Payouts
```javascript
const failed = await Transaction.find({
  type: 'withdrawal',
  status: 'failed',
  'paymentDetails.razorpayFailureReason': { $exists: true }
})
.populate('user', 'name email phoneNumber')
.sort({ createdAt: -1 })
.limit(10);
```

---

## Security Checklist

Before going live:

- [ ] Use HTTPS for all endpoints
- [ ] Verify webhook signatures on every request
- [ ] Use idempotency keys for all payouts
- [ ] Enable rate limiting on approval endpoint
- [ ] Implement IP whitelisting for webhooks
- [ ] Hash/mask bank details in logs
- [ ] Enable audit logging
- [ ] Test with ₹100 in live mode first
- [ ] Monitor for 48 hours before full rollout
- [ ] Setup alerts for failed payouts

---

## Cost Estimate

### Razorpay X Charges
- IMPS: ₹5 + GST per transaction
- NEFT: ₹3 + GST per transaction
- UPI: ₹3 + GST per transaction

### Example (1000 withdrawals/month via IMPS)
```
Cost: 1000 × ₹5 = ₹5,000
GST (18%): ₹900
Total: ₹5,900/month

Savings vs Manual: ₹45,000/month
(assuming ₹50/withdrawal for manual processing)

ROI: 89% cost reduction
```

---

## Go-Live Checklist

### Pre-Launch
- [ ] All code tested in test mode
- [ ] Webhook delivery verified
- [ ] Error handling tested
- [ ] Security audit completed
- [ ] Backup database
- [ ] Switch to live API keys
- [ ] Update webhook URL to production

### Soft Launch
- [ ] Enable for 5-10 beta users
- [ ] Process first ₹100 withdrawal
- [ ] Verify actual bank credit
- [ ] Monitor for 24 hours

### Full Launch
- [ ] Enable for all users
- [ ] Monitor payout success rate
- [ ] Review webhook logs
- [ ] Setup 24/7 monitoring alerts

---

## Support Resources

### Documentation
- Main Guide: [AUTOMATED_WITHDRAWAL_IMPLEMENTATION_GUIDE.md](./AUTOMATED_WITHDRAWAL_IMPLEMENTATION_GUIDE.md)
- Razorpay X API: https://razorpay.com/docs/api/x/
- Webhook Events: https://razorpay.com/docs/api/x/webhooks/

### Razorpay Support
- Email: support@razorpay.com
- Phone: 1800-123-5555
- Dashboard: My Account → Support Tickets

---

## Next Steps

1. ✅ Review main implementation guide
2. ✅ Setup Razorpay X account
3. ✅ Add environment variables
4. ✅ Create service files
5. ✅ Update routes
6. ✅ Test in test mode
7. ✅ Security audit
8. ✅ Deploy to production

**Estimated Time:** 2-3 weeks (including testing)

---

**Version:** 1.0
**Last Updated:** 2026-01-06

Good luck with the implementation! 🚀
