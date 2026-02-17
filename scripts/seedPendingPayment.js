const mongoose = require("mongoose");

const User = require("../models/User");
const Product = require("../models/Product");
const InstallmentOrder = require("../models/InstallmentOrder");

// 🔴 HARD-CODE YOUR DB CONNECTION STRING
const MONGO_URI = "mongodb://127.0.0.1:27017/epi_backend";
// If you use Atlas, put that URL here instead

(async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // 📱 USER PHONE NUMBER
    const phoneNumber = "7994374844";

    // ⚠️ CHANGE field name if needed (phone vs mobileNumber)
    const user = await User.findOne({ phone: phoneNumber });

    if (!user) {
      throw new Error("User not found for phone: " + phoneNumber);
    }

    console.log("✅ User found:", user._id.toString());

    const products = await Product.find().limit(5);
    if (!products.length) {
      throw new Error("No products found in DB");
    }

    const orders = products.map((product, index) => ({
      orderId: `ORD-${Date.now()}-${index}`,
      user: user._id,
      product: product._id,
      deliveryStatus: "DELIVERED",
      status: "COMPLETED",
      totalProductPrice: product.pricing?.price || 999,
      createdAt: new Date(),
    }));

    await InstallmentOrder.insertMany(orders);

    console.log("🎉 DONE!");
    console.log(`✅ ${orders.length} DELIVERED orders created`);
    console.log("📱 Phone:", phoneNumber);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding delivered orders:");
    console.error(err.message);
    process.exit(1);
  }
})();
