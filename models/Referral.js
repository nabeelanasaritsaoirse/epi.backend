const mongoose = require('mongoose');

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
  status: {
    type: String,
    enum: ['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING'
  },
  startDate: {
    type: Date,
    default: null
  },
  endDate: {
    type: Date,
    default: null
  },
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

  // 🛍️ New: Track purchases made by referred users
  purchases: [
    {
      order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
      },
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      },
      amount: {
        type: Number,
        default: 0
      },
      date: {
        type: Date,
        default: Date.now
      }
    }
  ],

  // 🧮 New: Summary fields
  totalPurchases: {
    type: Number,
    default: 0
  },
  totalPurchaseValue: {
    type: Number,
    default: 0
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 🔄 Optional: Automatically update summary totals when new purchase is added
referralSchema.methods.addPurchase = async function (orderId, productId, amount) {
  this.purchases.push({ order: orderId, product: productId, amount });
  this.totalPurchases += 1;
  this.totalPurchaseValue += amount;
  await this.save();
  return this;
};

module.exports = mongoose.model('Referral', referralSchema);
