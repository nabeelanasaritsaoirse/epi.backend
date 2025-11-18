const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const crypto = require("crypto");

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    profilePicture: {
      type: String,
      default: "",
    },

    firebaseUid: {
      type: String,
      required: true,
      unique: true,
    },

    phoneNumber: {
      type: String,
      default: "",
      validate: {
        validator: function (v) {
          return /^[0-9]{10}$/.test(v); // exactly 10 digits
        },
        message: (props) =>
          `${props.value} is not a valid 10-digit phone number`,
      },
    },

    deviceToken: {
      type: String,
      default: "",
    },
    addresses: [
      {
        name: { type: String },
        addressLine1: { type: String, required: true },
        addressLine2: { type: String },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: String, required: true },
        country: { type: String, required: true, default: "India" },
        phoneNumber: { type: String, required: true },
        isDefault: { type: Boolean, default: false },
        addressType: {
          type: String,
          enum: ["home", "work", "other"],
          default: "home",
        },
        landmark: { type: String },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],

    wallet: {
      balance: { type: Number, default: 0 },
      transactions: [
        {
          type: {
            type: String,
            enum: ["referral_commission", "withdrawal", "refund", "bonus"],
            required: true,
          },
          amount: { type: Number, required: true },
          description: { type: String, default: "" },
          createdAt: { type: Date, default: Date.now },
        },
      ],
    },

    wishlist: [
      {
        type: Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    isAgree: {
      type: Boolean,
      default: false,
    },

    kycDetails: {
      aadharCardNumber: { type: String, default: "" },
      panCardNumber: { type: String, default: "" },
      aadharVerified: { type: Boolean, default: false },
      panVerified: { type: Boolean, default: false },
    },

    kycDocuments: [
      {
        docType: { type: String },
        docUrl: { type: String },
        status: {
          type: String,
          enum: ["pending", "verified", "rejected"],
          default: "pending",
        },
        isVerified: { type: Boolean, default: false },
        verifiedAt: { type: Date },
        rejectionReason: { type: String },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],

    bankDetails: [
      {
        accountNumber: { type: String },
        ifscCode: { type: String },
        accountHolderName: { type: String },
        bankName: { type: String },
        branchName: { type: String },
        upiId: { type: String },
        isDefault: { type: Boolean, default: false },
        isVerified: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],

    referralCode: {
      type: String,
      unique: true,
    },

    referredBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    referredUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // ⭐ NEW FIELD YOU NEEDED
    referralLimit: {
      type: Number,
      default: 50,
    },

    savedPlans: [
      {
        product: { type: Schema.Types.ObjectId, ref: "Product" },
        targetAmount: { type: Number },
        savedAmount: { type: Number, default: 0 },
        dailySavingAmount: { type: Number },
        startDate: { type: Date, default: Date.now },
        endDate: { type: Date },
        status: {
          type: String,
          enum: ["active", "completed", "cancelled"],
          default: "active",
        },
      },
    ],

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    totalEarnings: {
      type: Number,
      default: 0,
    },

    availableBalance: {
      type: Number,
      default: 0,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Auto-generate referral code
userSchema.pre("save", async function (next) {
  if (this.isNew && !this.referralCode) {
    try {
      console.log("Generating referral code for new user...");
      let referralCode;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!isUnique && attempts < maxAttempts) {
        // Generate a random 8-character code
        referralCode = crypto.randomBytes(4).toString("hex").toUpperCase();

        try {
          // Check if code already exists
          const existingUser = await mongoose
            .model("User")
            .findOne({ referralCode });
          if (!existingUser) {
            isUnique = true;
            console.log("Unique referral code generated:", referralCode);
          } else {
            attempts++;
            console.log(
              `Referral code collision, trying again (attempt ${attempts})`
            );
          }
        } catch (dbError) {
          console.error(
            "Database error checking referral code uniqueness:",
            dbError
          );
          // If there's a DB error, use the code anyway and let unique index handle it
          break;
        }
      }

      this.referralCode = referralCode;
    } catch (error) {
      console.error("Error generating referral code:", error);
      const crypto = require("crypto");
      console.error("Error generating referral code in pre-save hook:", error);
      // Fallback to a simple random code
      this.referralCode = crypto.randomBytes(4).toString("hex").toUpperCase();
    }
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("User", userSchema);
