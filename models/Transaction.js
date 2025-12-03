const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const transactionSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  /* ---------------- TRANSACTION TYPES ---------------- */
  type: {
    type: String,
    enum: [
      "referral_commission",      // 20% per EMI
      "installment_commission",   // your own 10% per EMI
      "withdrawal",
      "refund",
      "bonus",
      "investment",
      "commission",
      "purchase",
      "emi_payment"               // EMI paid by user
    ],
    required: true
  },

  amount: {
    type: Number,
    required: true
  },

  status: {
    type: String,
    enum: ["pending", "completed", "failed", "cancelled"],
    default: "pending"
  },

  paymentMethod: {
    type: String,
    enum: [
      "razorpay",
      "bank_transfer",
      "upi",
      "referral_bonus",
      "system",
      "card"
    ],
    default: "system"
  },

  /* ---------------- PAYMENT DETAILS ---------------- */
  paymentDetails: {
    orderId: String,
    paymentId: String,
    signature: String,
    bankName: String,
    accountNumber: String,
    ifscCode: String,              // IFSC code for bank transfers
    accountHolderName: String,     // Account holder name
    upiId: String,
    referralCode: String,
    cardNumber: String,
    bank: String,

    // 🔥 WITHDRAWAL APPROVAL/REJECTION DETAILS
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    rejectedAt: Date,
    rejectionReason: String,

    // 🔥 IMPORTANT FOR EMI LOGIC
    emiNumber: Number,             // 1st, 2nd, 3rd installment etc
    totalEmis: Number,             // total EMI count
    isCommissionProcessed: {       // prevents duplicate commission
      type: Boolean,
      default: false
    }
  },

  /* ---------------- LINK TO PRODUCT/PLAN ---------------- */
  product: {
    type: Schema.Types.ObjectId,
    ref: "Product"
  },

  order: {
    type: Schema.Types.ObjectId,
    ref: "Order"
  },

  savedPlan: {
    type: Schema.Types.ObjectId
  },

  /* ---------------- DESCRIPTIVE LOG ---------------- */
  description: { type: String, default: "" },

  /* ---------------- TIMESTAMPS ---------------- */
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

/* Auto update updatedAt */
transactionSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Transaction", transactionSchema);
