const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const initializeReferralSystem = require("./scripts/initializeReferralSystem");
const connectDB = require("./config/database");

// ====== ROUTES ======
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const categoryRoutes = require("./routes/categoryRoutes");
const userRoutes = require("./routes/users");
const walletRoutes = require("./routes/wallet");
const referralCommissionRoutes = require("./routes/referralCommission");
const paymentRoutes = require("./routes/payments");
const orderRoutes = require("./routes/orders");
const adminRoutes = require("./routes/admin");
const referralRoutes = require("./routes/referralRoutes");
const planRoutes = require("./routes/plans");
const cartRoutes = require("./routes/cartRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const imageStoreRoutes = require("./routes/imageStore");
const bannerRoutes = require("./routes/bannerRoutes");
const successStoryRoutes = require("./routes/successStoryRoutes");
const couponRoutes = require("./routes/couponRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

// ======================================================================
// 🔥 PRODUCTION-COMPATIBLE CORS (FIXED, ALLOWS ADMIN PANEL + LOCALHOST)
// ======================================================================
app.use(
  cors({
    origin: [
      "http://127.0.0.1:5500",
      "http://localhost:5500",

<<<<<<< Updated upstream
      "http://127.0.0.1:3000",
      "http://localhost:3000",

      // Production frontend
      "https://epielio.com",

      // Production backend
      "https://api.epielio.com",

      // Production admin panel (if deployed)
      "https://admin.epielio.com"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);


// ======================================================================
// BODY PARSER
// ======================================================================
app.use(express.json({ limit: "10mb" }));

// Handle invalid JSON
=======
// ====== Mount all routes BEFORE server starts ======
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/images', imageStoreRoutes);
app.use('/api', couponRoutes);

app.get('/', (req, res) => {
  res.send('Epi Backend API is running ✅');
});

// ====== Global Error Handler ======
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: err.message });
});

// JSON parse error handler
>>>>>>> Stashed changes
app.use((err, req, res, next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON payload",
    });
  }
  next(err);
});

// ======================================================================
// FIREBASE ADMIN INIT
// ======================================================================
try {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } =
    process.env;

  let privateKey = FIREBASE_PRIVATE_KEY
    ? FIREBASE_PRIVATE_KEY.replace(/^"|"$/g, "").replace(/\\n/g, "\n")
    : null;

  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        project_id: FIREBASE_PROJECT_ID,
        client_email: FIREBASE_CLIENT_EMAIL,
        private_key: privateKey,
      }),
    });
    console.log("🔥 Firebase initialized");
  } else {
    console.log("⚠️ Firebase not initialized (missing env vars)");
  }
} catch (e) {
  console.error("Firebase init error:", e.message);
}

// ======================================================================
// MONGODB CONNECTION
// ======================================================================
(async () => {
  try {
    await connectDB();
    console.log("✅ MongoDB Connected");

    initializeReferralSystem();
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
})();
<<<<<<< Updated upstream

// ======================================================================
<<<<<<< Updated upstream
// ROUTES
// ======================================================================
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/users", userRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/admin/wallet", require("./routes/adminWallet"));
app.use("/api/referral", referralCommissionRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);

app.use("/api/referral", referralRoutes);

app.use("/api/plans", planRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/images", imageStoreRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/success-stories", successStoryRoutes);

=======
>>>>>>> Stashed changes
// ROOT CHECK
// ======================================================================
app.get("/", (req, res) => {
  res.send("Epi Backend API is running");
});

// ======================================================================
// API ROUTES - ORGANIZED BY FUNCTION
// ======================================================================

// Authentication
app.use("/api/auth", authRoutes);

// Products & Features
app.use("/api/products", productRoutes);

// Categories
app.use("/api/categories", categoryRoutes);

// Users & Profile
app.use("/api/users", userRoutes);

// Wallet & Financial
app.use("/api/wallet", walletRoutes);

// Referrals & Commission
app.use("/api/referral", referralCommissionRoutes);
app.use("/api/referral", referralRoutes);

// Payments
app.use("/api/payments", paymentRoutes);

// Orders
app.use("/api/orders", orderRoutes);

// Shopping Cart
app.use("/api/cart", cartRoutes);

// Wishlist
app.use("/api/wishlist", wishlistRoutes);

// Plans/Subscriptions
app.use("/api/plans", planRoutes);

// Image Store
app.use("/api/images", imageStoreRoutes);

// Banners (Homepage)
app.use("/api/banners", bannerRoutes);

// Success Stories (Homepage)
app.use("/api/success-stories", successStoryRoutes);

// Coupons/Promotions
app.use("/api/coupons", couponRoutes);

// Notifications (In-App & System)
app.use("/api/notifications", notificationRoutes);

// Admin Panel
app.use("/api/admin", adminRoutes);

// ======================================================================
// GLOBAL ERROR HANDLER
// ======================================================================
app.use((err, req, res, next) => {
  console.error("ERROR:", err.message);
  res.status(500).json({
    success: false,
    error: err.message,
  });
});

// ======================================================================
// 404 HANDLER
// ======================================================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`
  });
});

// ======================================================================
// START SERVER
// ======================================================================
const HOST = "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running at http://${HOST}:${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   - /api/auth - Authentication`);
  console.log(`   - /api/products - Products & Features`);
  console.log(`   - /api/categories - Categories`);
  console.log(`   - /api/users - Users`);
  console.log(`   - /api/cart - Shopping Cart`);
  console.log(`   - /api/wishlist - Wishlist`);
  console.log(`   - /api/orders - Orders`);
  console.log(`   - /api/payments - Payments`);
  console.log(`   - /api/coupons - Coupons`);
  console.log(`   - /api/wallet - Wallet`);
  console.log(`   - /api/referral - Referral & Commission`);
  console.log(`   - /api/plans - Plans`);
  console.log(`   - /api/images - Image Store`);
  console.log(`   - /api/banners - Banners`);
  console.log(`   - /api/success-stories - Success Stories`);
  console.log(`   - /api/notifications - Notifications (In-App & System)`);
  console.log(`   - /api/admin - Admin Panel`);
});
=======
>>>>>>> Stashed changes

module.exports = app;
