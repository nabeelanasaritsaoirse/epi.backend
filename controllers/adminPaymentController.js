/**
 * Admin Payment Intelligence Controller
 *
 * Provides the admin panel with full visibility into payment records:
 *   - Paginated list with rich filters (date, method, status, user search)
 *   - Individual payment detail view (all Razorpay fields)
 *   - Analytics dashboard (totals, fees, method breakdown, failure reasons)
 *   - Refund initiation via Razorpay API
 *   - Settlement reports (fetched live from Razorpay API)
 *
 * All routes require verifyToken + isAdmin middleware.
 *
 * API Base: /api/admin/payments
 */

const mongoose = require('mongoose');
const PaymentRecord = require('../models/PaymentRecord');
const User = require('../models/User');
const razorpay = require('../config/razorpay');
const { successResponse } = require('../middlewares/errorHandler');

// ============================================================
// INTERNAL HELPERS
// ============================================================

/**
 * Parse a query-string date param into a Date object.
 * Returns null (not an Invalid Date) when the input is absent or unparseable.
 * @param {string|undefined} value
 * @returns {Date|null}
 */
function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Escape special regex characters so user-supplied search strings
 * cannot inject regex patterns (ReDoS prevention).
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================
// 1. LIST PAYMENTS — GET /api/admin/payments/list
// ============================================================

/**
 * List all payment records with filters, search and pagination.
 *
 * Query params:
 *   page       {number}  Page number, default 1
 *   limit      {number}  Records per page, default 20, max 100
 *   startDate  {string}  ISO date — filter createdAt >= startDate
 *   endDate    {string}  ISO date — filter createdAt <= endDate
 *   method     {string}  card | upi | netbanking | wallet | emi
 *   status     {string}  COMPLETED | FAILED | REFUNDED | PENDING | PROCESSING | CANCELLED
 *   search     {string}  Searches razorpayEmail, razorpayContact, or user name
 *   sortBy     {string}  createdAt | -createdAt | amount | -amount  (default: -createdAt)
 */
exports.listPayments = async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const skip   = (page - 1) * limit;

  const { method, status, search, sortBy } = req.query;

  // Parse and validate dates — silently ignore invalid/absent values
  const startDate = parseDate(req.query.startDate);
  const endDate   = parseDate(req.query.endDate);

  // Build filter
  const filter = {};

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = startDate;
    if (endDate)   filter.createdAt.$lte = endDate;
  }

  // Whitelist allowed enum values to prevent MongoDB operator injection
  const allowedMethods = ['card', 'upi', 'netbanking', 'wallet', 'emi'];
  const allowedStatuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED'];

  if (method && allowedMethods.includes(method))   filter.razorpayMethod = method;
  if (status && allowedStatuses.includes(status))  filter.status         = status;

  // Search across email, contact, and user name
  // Regex is escaped to prevent ReDoS attacks
  if (search) {
    const escaped = escapeRegex(search.trim());
    const safeRegex = { $regex: escaped, $options: 'i' };

    // Find matching user IDs by name/email/phone
    const matchingUsers = await User.find({
      $or: [
        { name:        safeRegex },
        { email:       safeRegex },
        { phoneNumber: safeRegex }
      ]
    }).select('_id').lean();

    const userIds = matchingUsers.map(u => u._id);

    filter.$or = [
      { razorpayEmail:   safeRegex },
      { razorpayContact: safeRegex },
      ...(userIds.length ? [{ user: { $in: userIds } }] : [])
    ];
  }

  // Sort
  const sortMap = {
    'createdAt':  { createdAt:  1 },
    '-createdAt': { createdAt: -1 },
    'amount':     { amount:     1 },
    '-amount':    { amount:    -1 }
  };
  const sort = sortMap[sortBy] || { createdAt: -1 };

  // Execute query + count in parallel
  const [payments, totalCount] = await Promise.all([
    PaymentRecord.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('user',  'name email phoneNumber')
      .populate('order', 'orderId')
      .lean(),
    PaymentRecord.countDocuments(filter)
  ]);

  // Aggregate summary for the filtered set (totals row for admin table footer)
  const [summary] = await PaymentRecord.aggregate([
    { $match: filter },
    {
      $group: {
        _id:          null,
        totalAmount:  { $sum: '$amount' },
        totalFees:    { $sum: { $ifNull: ['$razorpayFee', 0] } },
        totalTax:     { $sum: { $ifNull: ['$razorpayTax', 0] } },
        totalRefunded:{ $sum: { $ifNull: ['$razorpayAmountRefunded', 0] } }
      }
    }
  ]);

  return successResponse(res, {
    payments,
    summary: summary || { totalAmount: 0, totalFees: 0, totalTax: 0, totalRefunded: 0 },
    totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit)
  }, 'Payment records fetched successfully');
};

