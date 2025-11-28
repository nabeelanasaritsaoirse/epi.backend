const mongoose = require("mongoose");

const walletTransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  type: {
    type: String,
    enum: [
      "deposit",
      "referral_bonus",
      "investment",
      "withdrawal",
      "withdrawal_locked",
      "withdrawal_released"
    ],
    required: true
  },

  amount: { type: Number, required: true },
  description: { type: String, default: "" },

  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "completed",
  },

  meta: { type: Object, default: {} },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("WalletTransaction", walletTransactionSchema);
