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
// ROUTES
// ======================================================================
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/users", userRoutes);
app.use("/api/wallet", walletRoutes);
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

// ROOT CHECK
app.get("/", (req, res) => {
  res.send("Epi Backend API is running");
});

// GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {
  console.error("ERROR:", err.message);
  res.status(500).json({
    success: false,
    error: err.message,
  });
});

// ======================================================================
// START SERVER
// ======================================================================
const HOST = "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running at http://${HOST}:${PORT}`);
});
=======
>>>>>>> Stashed changes

module.exports = app;
