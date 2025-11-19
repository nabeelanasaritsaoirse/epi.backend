const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const orderSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },

  orderAmount: {
    type: Number,
    required: true
  },

  paymentOption: {
    type: String,
    enum: ['daily', 'monthly', 'upfront'],
    required: true
  },

  paymentDetails: {
    dailyAmount: Number,
    monthlyAmount: Number,
    totalDuration: Number, // in days
    totalEmis: Number,     // 🔥 REQUIRED for EMI tracking
    startDate: Date,
    endDate: Date,
    numberOfMonths: Number
  },

  /* ---------------- EMI PROGRESS TRACKING ---------------- */
  currentEmiNumber: {
    type: Number,
    default: 0    // increments on every successful payment
  },

  emiPaidAmount: {
    type: Number,
    default: 0
  },

  totalPaid: {
    type: Number,
    default: 0   // total money user has paid till now
  },

  orderStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },

  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'completed'],
    default: 'pending'
  },

  savedPlanId: {
    type: Schema.Types.ObjectId,
    ref: 'User.savedPlans'
  },

  deliveryAddress: {
    type: Object
  },

  deliveryStatus: {
    type: String,
    enum: ['not_applicable', 'pending', 'shipped', 'delivered'],
    default: 'not_applicable'
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
});

/* Auto update timestamps */
orderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Order', orderSchema);
