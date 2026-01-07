const mongoose = require("mongoose");

/**
 * Single document entry (selfie / aadhaar / pan / others)
 */
const documentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      "selfie",
      "aadhaar",
      "pan",
      "voter_id",
      "driving_license",
      "passport",
    ],
    required: true,
  },

  // Selfie: only frontUrl
  // Aadhaar/PAN: both front + back
  frontUrl: {
    type: String,
    required: true,
  },

  backUrl: {
    type: String,
    default: null,
  },
});

/**
 * Full KYC Entry
 */
const kycSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  aadhaarNumber: {
    type: String,
    required: true,
  },

  panNumber: {
    type: String,
    required: true,
  },
  documents: {
    type: [documentSchema],
    validate: {
      validator: (docs) => Array.isArray(docs) && docs.length > 0,
      message: "At least 1 document is required",
    },
  },

  status: {
    type: String,
    enum: ["pending", "approved", "rejected", "auto_approved"],
    default: "pending",
  },

  // IMPORTANT: Matches controller field name
  rejectionNote: {
    type: String,
    default: null,
  },

  submittedAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

/**
 * Auto-update timestamps
 */
kycSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("Kyc", kycSchema);
