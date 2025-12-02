const mongoose = require("mongoose");

const kycSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },

  documents: [
    {
      type: {
        type: String,
        enum: ["aadhaar","aadhar", "pan", "voter_id", "driving_license"],
        required: true
      },
      frontUrl: { type: String, required: true },
      backUrl: { type: String, required: true }
    }
  ],

  status: {
    type: String,
    enum: ["pending", "approved", "rejected", "auto_approved"],
    default: "pending"
  },

  submittedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Kyc", kycSchema);
