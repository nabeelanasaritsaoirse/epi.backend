const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Set timezone to India (IST)
process.env.TZ = 'Asia/Kolkata';

const express = require("express");
const cors = require("cors");
require("./config/firebase"); // Initialize Firebase
const initializeReferralSystem = require("./scripts/initializeReferralSystem");
const connectDB = require("./config/database");

// ====== ROUTES ======
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/productRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const userRoutes = require("./routes/users");
const walletRoutes = require("./routes/wallet");
const adminWalletRoutes = require("./routes/adminWallet");
const faqRoutes = require("./routes/faqRoutes");
const referralCommissionRoutes = require("./routes/referralCommission");
const paymentRoutes = require("./routes/payments");
const orderRoutes = require("./routes/orders");
const adminRoutes = require("./routes/admin");

// New admin management routes
const adminAuthRoutes = require("./routes/adminAuth");
const adminManagementRoutes = require("./routes/adminManagement");
const salesTeamRoutes = require("./routes/salesTeam");

const referralRoutes = require("./routes/referralRoutes");
const planRoutes = require("./routes/plans");
const cartRoutes = require("./routes/cart");
const wishlistRoutes = require("./routes/wishlist");
const imageStoreRoutes = require("./routes/imageStore");
const bannerRoutes = require("./routes/bannerRoutes");
const successStoryRoutes = require("./routes/successStoryRoutes");
const installmentRoutes = require("./routes/installmentRoutes");
const healthCheckRoutes = require("./routes/healthCheckRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const adminNotificationRoutes = require("./routes/adminNotificationRoutes");
const chatRoutes = require("./routes/chatRoutes");
const adminChatRoutes = require("./routes/adminChatRoutes");
const couponRoutes = require("./routes/couponRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const featuredListRoutes = require("./routes/featuredListRoutes");
const adminReferralRoutes = require("./routes/adminReferralRoutes");

const app = express();

// ======================================================================
// TRUST PROXY (Required for rate limiting behind nginx reverse proxy)
// ======================================================================
app.set("trust proxy", 1); // Trust first proxy only

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

// ======================================================================
// CORS
// ======================================================================
app.use(
  cors({
    origin: [
      "http://127.0.0.1:5500",
      "http://localhost:5500",
      "http://127.0.0.1:3000",
      "http://localhost:3000",
      "https://epielio.com",
      "https://api.epielio.com",
      "https://admin.epielio.com",
      "http://admin-dashboard-site-dev.s3-website-ap-south-1.amazonaws.com",
      "http://admin-dashboard-site-dev.s3-website.ap-south-1.amazonaws.com"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ======================================================================
// BODY PARSER
// ======================================================================
app.use(express.json({ limit: "10mb" }));

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
// MONGO CONNECTION
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

// ======================================================================
// SERVICES
// ======================================================================
require("./services/kycAutoApproveService");

// ======================================================================
// CRON JOBS
// ======================================================================
const { startNotificationCron } = require("./jobs/notificationCron");
const { startAutopayCron } = require("./jobs/autopayCron");
const { startAccountDeletionCron } = require("./jobs/accountDeletionCron");

// Start cron jobs
startNotificationCron();
startAutopayCron();
startAccountDeletionCron();

// ======================================================================
// ROUTES
// ======================================================================
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/faqs", faqRoutes);
app.use("/api/users", userRoutes);
app.use("/api/kyc", require("./routes/kycRoutes"));

app.use("/api/wallet", walletRoutes);
app.use("/api/admin/wallet", adminWalletRoutes);

app.use("/api/referral-commission", referralCommissionRoutes);
app.use("/api/referral", referralRoutes);

app.use("/api/payments", paymentRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);

app.use("/api/plans", planRoutes);
app.use("/api/image-store", imageStoreRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/uploads", require("./routes/tempUploadRoutes"));
app.use("/api/success-stories", successStoryRoutes);
app.use("/api/installments", installmentRoutes);

app.use("/api/notifications", notificationRoutes);
app.use("/api/admin/notifications", adminNotificationRoutes);

app.use("/api/chat", chatRoutes);
app.use("/api/admin/chat", adminChatRoutes);

app.use("/api/wishlist", wishlistRoutes);
app.use("/api/cart", cartRoutes);

app.use("/api/coupons", couponRoutes);
app.use("/api/admin", dashboardRoutes);
app.use("/api/admin/orders", require("./routes/adminOrders"));

// FEATURED LISTS ROUTES
app.use("/api/featured-lists", featuredListRoutes);

// ADMIN MANAGEMENT ROUTES (Super admin only)
app.use("/api/admin-auth", adminAuthRoutes);
app.use("/api/admin-mgmt", adminManagementRoutes);

// SALES TEAM ROUTES
app.use("/api/sales", salesTeamRoutes);

// ADMIN REFERRAL ROUTES
app.use("/api/admin/referrals", adminReferralRoutes);

// HEALTH CHECK
app.use("/api/health-check", healthCheckRoutes);

// ======================================================================
// ROOT
// ======================================================================
app.get("/", (req, res) => {
  res.send("Epi Backend API is running");
});

app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// ======================================================================
// ERROR HANDLER
// ======================================================================
app.use((err, req, res, next) => {
  console.error("ERROR:", err.message);
  res.status(500).json({ success: false, error: err.message });
});

// ======================================================================
// 404 HANDLER
// ======================================================================
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ======================================================================
// START SERVER
// ======================================================================
app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running at http://${HOST}:${PORT}`);
});

module.exports = app;
