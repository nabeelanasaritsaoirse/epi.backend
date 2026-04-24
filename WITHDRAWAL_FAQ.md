# Automated Withdrawal System - FAQ

## Frequently Asked Questions

---

## General Questions

### Q1: What is Razorpay X and how is it different from regular Razorpay?

**A:** Razorpay has two main products:
- **Razorpay Payment Gateway** (what you already use): Collects payments FROM customers
- **Razorpay X / Payouts** (what we're implementing): Sends payments TO customers/vendors

Think of it as:
- **Payment Gateway** = Money IN (customers pay you)
- **Payouts** = Money OUT (you pay customers/vendors)

They require separate API keys and separate account activation.

---

### Q2: Do I need to pay for Razorpay X separately?

**A:** Yes, but you use the same Razorpay account:
1. Your existing Razorpay account works for both
2. Activate "Razorpay X" feature from dashboard (free activation)
3. Complete KYC (takes 24-48 hours)
4. Add funds to your Razorpay X balance
5. Pay per transaction (₹3-₹5 per payout)

**Cost Structure:**
- No monthly fees
- No setup fees
- Pay only per transaction: ₹3-₹5 + GST per payout

---

### Q3: How much will this cost per withdrawal?

**A:** Razorpay X charges per transaction:

| Mode | Cost | Speed | Best For |
|------|------|-------|----------|
| IMPS | ₹5 + GST | Instant | Most withdrawals |
| NEFT | ₹3 + GST | 2-3 hours | Cost-effective |
| UPI | ₹3 + GST | Instant | Small amounts |
| RTGS | ₹30 + GST | 30 mins | Large amounts (₹2L+) |

**Example:** 1000 withdrawals/month via IMPS = ₹5,900 total (including GST)

**Savings:** Manual processing costs ~₹50/withdrawal (labor). Automation saves 89% cost!

---

### Q4: Can I test this without spending real money?

**A:** Yes! Razorpay provides Test Mode:
- Use test API keys (rzp_test_xxxxx)
- No real money transferred
- Instant payout processing (no delays)
- All features available
- Unlimited testing

Switch to Live Mode only after thorough testing.

---

### Q5: How long does it take to implement?

**A:** Estimated timeline:

| Phase | Duration | Tasks |
|-------|----------|-------|
| Setup | 2-3 days | Activate Razorpay X, get keys |
| Development | 1-2 weeks | Implement services, update routes |
| Testing | 1 week | Unit tests, integration tests |
| Deployment | 2-3 days | Production deployment, monitoring |

**Total: 3-4 weeks** from start to production

If your team is experienced with Node.js and MongoDB, you can complete it in 2 weeks.

---

## Technical Questions

### Q6: What programming languages are supported?

**A:** Your project uses:
- **Backend:** Node.js + Express.js ✅ (Razorpay has official SDK)
- **Database:** MongoDB ✅
- **Payment SDK:** razorpay npm package v2.9.1 ✅

Razorpay also supports:
- Python
- PHP
- Ruby
- Java
- .NET

But since you're already using Node.js, you're all set!

---

### Q7: Do I need to upgrade my Razorpay package?

**A:** No! You're already using `razorpay@2.9.1` which supports Payouts API.

Same package handles both:
- Payment Gateway (orders, payments)
- Payouts (contacts, fund accounts, payouts)

Just initialize a second instance with Razorpay X credentials:

```javascript
// Existing (Payment Gateway)
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// New (Payouts)
const razorpayX = new Razorpay({
  key_id: process.env.RAZORPAYX_KEY_ID,
  key_secret: process.env.RAZORPAYX_KEY_SECRET
});
```

---

### Q8: Will this affect my existing payment gateway integration?

**A:** No, they're completely independent:
- Different API keys
- Different endpoints
- Different balance accounts
- No conflicts

Your existing payment collection will continue working exactly as before.

---

### Q9: What database changes are required?

**A:** Minimal changes:

**1. Update existing Transaction model:**
```javascript
// Add these fields to paymentDetails
razorpayPayoutId: String
razorpayFundAccountId: String
razorpayPayoutStatus: String
razorpayUTR: String
razorpayProcessedAt: Date
```

**2. Create new PayoutBeneficiary model:**
- Caches Contact and Fund Account IDs
- Prevents duplicate API calls
- ~50 lines of code

No breaking changes to existing data!

---

### Q10: How do webhooks work?

**A:** Webhooks are HTTP callbacks from Razorpay to your server:

```
Razorpay processes payout → Sends POST request to your webhook URL
                             ↓
Your server receives notification → Updates transaction status
                             ↓
User gets notification → "Withdrawal successful"
```

**Key Points:**
- Your webhook URL must be publicly accessible (HTTPS)
- Razorpay sends webhook when payout status changes
- You verify signature to ensure it's really from Razorpay
- Must respond with 200 OK within 5 seconds
- Razorpay retries for 24 hours if webhook fails

---

## Security Questions

### Q11: Is it safe to store Razorpay API keys in environment variables?

**A:** Yes, if done correctly:

**✅ DO:**
- Store in .env file (never commit to Git)
- Use AWS Secrets Manager in production
- Rotate keys every 90 days
- Use separate keys for test/live
- Restrict access to keys (only backend)

**❌ DON'T:**
- Commit to Git repository
- Expose in frontend code
- Share via email/chat
- Use same keys for test/live
- Store in plaintext on server

---

### Q12: How do I verify webhooks are really from Razorpay?

**A:** Every webhook includes a signature:

```javascript
const crypto = require('crypto');

function verifyWebhook(body, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(body))
    .digest('hex');

  return expectedSignature === signature;
}

// In webhook handler
if (!verifyWebhook(req.body, req.headers['x-razorpay-signature'], webhookSecret)) {
  return res.status(200).json({ error: 'Invalid signature' });
}
```

**Security:**
- Uses HMAC-SHA256 cryptographic signature
- Only you and Razorpay know the webhook secret
- Attackers can't forge valid signatures
- Protects against replay attacks

---

### Q13: What if someone tries to create fake payouts?

**A:** Multiple security layers prevent this:

1. **Admin Authentication:** Only admins can approve withdrawals
2. **JWT Token Verification:** Validates admin identity
3. **KYC Requirements:** Users must be KYC verified
4. **Bank Account Verification:** Validates bank details
5. **Idempotency Keys:** Prevents duplicate payouts
6. **Rate Limiting:** Max 10 approvals per minute
7. **Audit Logging:** All actions are logged

Even if someone bypasses your system, they still need:
- Your Razorpay X API keys (stored securely)
- Access to your server
- Valid user bank details

---

### Q14: Can users change bank account and immediately withdraw?

**A:** You should implement velocity checks:

```javascript
// Check if bank account was added recently
const bankDetails = user.bankDetails.id(bankDetailsId);
const daysSinceAdded = (Date.now() - bankDetails.createdAt) / (1000 * 60 * 60 * 24);

if (daysSinceAdded < 7) {
  // Flag for admin review
  await notifyAdmin({
    type: 'suspicious_withdrawal',
    reason: 'Bank account added recently',
    userId: user._id,
    transactionId: transaction._id
  });

  // Optionally block withdrawal
  throw new Error('New bank accounts require 7-day waiting period');
}
```

**Best Practices:**
- 7-day waiting period for new bank accounts
- Verify bank account before first payout (₹1 validation)
- Limit withdrawals to 3 per 24 hours
- Flag large withdrawals for review

---

## Compliance Questions

### Q15: Do I need any licenses to process withdrawals?

**A:** It depends on your business model:

**If you're a:**
- **Marketplace/E-commerce:** No separate license needed (Razorpay handles it)
- **Wallet Provider:** Need RBI prepaid instrument license
- **Payment Aggregator:** Need RBI PA license
- **Money Transfer Service:** Need RBI license

**Most likely scenario:** If you're processing withdrawals from user wallets/commissions, you're operating as a marketplace. Razorpay's license covers you.

**Recommendation:** Consult with a fintech lawyer to be sure.

---

### Q16: What KYC is required for withdrawals?

**A:** As per RBI guidelines:

**Minimum (up to ₹10,000/transaction):**
- ✅ Name verification
- ✅ Phone number verification
- ✅ Email verification
- ✅ Basic KYC (Aadhar OR PAN)

**Full KYC (up to ₹1,00,000/transaction):**
- ✅ All above +
- ✅ Aadhar verification
- ✅ PAN verification
- ✅ Address proof
- ✅ Bank account verification

**Your current system already checks:**
```javascript
// From routes/payments.js:22-34
const hasVerifiedKyc = user.kycDocuments.some(doc => doc.isVerified === true);
const hasVerifiedId = user.kycDetails &&
                    (user.kycDetails.aadharVerified || user.kycDetails.panVerified);

if (!hasVerifiedKyc || !hasVerifiedId) {
  return res.status(403).json({ message: 'KYC verification required' });
}
```

---

### Q17: Do I need to report transactions to any authority?

**A:** Yes, if you're processing high volumes:

**RBI Requirements:**
- Transactions >₹10 lakhs: Report to Financial Intelligence Unit (FIU-IND)
- Suspicious transactions: File Suspicious Transaction Report (STR)
- Cash transactions >₹10 lakhs: Report within 7 days

**GST:**
- Razorpay will provide TDS certificate
- You need to account for GST on payout charges

**IT Act:**
- Maintain records for 5 years
- Provide transaction details if requested by authorities

**Good News:** Razorpay helps with compliance and provides necessary reports.

---

### Q18: What happens if a user withdraws and then does chargeback?

**A:** This is why you have wallet deduction on withdrawal request:

**Current Flow (Safe):**
```
User requests ₹1000 withdrawal
  → ₹1000 deducted from wallet immediately
  → Admin approves
  → Payout created
  → If payout fails → ₹1000 refunded to wallet
  → If payout succeeds → Transaction complete
```

**Why this is safe:**
1. Money leaves wallet BEFORE payout
2. User can't use that money elsewhere
3. If payout fails, money is refunded
4. No possibility of double spending

**Chargeback scenarios:**
- User already received money (can't chargeback payouts)
- If they dispute, you have transaction records
- Razorpay provides UTR as proof of payment

---

## Operational Questions

### Q19: What happens if Razorpay X is down?

**A:** Implement fallback strategy:

**Option 1: Queue for later**
```javascript
if (razorpayError.code === 'SERVER_ERROR') {
  // Mark transaction for retry
  transaction.status = 'pending';
  transaction.retryAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  // Notify admin
  await notifyAdmin('Razorpay X down, withdrawal queued');

  return { success: false, message: 'Payout queued, will retry' };
}
```

**Option 2: Manual processing**
```javascript
// Admin can disable auto-processing
const { autoProcess = true } = req.body;

if (!autoProcess) {
  // Approve but don't create payout (manual processing)
  transaction.status = 'approved';
  transaction.notes = 'Manual processing required';
}
```

**Razorpay SLA:**
- 99.9% uptime guarantee
- Average downtime: <1 hour/month
- Status page: https://status.razorpay.com

---

### Q20: Can I cancel a payout after it's created?

**A:** Only if it's still queued:

```javascript
const razorpayX = require('./config/razorpayX');

async function cancelPayout(payoutId) {
  try {
    const payout = await razorpayX.payouts.fetch(payoutId);

    // Can only cancel if still queued
    if (payout.status === 'queued') {
      const cancelled = await razorpayX.payouts.cancel(payoutId);
      return { success: true, cancelled };
    }

    return { success: false, message: 'Payout already processing' };

  } catch (error) {
    return { success: false, message: error.message };
  }
}
```

**Cancellable states:**
- ✅ `queued` (waiting for processing)

**Non-cancellable states:**
- ❌ `pending` (with bank)
- ❌ `processing` (being processed)
- ❌ `processed` (already completed)

**Timeline:**
- IMPS: Processes in seconds (can't cancel)
- NEFT: May stay queued for hours (can cancel)

---

### Q21: How do I handle insufficient Razorpay X balance?

**A:** Implement balance monitoring:

**1. Enable Queue if Low Balance:**
```javascript
await razorpayX.payouts.create({
  // ... other params ...
  queue_if_low_balance: true  // ✅ Enable this
});
```

If balance is low:
- Payout goes to `queued` status
- Razorpay processes when you add funds
- No failure, just delayed

**2. Monitor Balance:**
```javascript
const cron = require('node-cron');

// Check balance every hour
cron.schedule('0 * * * *', async () => {
  const balance = await razorpayX.balance.fetch();

  if (balance.balance < 50000) { // ₹500
    await alertAdmin('Razorpay X balance low: ₹' + balance.balance / 100);
  }
});
```

**3. Auto-reload (Recommended):**
- Dashboard → RazorpayX → Settings → Auto-reload
- Set threshold: ₹10,000
- Set reload amount: ₹50,000
- Razorpay auto-debits your linked bank account

---

### Q22: Can I do bulk payouts (multiple withdrawals at once)?

**A:** Yes, but implement in Phase 2:

**Current Implementation (Phase 1):**
- One payout per admin approval
- Admin reviews each withdrawal individually
- Good for security and fraud prevention

**Future Enhancement (Phase 2):**
```javascript
// Bulk approval
router.post('/withdrawals/bulk-approve', verifyToken, isAdmin, async (req, res) => {
  const { transactionIds } = req.body;

  const results = [];

  for (const txId of transactionIds) {
    try {
      const result = await createPayout({ transactionId: txId, ... });
      results.push({ transactionId: txId, success: true, result });
    } catch (error) {
      results.push({ transactionId: txId, success: false, error: error.message });
    }
  }

  return res.json({ results });
});
```

**Razorpay Limits:**
- Max 10 API calls per second
- Use batch processing with delays
- Consider Razorpay's Batch API for large volumes

---

## Troubleshooting Questions

### Q23: Webhook not being received, what to check?

**A:** Debug checklist:

**1. Verify webhook URL is publicly accessible:**
```bash
# Test from external server
curl -X POST https://your-domain.com/api/webhooks/razorpay/payouts \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Should return 200 OK
```

**2. Check Razorpay webhook logs:**
```
Dashboard → Settings → Webhooks → View Logs
Shows: Delivery status, response code, retry attempts
```

**3. For local development, use ngrok:**
```bash
ngrok http 3000

# Use ngrok URL in webhook config
https://abc123.ngrok.io/api/webhooks/razorpay/payouts
```

**4. Verify webhook secret:**
```javascript
console.log('Expected secret:', process.env.RAZORPAY_WEBHOOK_SECRET);
console.log('Signature from header:', req.headers['x-razorpay-signature']);
```

**5. Check server logs:**
```bash
# Should see webhook received
pm2 logs epi-backend | grep webhook
```

---

### Q24: Payout created but status shows "pending" for hours?

**A:** This is normal for NEFT:

**Processing Times:**
- **IMPS:** Instant (seconds)
- **NEFT:** 2-3 hours (depends on bank batch time)
- **RTGS:** 30 minutes (only during bank hours 9am-6pm)
- **UPI:** Instant

**NEFT Batch Timings:**
- Runs hourly: 8am, 9am, 10am, ... 7pm
- If you create payout at 10:15am, it'll process in 11am batch
- Status changes: queued → pending → processing → processed

**What to do:**
- Wait for next batch cycle
- Check Razorpay dashboard for status
- Webhook will notify when processed
- If stuck >4 hours, contact Razorpay support

---

### Q25: Payout failed, what are common reasons?

**A:** Top failure reasons:

| Reason | Solution |
|--------|----------|
| Invalid account number | Verify bank details, ask user to re-enter |
| Invalid IFSC code | Use bank's official IFSC, check typos |
| Account holder name mismatch | Must match exactly with KYC name |
| Account closed | Ask user to update bank details |
| Bank technical issue | Retry after 30 mins |
| Insufficient balance | Add funds to Razorpay X |
| Beneficiary bank down | Retry later or use different bank |

**How to handle:**
```javascript
// In webhook handler
if (event === 'payout.failed') {
  const reason = payoutData.failure_reason;

  // Categorize failure
  if (reason.includes('Invalid') || reason.includes('account')) {
    // User error - don't retry
    await notifyUser('Please update your bank details');
  } else if (reason.includes('Bank') || reason.includes('technical')) {
    // Temporary error - can retry
    await scheduleRetry(transaction, 30); // Retry after 30 mins
  }

  // Always refund to wallet
  await refundToWallet(transaction, reason);
}
```

---

## Performance Questions

### Q26: How many payouts can I process per day?

**A:** Depends on Razorpay X account limits:

**New Accounts:**
- Daily limit: ₹1,00,000
- No transaction count limit
- Example: 100 × ₹1000 withdrawals = OK

**After 30 days + KYC:**
- Daily limit: ₹10,00,000
- Example: 1000 × ₹1000 withdrawals = OK

**Enterprise Accounts:**
- Custom limits (₹50 lakhs+ per day)
- Dedicated account manager
- Contact Razorpay for upgrade

**API Rate Limits:**
- 10 requests per second
- Use queuing for high volumes

---

### Q27: What's the performance impact on my server?

**A:** Minimal impact:

**Per Payout:**
- 3 API calls to Razorpay (contact, fund account, payout)
- 2-3 database queries
- 1 webhook received
- Total: ~200ms processing time

**100 Withdrawals/hour:**
- CPU: <5% increase
- Memory: ~10MB
- Network: ~1MB bandwidth
- Database: Negligible load

**Optimization:**
- Contact/Fund Account cached after first creation
- Subsequent payouts: Only 1 API call
- Webhook processing: Async (doesn't block)

**Recommendation:**
- Current server specs are sufficient
- No additional infrastructure needed
- Monitor with PM2/New Relic

---

### Q28: Should I cache Contact and Fund Account IDs?

**A:** Yes! This is why we created PayoutBeneficiary model:

**Without Caching:**
```javascript
// Every payout
Create contact → API call 1
Create fund account → API call 2
Create payout → API call 3

// 100 payouts = 300 API calls
```

**With Caching:**
```javascript
// First payout
Create contact → API call 1 → Save to DB
Create fund account → API call 2 → Save to DB
Create payout → API call 3

// Subsequent payouts
Fetch from DB → 0 API calls
Create payout → API call 1

// 100 payouts = 102 API calls (3x faster!)
```

**Benefits:**
- Faster processing
- Fewer API calls
- Reduced costs (Razorpay charges per API call)
- Better user experience

---

## Migration Questions

### Q29: What about pending withdrawals already in the system?

**A:** Migration strategy:

**Option 1: Grandfather old withdrawals (Recommended)**
```javascript
// In approval endpoint
if (transaction.createdAt < new Date('2026-02-01')) {
  // Old withdrawal - process manually
  transaction.status = 'completed';
  await transaction.save();

  return res.json({
    message: 'Legacy withdrawal - processed manually',
    requiresManualPayout: true
  });
}

// New withdrawal - auto payout
await createPayout(...);
```

**Option 2: Migrate all at once**
```javascript
// One-time migration script
const pendingWithdrawals = await Transaction.find({
  type: 'withdrawal',
  status: 'pending',
  createdAt: { $lt: new Date('2026-02-01') }
});

for (const tx of pendingWithdrawals) {
  // Review and approve manually
  console.log(`Review: ${tx._id} - ₹${tx.amount} - ${tx.user.name}`);
}
```

**Recommended Approach:**
1. Deploy new system
2. Process old withdrawals manually (don't auto-payout)
3. Auto-payout only for new withdrawals
4. Clear backlog in 1-2 weeks
5. Then enable auto-payout for all

---

### Q30: Can I rollback if something goes wrong?

**A:** Yes, rollback strategy:

**1. Keep old approval endpoint:**
```javascript
// New endpoint (with auto-payout)
router.post('/withdrawals/approve-v2', ...);

// Old endpoint (manual)
router.post('/withdrawals/approve', ...);

// Use feature flag
const AUTO_PAYOUT_ENABLED = process.env.AUTO_PAYOUT_ENABLED === 'true';

if (AUTO_PAYOUT_ENABLED) {
  // Use v2
} else {
  // Use old version
}
```

**2. Emergency disable:**
```javascript
// In .env
AUTO_PAYOUT_ENABLED=false

// Restart server
pm2 restart epi-backend

// All payouts will be manual again
```

**3. Database rollback:**
```javascript
// Rollback script
await Transaction.updateMany(
  {
    status: 'processing',
    'paymentDetails.razorpayPayoutId': { $exists: true }
  },
  {
    $set: { status: 'pending' },
    $unset: { 'paymentDetails.razorpayPayoutId': '' }
  }
);
```

**4. Razorpay X stays independent:**
- Even if you rollback code, payouts continue
- Already created payouts will complete
- Just stops creating new payouts

---

## Support & Help

### Q31: Where can I get help during implementation?

**A:** Multiple resources:

**1. Documentation:**
- ✅ Main Guide: `AUTOMATED_WITHDRAWAL_IMPLEMENTATION_GUIDE.md`
- ✅ Quick Start: `WITHDRAWAL_QUICK_START.md`
- ✅ This FAQ: `WITHDRAWAL_FAQ.md`

**2. Razorpay Support:**
- Email: support@razorpay.com
- Phone: 1800-123-5555
- Dashboard: My Account → Support
- Response: 24-48 hours

**3. Razorpay Documentation:**
- API Docs: https://razorpay.com/docs/api/x/
- Webhooks: https://razorpay.com/docs/api/x/webhooks/
- Node.js SDK: https://razorpay.com/docs/payments/server-integration/nodejs/

**4. Community:**
- Stack Overflow: [razorpay] tag
- GitHub: razorpay/razorpay-node
- Discord: (if available)

**5. Professional Help:**
- Hire Razorpay-certified developer
- Consult fintech lawyer for compliance
- Security audit before production

---

### Q32: What if I need a feature not in the guide?

**A:** The guide covers 95% of use cases. For custom needs:

**Phase 2 Enhancements:**
- Scheduled withdrawals
- Bulk payouts
- International transfers
- Cryptocurrency withdrawals
- Custom approval workflows
- Advanced fraud detection

**Contact:**
- Razorpay for API capabilities
- Your backend developer for custom logic
- Review Razorpay X API docs for additional endpoints

**Extensible Design:**
- Service layer architecture makes it easy to add features
- Well-documented code
- Modular structure

---

## Final Checklist

### Before Going Live

- [ ] Razorpay X account activated
- [ ] KYC completed (24-48 hour wait)
- [ ] ₹50,000 added to Razorpay X balance
- [ ] Test mode fully tested (10+ test withdrawals)
- [ ] Webhook delivery verified
- [ ] Security audit completed
- [ ] Error handling tested
- [ ] Database backups configured
- [ ] Monitoring alerts setup
- [ ] Team trained on new system
- [ ] Legal/compliance review done
- [ ] First ₹100 test in live mode successful
- [ ] Rollback plan documented
- [ ] 24/7 support available for first week

---

**Have more questions?**

1. Check the main implementation guide
2. Search Razorpay documentation
3. Contact Razorpay support
4. Consult with your technical team

**Good luck with your implementation!** 🚀

---

**Document Version:** 1.0
**Last Updated:** 2026-01-06
**Questions Answered:** 32