// ============================================================
// 2. PAYMENT DETAIL — GET /api/admin/payments/:paymentId
// ============================================================

/**
 * Get full details of a single payment record.
 * Returns all Razorpay fields including card/UPI/acquirer data.
 *
 * Params:
 *   paymentId  {string}  PaymentRecord._id or PaymentRecord.paymentId
 */
exports.getPaymentDetail = async (req, res) => {
  const { paymentId } = req.params;

  // Support both MongoDB _id and the internal paymentId string
  const isObjectId = mongoose.Types.ObjectId.isValid(paymentId);
  const filter = isObjectId
    ? { $or: [{ _id: paymentId }, { paymentId }] }
    : { paymentId };

  const payment = await PaymentRecord.findOne(filter)
    .populate('user',        'name email phoneNumber')
    .populate('order',       'orderId productName productPrice totalDays status deliveryStatus')
    .populate('markedBy',    'name email')
    .populate('cancelledBy', 'name email')
    .lean();

  if (!payment) {
    return res.status(404).json({
      success: false,
      message: 'Payment record not found'
    });
  }

  return successResponse(res, { payment }, 'Payment detail fetched successfully');
};

// ============================================================
// 3. ANALYTICS — GET /api/admin/payments/analytics
// ============================================================

/**
 * Aggregated payment analytics for the admin dashboard.
 *
 * Query params:
 *   startDate  {string}  ISO date (optional)
 *   endDate    {string}  ISO date (optional)
 */
exports.getAnalytics = async (req, res) => {
  // Parse and validate dates — silently ignore invalid/absent values
  const startDate = parseDate(req.query.startDate);
  const endDate   = parseDate(req.query.endDate);

  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = startDate;
    if (endDate)   dateFilter.createdAt.$lte = endDate;
  }

  const [totals, methodBreakdown, statusBreakdown, failedReasons] = await Promise.all([

    // Overall financial summary
    PaymentRecord.aggregate([
      { $match: { ...dateFilter, status: 'COMPLETED' } },
      {
        $group: {
          _id:           null,
          totalCollected: { $sum: '$amount' },
          totalFees:      { $sum: { $ifNull: ['$razorpayFee', 0] } },
          totalTax:       { $sum: { $ifNull: ['$razorpayTax', 0] } },
          totalRefunded:  { $sum: { $ifNull: ['$razorpayAmountRefunded', 0] } },
          count:          { $sum: 1 }
        }
      }
    ]),

    // Payment method breakdown (only COMPLETED)
    PaymentRecord.aggregate([
      { $match: { ...dateFilter, status: 'COMPLETED', razorpayMethod: { $ne: null } } },
      {
        $group: {
          _id:    '$razorpayMethod',
          count:  { $sum: 1 },
          amount: { $sum: '$amount' }
        }
      },
      { $sort: { amount: -1 } }
    ]),

    // Status breakdown (all statuses, across all methods)
    PaymentRecord.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id:   '$status',
          count: { $sum: 1 }
        }
      }
    ]),

    // Top 5 failure reasons
    PaymentRecord.aggregate([
      {
        $match: {
          ...dateFilter,
          status:    'FAILED',
          errorCode: { $ne: null }
        }
      },
      {
        $group: {
          _id:         '$errorCode',
          count:       { $sum: 1 },
          description: { $first: '$errorDescription' }
        }
      },
      { $sort:  { count: -1 } },
      { $limit: 5 }
    ])
  ]);

  // Reshape method breakdown into a map for easier frontend consumption
  const methodMap = {};
  for (const m of methodBreakdown) {
    methodMap[m._id] = { count: m.count, amount: m.amount };
  }

  const statusMap = {};
  for (const s of statusBreakdown) {
    statusMap[s._id] = s.count;
  }

  const summary = totals[0] || {
    totalCollected: 0, totalFees: 0, totalTax: 0, totalRefunded: 0, count: 0
  };

  return successResponse(res, {
    totalCollected:  summary.totalCollected,
    totalFees:       summary.totalFees,
    totalTax:        summary.totalTax,
    totalRefunded:   summary.totalRefunded,
    completedCount:  summary.count,
    methodBreakdown: methodMap,
    statusBreakdown: statusMap,
    failedReasons:   failedReasons.map(r => ({
      errorCode:   r._id,
      count:       r.count,
      description: r.description
    }))
  }, 'Analytics fetched successfully');
};

