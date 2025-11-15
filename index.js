const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const initializeReferralSystem = require("./scripts/initializeReferralSystem");
const connectDB = require("./config/database");

// Routes
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const categoryRoutes = require("./routes/categoryRoutes");
const userRoutes = require("./routes/users");
const walletRoutes = require("./routes/wallet");
const paymentRoutes = require("./routes/payments");
const orderRoutes = require("./routes/orders");
const adminRoutes = require("./routes/admin");

const referralRoutes = require("./routes/referralRoutes"); // FIXED
const planRoutes = require("./routes/plans");
const cartRoutes = require("./routes/cartRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const imageStoreRoutes = require("./routes/imageStore");
const bannerRoutes = require("./routes/bannerRoutes");
const successStoryRoutes = require("./routes/successStoryRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

// -----------------------------
// PRODUCTION CORS (IMPORTANT)
// -----------------------------
app.use(
  cors({
    origin: [
      "https://your-production-frontend.com", // CHANGE THIS
      "https://your-admin-panel.com",         // optional
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// Body Parser
app.use(express.json({ limit: "10mb" }));

// Invalid JSON Handler
app.use((err, req, res, next) => {
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON payload",
    });
  }
  next(err);
});

// ----------------------------------------------
// FIREBASE ADMIN INITIALIZATION (SAFE FOR PROD)
// ----------------------------------------------
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
    console.log("Firebase initialized");
  } else {
    console.log("Firebase not initialized (missing keys)");
  }
} catch (e) {
  console.error("Firebase init error:", e.message);
}

// ---------------------------
// MONGODB CONNECTION
// ---------------------------
(async () => {
  try {
    await connectDB();
    console.log("MongoDB Connected");

    // initialize referral job
    initializeReferralSystem();
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }
})();

// ---------------------------
// API ROUTES
// ---------------------------
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/users", userRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);

app.use("/api/referral", referralRoutes); // FIXED prefix

app.use("/api/plans", planRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/images", imageStoreRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/success-stories", successStoryRoutes);

// ROOT
app.get("/", (req, res) => {
  res.send("Epi Backend API is running");
});

// GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {
  console.error("ERROR:", err.message);
  return res.status(500).json({
    success: false,
    error: err.message,
  });
});

// ---------------------------
// START SERVER
// ---------------------------
const HOST = "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`Server running → http://${HOST}:${PORT}`);
});

module.exports = app;
