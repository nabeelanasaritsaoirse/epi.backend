const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const crypto = require("crypto");

/* ---------------- TRANSACTION SCHEMA ---------------- */
const transactionSchema = new Schema({
  type: {
    type: String,
    enum: [
      "referral_commission",
      "withdrawal",
      "refund",
      "bonus",
      "investment",
      "commission",
      "purchase" // 🔥 Added (missing in your file)
    ],
    required: true,
  },
  amount: { type: Number, required: true },
  description: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

/* ---------------- WALLET SCHEMA ---------------- */
const walletSchema = new Schema({
  balance: { type: Number, default: 0 },            // free to withdraw
  holdBalance: { type: Number, default: 0 },        // locked referral earnings
  referralBonus: { type: Number, default: 0 },      // lifetime referral total
  investedAmount: { type: Number, default: 0 },     // total invested
  requiredInvestment: { type: Number, default: 0 }, // required to unlock

  dailyInvestPercent: { type: Number, default: 10 },

  transactions: [transactionSchema],
});

/* ---------------- USER SCHEMA ---------------- */
const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    profilePicture: { type: String, default: "" },
    firebaseUid: { type: String, required: true, unique: true },

    phoneNumber: {
      type: String,
      default: "",
      validate: {
        validator: (v) => /^[0-9]{10}$/.test(v),
        message: (props) => `${props.value} is not a valid 10-digit phone number`,
      },
    },

    deviceToken: { type: String, default: "" },

    /* ---------------- ADDRESSES ---------------- */
    addresses: [
      {
        name: String,
        addressLine1: { type: String, required: true },
        addressLine2: String,
        city: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: String, required: true },
        country: { type: String, default: "India" },
        phoneNumber: { type: String, required: true },
        isDefault: { type: Boolean, default: false },
        addressType: { type: String, enum: ["home", "work", "other"], default: "home" },
        landmark: String,
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],

    /* ---------------- WALLET ---------------- */
    wallet: walletSchema,

    wishlist: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    isAgree: { type: Boolean, default: false },

    /* ---------------- KYC ---------------- */
    kycDetails: {
      aadharCardNumber: String,
      panCardNumber: String,
      aadharVerified: { type: Boolean, default: false },
      panVerified: { type: Boolean, default: false },
    },

    kycDocuments: [
      {
        docType: String,
        docUrl: String,
        status: { type: String, enum: ["pending", "verified", "rejected"], default: "pending" },
        isVerified: { type: Boolean, default: false },
        verifiedAt: Date,
        rejectionReason: String,
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],

    /* ---------------- BANK ---------------- */
    bankDetails: [
      {
        accountNumber: String,
        ifscCode: String,
        accountHolderName: String,
        bankName: String,
        branchName: String,
        upiId: String,
        isDefault: { type: Boolean, default: false },
        isVerified: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],

    /* ---------------- REFERRAL ---------------- */
    referralCode: { type: String, unique: true },
    referredBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    referredUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    referralLimit: { type: Number, default: 50 },

    /* ---------------- SAVING PLANS ---------------- */
    savedPlans: [
      {
        product: { type: Schema.Types.ObjectId, ref: "Product" },
        targetAmount: Number,
        savedAmount: { type: Number, default: 0 },
        dailySavingAmount: Number,
        startDate: { type: Date, default: Date.now },
        endDate: Date,
        status: { type: String, enum: ["active", "completed", "cancelled"], default: "active" },
      },
    ],

    role: { type: String, enum: ["user", "admin"], default: "user" },
    isActive: { type: Boolean, default: true },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

/* ---------------- AUTO REFERRAL CODE ---------------- */
userSchema.pre("save", async function (next) {
  if (this.isNew && !this.referralCode) {
    try {
      let code;
      for (let i = 0; i < 10; i++) {
        code = crypto.randomBytes(4).toString("hex").toUpperCase();
        const exists = await mongoose.model("User").findOne({ referralCode: code });
        if (!exists) break;
      }
      this.referralCode = code;
    } catch (err) {
      this.referralCode = crypto.randomBytes(4).toString("hex").toUpperCase();
    }
  }

  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("User", userSchema);