// ============================================================
// 4. INITIATE REFUND — POST /api/admin/payments/:paymentId/refund
// ============================================================

/**
 * Initiate a full or partial refund via Razorpay API.
 *
 * Params:
 *   paymentId  {string}  PaymentRecord.paymentId (internal) or _id
 *
 * Body:
 *   amount  {number}  Amount to refund in paise (e.g. 10000 = ₹100). Omit for full refund.
 *   reason  {string}  Reason shown in Razorpay dashboard
 *   speed   {string}  'normal' (default, 5-7 days) | 'optimum' (instant if available)
 */
exports.initiateRefund = async (req, res) => {
  const { paymentId } = req.params;
  const { reason, speed = 'normal' } = req.body;

  // Parse amount as a safe integer in paise — reject strings/floats/NaN
  const amount = req.body.amount !== undefined ? Math.floor(Number(req.body.amount)) : undefined;
  if (req.body.amount !== undefined && (isNaN(amount) || amount <= 0)) {
    return res.status(400).json({
      success: false,
      message: 'amount must be a positive integer in paise (e.g. 10000 for ₹100).'
    });
  }

  if (!['normal', 'optimum'].includes(speed)) {
    return res.status(400).json({
      success: false,
      message: "speed must be 'normal' or 'optimum'."
    });
  }

  // Find the payment record
  const isObjectId = mongoose.Types.ObjectId.isValid(paymentId);
  const filter = isObjectId
    ? { $or: [{ _id: paymentId }, { paymentId }] }
    : { paymentId };

  const record = await PaymentRecord.findOne(filter);
  if (!record) {
    return res.status(404).json({ success: false, message: 'Payment record not found' });
  }

  if (record.status !== 'COMPLETED') {
    return res.status(400).json({
      success: false,
      message: `Cannot refund a payment with status: ${record.status}. Only COMPLETED payments can be refunded.`
    });
  }

  if (!record.razorpayPaymentId) {
    return res.status(400).json({
      success: false,
      message: 'This payment has no Razorpay payment ID — it may be a wallet payment.'
    });
  }

  // Determine refund amount
  const razorpayAmount   = record.razorpayAmount || record.amount * 100;
  const alreadyRefunded  = record.razorpayAmountRefunded || 0;
  const remainingAmount  = razorpayAmount - alreadyRefunded;
  const refundAmount     = amount || remainingAmount; // default to full remaining

  if (refundAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'This payment has already been fully refunded.'
    });
  }

  if (refundAmount > remainingAmount) {
    return res.status(400).json({
      success: false,
      message: `Refund amount (${refundAmount} paise) exceeds the remaining refundable amount (${remainingAmount} paise).`
    });
  }

  // Call Razorpay Refunds API
  let rzpRefund;
  try {
    rzpRefund = await razorpay.payments.refund(record.razorpayPaymentId, {
      amount: refundAmount,
      speed,
      notes: {
        reason:       reason || 'Admin initiated refund',
        adminEmail:   req.user?.email || 'unknown',
        paymentRecordId: record._id.toString()
      }
    });
  } catch (err) {
    console.error('❌ Razorpay refund API error:', err);
    return res.status(502).json({
      success: false,
      message: 'Razorpay refund failed',
      error:   err.error?.description || err.message
    });
  }

  // Record refund in PaymentRecord
  record.refunds.push({
    razorpayRefundId:      rzpRefund.id,
    amount:                refundAmount,
    status:                rzpRefund.status || 'pending',
    speedProcessed:        rzpRefund.speed_requested ?? speed,
    arn:                   rzpRefund.acquirer_data?.arn ?? null,
    reason:                reason || null,
    initiatedByAdminId:    req.user?._id   || null,
    initiatedByAdminEmail: req.user?.email || null
  });

  record.razorpayAmountRefunded += refundAmount;

  const newlyRefunded = record.razorpayAmountRefunded;
  if (newlyRefunded >= razorpayAmount) {
    record.status               = 'REFUNDED';
    record.razorpayRefundStatus = 'full';
  } else {
    record.razorpayRefundStatus = 'partial';
  }

  await record.save();

  return successResponse(res, {
    refund:        rzpRefund,
    paymentRecord: record
  }, `Refund of ₹${(refundAmount / 100).toFixed(2)} initiated successfully`);
};

// ============================================================
// 5. SETTLEMENT LIST — GET /api/admin/payments/settlements
// ============================================================

