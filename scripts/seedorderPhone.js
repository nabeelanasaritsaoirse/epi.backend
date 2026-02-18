const mongoose = require("mongoose");
require("dotenv").config();

const User = require("../models/User");
const Product = require("../models/Product");
const InstallmentOrder = require("../models/InstallmentOrder");

// 🔗 EXACT SAME DB LOGIC AS BACKEND
const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/epi_backend";

(async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log(`✅ Connected to MongoDB: ${mongoose.connection.name}`);

    // 🔑 USER _ID (FROM ADMIN WALLET API)
    const USER_ID = "6953c5e2ad6010200641a72b";

    // ✅ FIND USER BY _ID (SOURCE OF TRUTH)
    const user = await User.findById(USER_ID);

    if (!user) {
      throw new Error(`User not found for _id: ${USER_ID}`);
    }

    console.log("✅ User found");
    console.log("👤 Name:", user.name);
    console.log("📱 Phone:", user.phoneNumber);
    console.log("🔥 firebaseUid:", user.firebaseUid);

    // 📦 FETCH PRODUCTS (4–5)
    const products = await Product.find().limit(5);
    if (!products.length) {
      throw new Error("No products found in DB");
    }

    // 🚚 CREATE DELIVERED ORDERS
    const orders = products.map((product, index) => ({
      orderId: `SEED-DEL-${Date.now()}-${index}`,

      user: user._id,
      product: product._id,

      deliveryStatus: "DELIVERED",
      status: "COMPLETED",

      productName: product.name,
      productPrice: product.pricing?.price || 999,
      totalProductPrice: product.pricing?.price || 999,

      createdAt: new Date(
        Date.now() - Math.floor(Math.random() * 5) * 24 * 60 * 60 * 1000
      ),
    }));

    await InstallmentOrder.insertMany(orders);

    console.log("🎉 SUCCESS!");
    console.log(`✅ ${orders.length} DELIVERED orders seeded`);
    console.log("👤 User ID:", user._id.toString());

    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding delivered orders:");
    console.error(err.message);
    process.exit(1);
  }
})();
