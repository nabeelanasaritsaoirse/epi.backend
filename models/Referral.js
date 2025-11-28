const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: false
  },
  amount: {
    type: Number,
    default: 0
  },
  date: {
    type: Date,
    default: Date.now
  },

  // Product-level installment / commission tracking (Option B)
  dailyAmount: { type: Number, default: 0 },              // daily SIP used for this purchase
  days: { type: Number, default: 0 },                     // total days for this purchase plan
  commissionPercentage: { type: Number, default: 0 },     // commission percent for this purchase (if differs)
  commissionPerDay: { type: Number, default: 0 },         // precomputed commission per day for convenience

  // progress tracking
  paidDays: { type: Number, default: 0 },                 // how many days paid for this purchase
  pendingDays: { type: Number, default: 0 },              // how many days are pending/missed (computed by controller)
  lastPaidDate: { type: Date, default: null },           // last date a commission was recorded for this purchase

  // product-level status
  status: {
    type: String,
    enum: ['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING'
  },

  // optional human-friendly product code snapshot (stored when purchase recorded)
  productSnapshot: {
    productId: { type: String },
    productName: { type: String }
  }
});

const referralSchema = new mongoose.Schema({
  referrer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  referredUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // referral-level status (global)
  status: {
    type: String,
    enum: ['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING'
  },

  // referral-level timeline (overall, though product-level purchases have their own)
  startDate: {
    type: Date,
    default: null
  },
  endDate: {
    type: Date,
    default: null
  },

  // referral-level defaults (may be overridden per purchase)
  dailyAmount: {
    type: Number,
    default: 100
  },
  days: {
    type: Number,
    default: 30
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  commissionPercentage: {
    type: Number,
    default: 30
  },
  totalCommission: {
    type: Number,
    default: 0
  },
  commissionEarned: {
    type: Number,
    default: 0
  },
  daysPaid: {
    type: Number,
    default: 0
  },
  installmentDetails: {
    type: Object,
    default: null
  },

  // 🛍️ purchases array (product-level tracking)
  purchases: [purchaseSchema],

  // 🧮 Summary fields (kept for compatibility)
  totalPurchases: {
    type: Number,
    default: 0
  },
  totalPurchaseValue: {
    type: Number,
    default: 0
  },

  // referral-level convenience fields to support UI
  lastPaidDate: { type: Date, default: null },
  pendingDays: { type: Number, default: 0 }, // aggregated pending days across purchases

  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Method: add a new purchase to referral (safe way to populate purchase-level fields)
// parameters:
//  - orderId, productId, amount, productSnapshot (optional {productId, productName})
//  - opts: { dailyAmount, days, commissionPercentage }
referralSchema.methods.addPurchase = async function (orderId, productId, amount, productSnapshot = {}, opts = {}) {
  const dailyAmount = opts.dailyAmount != null ? opts.dailyAmount : this.dailyAmount || 0;
  const days = opts.days != null ? opts.days : this.days || 0;
  const commissionPercentage = opts.commissionPercentage != null ? opts.commissionPercentage : this.commissionPercentage || 0;
  const commissionPerDay = (dailyAmount * commissionPercentage) / 100;

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + days);

  const newPurchase = {
    order: orderId || null,
    product: productId || null,
    amount: amount || 0,
    date: startDate,
    dailyAmount,
    days,
    commissionPercentage,
    commissionPerDay,
    paidDays: 0,
    pendingDays: 0,
    lastPaidDate: null,
    status: 'ACTIVE',
    productSnapshot: {
      productId: productSnapshot.productId || undefined,
      productName: productSnapshot.productName || undefined
    }
  };

  this.purchases.push(newPurchase);
  this.totalPurchases += 1;
  this.totalPurchaseValue += amount || 0;

  // adjust referral-level totals
  this.totalAmount = (this.totalAmount || 0) + (amount || 0);
  this.totalCommission = (this.totalCommission || 0) + commissionPerDay * days || 0;

  // if referral was pending, activate it
  if (this.status === 'PENDING') this.status = 'ACTIVE';
  if (!this.startDate) this.startDate = startDate;
  // set endDate as the max of existing endDate and this purchase's endDate
  if (!this.endDate || endDate > this.endDate) this.endDate = endDate;

  await this.save();
  return this;
};

// Recalculate aggregated fields (useful after manual edits)
referralSchema.methods.recalculateAggregates = function () {
  let totalPurchases = 0;
  let totalPurchaseValue = 0;
  let totalCommission = 0;
  let commissionEarned = 0;
  let daysPaid = 0;
  let pendingDays = 0;
  let lastPaid = null;

  for (const p of this.purchases) {
    totalPurchases += 1;
    totalPurchaseValue += (p.amount || 0);
    totalCommission += (p.commissionPerDay || 0) * (p.days || 0);
    commissionEarned += (p.commissionPerDay || 0) * (p.paidDays || 0);
    daysPaid += (p.paidDays || 0);
    pendingDays += (p.pendingDays || 0);
    if (p.lastPaidDate && (!lastPaid || p.lastPaidDate > lastPaid)) lastPaid = p.lastPaidDate;
  }

  this.totalPurchases = totalPurchases;
  this.totalPurchaseValue = totalPurchaseValue;
  this.totalCommission = totalCommission;
  this.commissionEarned = commissionEarned;
  this.daysPaid = daysPaid;
  this.pendingDays = pendingDays;
  this.lastPaidDate = lastPaid;
};

module.exports = mongoose.model('Referral', referralSchema);