/**
 * Fetch settlement list from Razorpay API with proper pagination.
 *
 * NOTE: Razorpay's Settlements API does NOT expose a total count — the
 * `count` field in its response is the number of items returned, not a
 * grand total.  We therefore use a "hasMore" cursor pattern:
 *   - If the number of items returned equals the requested `limit`, there
 *     are likely more records; set `hasMore: true` and return `nextPage`.
 *   - If fewer items are returned, we are on the last page.
 *
 * Query params:
 *   page       {number}  Page number (1-based, default 1)
 *   limit      {number}  Records per page (default 10, max 100)
 *   from       {string}  ISO date string — only settlements created on/after this date
 *   to         {string}  ISO date string — only settlements created on/before this date
 */
exports.listSettlements = async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const skip  = (page - 1) * limit;

  // Convert ISO date strings to Unix timestamps (seconds) that Razorpay expects.
  // Invalid / absent dates are silently ignored.
  const fromDate = parseDate(req.query.from);
  const toDate   = parseDate(req.query.to);

  const razorpayParams = { count: limit, skip };
  if (fromDate) razorpayParams.from = Math.floor(fromDate.getTime() / 1000);
  if (toDate)   razorpayParams.to   = Math.floor(toDate.getTime()   / 1000);

  let settlementsResponse;
  try {
    settlementsResponse = await razorpay.settlements.all(razorpayParams);
  } catch (err) {
    console.error('❌ Razorpay settlements.all error:', err);
    return res.status(502).json({
      success: false,
      message: 'Failed to fetch settlements from Razorpay',
      error:   err.error?.description || err.message
    });
  }

  const items = settlementsResponse.items || [];

  const settlements = items.map(s => ({
    id:         s.id,
    amount:     s.amount,                              // paise
    amountInRs: (s.amount / 100).toFixed(2),
    status:     s.status,
    fees:       s.fees,
    tax:        s.tax,
    utr:        s.utr,                                 // Bank transfer reference
    createdAt:  s.created_at ? new Date(s.created_at * 1000) : null
  }));

  // Razorpay does not return a total count — use hasMore pattern
  const hasMore = settlements.length === limit;

  return successResponse(res, {
    settlements,
    pagination: {
      page,
      limit,
      count:    settlements.length,
      hasMore,
      nextPage: hasMore ? page + 1 : null
    }
  }, 'Settlements fetched successfully');
};

// ============================================================
// 6. SETTLEMENT DETAIL — GET /api/admin/payments/settlements/:settlementId
// ============================================================

/**
 * Fetch a single settlement and its reconciliation (recon) items.
 *
 * Recon items are the individual payments/refunds/adjustments included in the
 * settlement payout.  They are paginated using the same hasMore pattern as
 * listSettlements (Razorpay does not return a total recon count either).
 *
 * Params:
 *   settlementId  {string}  Razorpay settlement ID (e.g. setl_xxxxxxxx)
 *
 * Query params:
 *   reconPage   {number}  Recon page number (1-based, default 1)
 *   reconLimit  {number}  Recon items per page (default 20, max 100)
 */
exports.getSettlementDetail = async (req, res) => {
  const { settlementId } = req.params;

  const reconPage  = Math.max(1, parseInt(req.query.reconPage)  || 1);
  const reconLimit = Math.min(100, Math.max(1, parseInt(req.query.reconLimit) || 20));
  const reconSkip  = (reconPage - 1) * reconLimit;

  let settlement, recon;
  try {
    [settlement, recon] = await Promise.all([
      razorpay.settlements.fetch(settlementId),
      razorpay.settlements.fetchRecon({
        settlement_id: settlementId,
        count:         reconLimit,
        skip:          reconSkip
      }).catch(() => ({ items: [] })) // recon may not be available on all Razorpay plans
    ]);
  } catch (err) {
    console.error(`❌ Razorpay settlement fetch error for ${settlementId}:`, err);
    return res.status(502).json({
      success: false,
      message: 'Failed to fetch settlement from Razorpay',
      error:   err.error?.description || err.message
    });
  }

  const reconItems = recon?.items || [];
  const reconHasMore = reconItems.length === reconLimit;

  return successResponse(res, {
    settlement: {
      id:         settlement.id,
      amount:     settlement.amount,
      amountInRs: (settlement.amount / 100).toFixed(2),
      status:     settlement.status,
      fees:       settlement.fees,
      tax:        settlement.tax,
      utr:        settlement.utr,
      createdAt:  settlement.created_at ? new Date(settlement.created_at * 1000) : null
    },
    recon: {
      items: reconItems,
      pagination: {
        page:     reconPage,
        limit:    reconLimit,
        count:    reconItems.length,
        hasMore:  reconHasMore,
        nextPage: reconHasMore ? reconPage + 1 : null
      }
    }
  }, 'Settlement detail fetched successfully');
};
