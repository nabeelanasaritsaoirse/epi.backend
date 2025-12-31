const mongoose = require("mongoose");

const faqSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["PRODUCT", "APP"],
      required: true,
      index: true,
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      index: true,
    },

    question: {
      type: String,
      required: true,
      trim: true,
    },

    answer: {
      type: String,
      required: true,
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true }
);

// 🔒 Safety rule
faqSchema.pre("save", function (next) {
  if (this.type === "APP") {
    this.productId = null;
  }
  next();
});

module.exports = mongoose.model("Faq", faqSchema);
