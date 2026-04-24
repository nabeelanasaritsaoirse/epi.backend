/**
 * Payment Intelligence API Test Script
 *
 * Tests all 6 admin payment endpoints against the live server:
 *   1. GET  /api/admin/payments/list
 *   2. GET  /api/admin/payments/analytics
 *   3. GET  /api/admin/payments/settlements
 *   4. GET  /api/admin/payments/settlements/:id
 *   5. GET  /api/admin/payments/:paymentId
 *   6. POST /api/admin/payments/:paymentId/refund  (SKIPPED by default — set TEST_REFUND=true)
 *
 * Usage:
 *   node scripts/testPaymentIntelligenceAPIs.js
 *
 * Config:
 *   Fill in ADMIN_EMAIL and ADMIN_PASSWORD below, then run.
 */

const https = require('https');

// ============================================================
// CONFIG — update before running
// ============================================================
const BASE_HOST    = 'api.epielio.com';
const ADMIN_EMAIL    = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

// Set to true ONLY if you want to test refund (will call Razorpay API — real money!)
const TEST_REFUND = false;

// ============================================================
// HTTP HELPER
// ============================================================

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;

    const options = {
      hostname: BASE_HOST,
      port: 443,
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
      rejectUnauthorized: false   // tolerate self-signed certs in staging
    };

    if (token)   options.headers['Authorization'] = `Bearer ${token}`;
    if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request(options, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try   { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ============================================================
// PRINT HELPERS
// ============================================================

const SEP   = '─'.repeat(60);
let passed  = 0;
let failed  = 0;

function printHeader(title) {
  console.log(`\n${SEP}`);
  console.log(`  ${title}`);
  console.log(SEP);
}

function pass(label, detail = '') {
  passed++;
  console.log(`  ✅ PASS  ${label}${detail ? ' — ' + detail : ''}`);
}

function fail(label, detail = '') {
  failed++;
  console.log(`  ❌ FAIL  ${label}${detail ? ' — ' + detail : ''}`);
}

function info(label, value) {
  const str = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
  // Indent multi-line values
  const indented = str.split('\n').map((l, i) => i === 0 ? l : '            ' + l).join('\n');
  console.log(`  ℹ️  ${label.padEnd(20)} ${indented}`);
}

function warn(msg) {
  console.log(`  ⚠️  ${msg}`);
}

// ============================================================
// STEP 1 — ADMIN LOGIN
// ============================================================

async function adminLogin() {
  printHeader('STEP 1 — Admin Login');

  const res = await request('POST', '/api/admin-auth/login', {
    email:    ADMIN_EMAIL,
    password: ADMIN_PASSWORD
  });

  console.log(`  HTTP ${res.status}`);

  if (res.status === 200 && res.body?.data?.accessToken) {
    const token = res.body.data.accessToken;
    pass('Admin login', `role: ${res.body.data.role || 'unknown'}`);
    info('Admin email', res.body.data.email || ADMIN_EMAIL);
    return token;
  }

  fail('Admin login', `status ${res.status}`);
  console.log('  Response:', JSON.stringify(res.body, null, 2));
  console.log('\n  ⚠️  Cannot continue without a valid admin token.');
  console.log('  → Check ADMIN_EMAIL and ADMIN_PASSWORD in this script.\n');
  process.exit(1);
}

// ============================================================
// TEST 1 — LIST PAYMENTS
// ============================================================

async function testListPayments(token) {
  printHeader('TEST 1 — GET /api/admin/payments/list');

  // --- 1a. Basic call (no filters) ---
  let res = await request('GET', '/api/admin/payments/list?page=1&limit=5', null, token);
  console.log(`  HTTP ${res.status}`);

  if (res.status === 200 && res.body?.success) {
    const d = res.body.data;
    pass('Basic list call');
    info('totalCount',   d.totalCount);
    info('totalPages',   d.totalPages);
    info('page',         d.page);
    info('limit',        d.limit);
    info('records returned', d.payments?.length ?? 0);
    info('summary',      d.summary);

    if (d.payments?.length > 0) {
      const p = d.payments[0];
      info('First payment ID', p.paymentId || p._id);
      info('  status',         p.status);
      info('  method',         p.paymentMethod);
      info('  razorpayMethod', p.razorpayMethod ?? '(not yet enriched)');
      info('  razorpayFee',    p.razorpayFee ?? '(null — webhook not fired yet)');
      info('  user',           p.user?.name ?? p.user ?? '(not populated)');
    } else {
      warn('No payments found — add a payment first to test this fully');
    }
  } else {
    fail('Basic list call', `status ${res.status}`);
    console.log('  Response:', JSON.stringify(res.body, null, 2));
  }

  // --- 1b. Filter by status ---
  res = await request('GET', '/api/admin/payments/list?status=COMPLETED&limit=3', null, token);
  if (res.status === 200 && res.body?.success) {
    pass('Filter by status=COMPLETED', `${res.body.data.totalCount} records`);
  } else {
    fail('Filter by status=COMPLETED', `status ${res.status}`);
  }

  // --- 1c. Filter by date range ---
  const today = new Date().toISOString().split('T')[0];
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  res = await request('GET',
    `/api/admin/payments/list?startDate=${sixMonthsAgo}&endDate=${today}&limit=3`,
    null, token
  );
  if (res.status === 200 && res.body?.success) {
    pass('Filter by date range', `${res.body.data.totalCount} records`);
  } else {
    fail('Filter by date range', `status ${res.status}`);
  }

  // --- 1d. Search ---
  res = await request('GET', '/api/admin/payments/list?search=test&limit=3', null, token);
  if (res.status === 200 && res.body?.success) {
    pass('Search filter', `${res.body.data.totalCount} records matched`);
  } else {
    fail('Search filter', `status ${res.status}`);
  }

  // --- 1e. Bad status (should be silently ignored, not crash) ---
  res = await request('GET', '/api/admin/payments/list?status=INVALID_STATUS', null, token);
  if (res.status === 200 && res.body?.success) {
    pass('Invalid status ignored safely (whitelist working)');
  } else {
    fail('Invalid status handling', `status ${res.status}`);
  }

  // Return first payment ID for detail test
  const listRes = await request('GET', '/api/admin/payments/list?limit=1', null, token);
  return listRes.body?.data?.payments?.[0];
}

// ============================================================
// TEST 2 — ANALYTICS
// ============================================================

async function testAnalytics(token) {
  printHeader('TEST 2 — GET /api/admin/payments/analytics');

  // --- 2a. No date filter (all time) ---
  let res = await request('GET', '/api/admin/payments/analytics', null, token);
  console.log(`  HTTP ${res.status}`);

  if (res.status === 200 && res.body?.success) {
    const d = res.body.data;
    pass('Analytics — all time');
    info('totalCollected (₹)', d.totalCollected);
    info('totalFees (paise)',   d.totalFees);
    info('totalTax (paise)',    d.totalTax);
    info('totalRefunded',       d.totalRefunded);
    info('completedCount',      d.completedCount);
    info('methodBreakdown',     d.methodBreakdown);
    info('statusBreakdown',     d.statusBreakdown);
    info('failedReasons',       d.failedReasons?.length
      ? d.failedReasons.map(r => `${r.errorCode} (${r.count})`).join(', ')
      : '(none)');
  } else {
    fail('Analytics — all time', `status ${res.status}`);
    console.log('  Response:', JSON.stringify(res.body, null, 2));
  }

  // --- 2b. With date range ---
  const today      = new Date().toISOString().split('T')[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split('T')[0];

  res = await request('GET',
    `/api/admin/payments/analytics?startDate=${monthStart}&endDate=${today}`,
    null, token
  );
  if (res.status === 200 && res.body?.success) {
    pass('Analytics — current month filter',
      `₹${res.body.data.totalCollected} collected, ${res.body.data.completedCount} payments`);
  } else {
    fail('Analytics — date range', `status ${res.status}`);
  }

  // --- 2c. Invalid date (should not crash) ---
  res = await request('GET',
    '/api/admin/payments/analytics?startDate=not-a-date&endDate=also-bad',
    null, token
  );
  if (res.status === 200 && res.body?.success) {
    pass('Invalid date silently ignored (parseDate working)');
  } else {
    fail('Invalid date handling', `status ${res.status}`);
  }
}

// ============================================================
// TEST 3 — PAYMENT DETAIL
// ============================================================

async function testPaymentDetail(token, samplePayment) {
  printHeader('TEST 3 — GET /api/admin/payments/:paymentId');

  if (!samplePayment) {
    warn('No payment records found in DB — skipping detail test');
    warn('Make at least one payment and re-run this script');
    return;
  }

  const id = samplePayment.paymentId || samplePayment._id;
  console.log(`  Testing with paymentId: ${id}`);

  const res = await request('GET', `/api/admin/payments/${id}`, null, token);
  console.log(`  HTTP ${res.status}`);

  if (res.status === 200 && res.body?.success) {
    const p = res.body.data.payment;
    pass('Payment detail fetched');
    info('paymentId',         p.paymentId);
    info('status',            p.status);
    info('amount (₹)',        p.amount);
    info('paymentMethod',     p.paymentMethod);

    // Razorpay enriched fields
    console.log('\n  -- Razorpay Enriched Fields (from webhook) --');
    info('razorpayPaymentId', p.razorpayPaymentId ?? '(null — webhook not fired)');
    info('razorpayMethod',    p.razorpayMethod    ?? '(null)');
    info('razorpayFee',       p.razorpayFee       ?? '(null)');
    info('razorpayTax',       p.razorpayTax       ?? '(null)');
    info('razorpayEmail',     p.razorpayEmail     ?? '(null)');
    info('razorpayContact',   p.razorpayContact   ?? '(null)');
    info('razorpayVerified',  p.razorpayVerified);

    // Method-specific
    if (p.cardDetails?.last4) {
      console.log('\n  -- Card Details --');
      info('card',  `${p.cardDetails.network} •••• ${p.cardDetails.last4} (${p.cardDetails.type})`);
      info('issuer', p.cardDetails.issuer);
    }
    if (p.upiDetails?.vpa) {
      console.log('\n  -- UPI Details --');
      info('vpa', p.upiDetails.vpa);
    }
    if (p.netbankingDetails?.bank) {
      console.log('\n  -- Netbanking Details --');
      info('bank', `${p.netbankingDetails.bankName} (${p.netbankingDetails.bank})`);
    }

    // Acquirer data
    console.log('\n  -- Acquirer / Bank References --');
    info('rrn',               p.acquirerData?.rrn              ?? '(null)');
    info('authCode',          p.acquirerData?.authCode         ?? '(null)');
    info('upiTransactionId',  p.acquirerData?.upiTransactionId ?? '(null)');
    info('arn',               p.acquirerData?.arn              ?? '(null)');

    // Refund history
    console.log('\n  -- Refund History --');
    info('refunds count', p.refunds?.length ?? 0);
    info('amountRefunded', `${p.razorpayAmountRefunded ?? 0} paise`);

    // Error fields (failed payments)
    if (p.status === 'FAILED') {
      console.log('\n  -- Error Details --');
      info('errorCode',        p.errorCode);
      info('errorDescription', p.errorDescription);
      info('errorSource',      p.errorSource);
      info('errorReason',      p.errorReason);
    }

    // Populated relations
    console.log('\n  -- Populated Relations --');
    info('user',  p.user  ? `${p.user.name} (${p.user.email})` : '(null)');
    info('order', p.order ? `${p.order.orderId}` : '(null)');

    return p; // Return for refund test
  } else {
    fail('Payment detail', `status ${res.status}`);
    console.log('  Response:', JSON.stringify(res.body, null, 2));
  }

  // --- 404 test ---
  const r404 = await request('GET', '/api/admin/payments/PAY-0000000000000', null, token);
  if (r404.status === 404) {
    pass('404 for non-existent paymentId');
  } else {
    fail('404 handling', `got ${r404.status}`);
  }
}

// ============================================================
// TEST 4 — SETTLEMENTS
// ============================================================

async function testSettlements(token) {
  printHeader('TEST 4 — GET /api/admin/payments/settlements');

  const res = await request('GET', '/api/admin/payments/settlements?count=5', null, token);
  console.log(`  HTTP ${res.status}`);

  if (res.status === 200 && res.body?.success) {
    const d = res.body.data;
    pass('Settlements list fetched');
    info('count returned', d.count);
    info('totalCount',     d.totalCount);

    if (d.settlements?.length > 0) {
      const s = d.settlements[0];
      info('Latest settlement', s.id);
      info('  amount (₹)',      s.amountInRs);
      info('  status',          s.status);
      info('  UTR',             s.utr);
      info('  fees (paise)',     s.fees);
      info('  tax (paise)',      s.tax);
      info('  date',            s.createdAt);

      // Test settlement detail
      await testSettlementDetail(token, s.id);
    } else {
      warn('No settlements yet — Razorpay settles after first real payment');
      warn('This is normal in Test Mode or if no payments have been captured');
    }
  } else if (res.status === 502) {
    warn('Razorpay settlements API returned 502');
    warn('This happens in Test Mode — settlements only exist in Live Mode');
    warn('Check: Razorpay Dashboard → Test Mode toggle is OFF');
    fail('Settlements list', `status ${res.status}`);
  } else {
    fail('Settlements list', `status ${res.status}`);
    console.log('  Response:', JSON.stringify(res.body, null, 2));
  }
}

async function testSettlementDetail(token, settlementId) {
  printHeader(`TEST 4b — GET /api/admin/payments/settlements/${settlementId}`);

  const res = await request('GET',
    `/api/admin/payments/settlements/${settlementId}?reconCount=5`,
    null, token
  );
  console.log(`  HTTP ${res.status}`);

  if (res.status === 200 && res.body?.success) {
    const d = res.body.data;
    pass('Settlement detail fetched');
    info('id',           d.settlement.id);
    info('amount (₹)',   d.settlement.amountInRs);
    info('status',       d.settlement.status);
    info('UTR',          d.settlement.utr);
    info('recon items',  d.reconCount);

    if (d.reconItems?.length > 0) {
      info('First recon type', d.reconItems[0].type);
      info('First recon amt',  `${d.reconItems[0].amount} paise`);
    }
  } else {
    fail('Settlement detail', `status ${res.status}`);
  }
}

// ============================================================
// TEST 5 — REFUND (OPTIONAL)
// ============================================================

async function testRefund(token, payment) {
  printHeader('TEST 5 — POST /api/admin/payments/:paymentId/refund');

  if (!TEST_REFUND) {
    warn('SKIPPED — Set TEST_REFUND = true at top of script to enable');
    warn('WARNING: Enabling this will make a REAL refund via Razorpay API');
    return;
  }

  if (!payment || payment.status !== 'COMPLETED' || !payment.razorpayPaymentId) {
    warn('SKIPPED — Need a COMPLETED Razorpay payment to test refund');
    return;
  }

  const razorpayAmount  = payment.razorpayAmount || payment.amount * 100;
  const alreadyRefunded = payment.razorpayAmountRefunded || 0;
  const remaining       = razorpayAmount - alreadyRefunded;

  if (remaining <= 0) {
    warn(`SKIPPED — Payment ${payment.paymentId} already fully refunded`);
    return;
  }

  // Refund minimum 1 rupee (100 paise) or 10% of remaining — whichever is smaller
  const testRefundAmount = Math.min(100, Math.floor(remaining * 0.1));

  console.log(`  Testing partial refund of ${testRefundAmount} paise on ${payment.paymentId}`);

  // --- 5a. Validation test — bad amount ---
  let res = await request('POST',
    `/api/admin/payments/${payment.paymentId}/refund`,
    { amount: -500, reason: 'Test bad amount' },
    token
  );
  if (res.status === 400) {
    pass('Rejects negative amount (validation working)');
  } else {
    fail('Negative amount validation', `got ${res.status}`);
  }

  // --- 5b. Validation test — bad speed ---
  res = await request('POST',
    `/api/admin/payments/${payment.paymentId}/refund`,
    { amount: testRefundAmount, speed: 'instant' },
    token
  );
  if (res.status === 400) {
    pass('Rejects invalid speed value (validation working)');
  } else {
    fail('Speed validation', `got ${res.status}`);
  }

  // --- 5c. Actual refund (live Razorpay call) ---
  res = await request('POST',
    `/api/admin/payments/${payment.paymentId}/refund`,
    {
      amount: testRefundAmount,
      reason: 'Automated test refund — please ignore',
      speed:  'normal'
    },
    token
  );
  console.log(`  HTTP ${res.status}`);

  if (res.status === 200 && res.body?.success) {
    pass('Refund initiated', res.body.message);
    info('refund ID', res.body.data.refund?.id);
    info('amount',    `${res.body.data.refund?.amount} paise`);
    info('status',    res.body.data.refund?.status);
  } else {
    fail('Refund initiation', `status ${res.status}`);
    console.log('  Response:', JSON.stringify(res.body, null, 2));
  }
}

// ============================================================
// TEST 6 — AUTH GUARD
// ============================================================

async function testAuthGuard() {
  printHeader('TEST 6 — Auth Guard (no token should return 401/403)');

  const endpoints = [
    { method: 'GET',  path: '/api/admin/payments/list' },
    { method: 'GET',  path: '/api/admin/payments/analytics' },
    { method: 'GET',  path: '/api/admin/payments/settlements' },
  ];

  for (const ep of endpoints) {
    const res = await request(ep.method, ep.path); // no token
    if (res.status === 401 || res.status === 403) {
      pass(`${ep.method} ${ep.path} blocked without token (${res.status})`);
    } else {
      fail(`${ep.method} ${ep.path} should return 401/403, got ${res.status}`);
    }
  }
}

// ============================================================
// SUMMARY
// ============================================================

function printSummary() {
  const total = passed + failed;
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  TEST SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  Total:  ${total}`);
  console.log(`  Passed: ${passed} ✅`);
  console.log(`  Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
  console.log('═'.repeat(60));

  if (failed === 0) {
    console.log('\n  🎉 All tests passed! APIs are working correctly.\n');
  } else {
    console.log('\n  ⚠️  Some tests failed. Check the output above.\n');
    console.log('  Common fixes:');
    console.log('  • 401 → Admin token expired or wrong credentials');
    console.log('  • 404 → Route not registered in index.js');
    console.log('  • 502 → Razorpay credentials missing in .env');
    console.log('  • 500 → Check server logs: pm2 logs epi-backend --lines 50\n');
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  Payment Intelligence API Test Suite');
  console.log(`  Target: https://${BASE_HOST}`);
  console.log('═'.repeat(60));

  try {
    // Step 1: Login
    const token = await adminLogin();

    // Step 2: List payments (returns first payment for detail test)
    const firstPayment = await testListPayments(token);

    // Step 3: Analytics
    await testAnalytics(token);

    // Step 4: Payment detail
    const fullPayment = await testPaymentDetail(token, firstPayment);

    // Step 5: Settlements
    await testSettlements(token);

    // Step 6: Refund (skipped unless TEST_REFUND = true)
    await testRefund(token, fullPayment);

    // Step 7: Auth guard check
    await testAuthGuard();

  } catch (err) {
    console.error('\n❌ Unexpected error:', err.message);
    console.error(err.stack);
    failed++;
  }

  printSummary();
}

main();
