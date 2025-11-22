// const path = require("path");
// require("dotenv").config({ path: path.join(__dirname, ".env") });

// const express = require("express");
// const cors = require("cors");
// const admin = require("firebase-admin");
// const initializeReferralSystem = require("./scripts/initializeReferralSystem");
// const connectDB = require("./config/database");

// // ====== ROUTES ======
// const authRoutes = require("./routes/auth");
// const productRoutes = require("./routes/products");
// const categoryRoutes = require("./routes/categoryRoutes");
// const userRoutes = require("./routes/users");
// const walletRoutes = require("./routes/wallet");        // USER WALLET
// const adminWalletRoutes = require("./routes/adminWallet"); // ADMIN WALLET

// const referralCommissionRoutes = require("./routes/referralCommission");
// const paymentRoutes = require("./routes/payments");
// const orderRoutes = require("./routes/orders");
// const adminRoutes = require("./routes/admin");

// const referralRoutes = require("./routes/referralRoutes");
// const planRoutes = require("./routes/plans");
// const cartRoutes = require("./routes/cartRoutes");
// const wishlistRoutes = require("./routes/wishlistRoutes");
// const imageStoreRoutes = require("./routes/imageStore");
// const bannerRoutes = require("./routes/bannerRoutes");
// const successStoryRoutes = require("./routes/successStoryRoutes");
// const installmentRoutes = require("./routes/installmentRoutes");
// const healthCheckRoutes = require("./routes/healthCheckRoutes");

// const app = express();
// const PORT = process.env.PORT || 3000;

// // ======================================================================
// // CORS
// // ======================================================================
// app.use(
//   cors({
//     origin: [
//       "http://127.0.0.1:5500",
//       "http://localhost:5500",

//       "http://127.0.0.1:3000",
//       "http://localhost:3000",

//       "https://epielio.com",
//       "https://api.epielio.com",
//       "https://admin.epielio.com"
//     ],
//     methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//     credentials: true
//   })
// );

// // ======================================================================
// // BODY PARSER
// // ======================================================================
// app.use(express.json({ limit: "10mb" }));

// app.use((err, req, res, next) => {
//   if (err?.type === "entity.parse.failed") {
//     return res.status(400).json({
//       success: false,
//       message: "Invalid JSON payload"
//     });
//   }
//   next(err);
// });

// // ======================================================================
// // FIREBASE INIT
// // ======================================================================
// try {
//   const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } =
//     process.env;

//   let privateKey = FIREBASE_PRIVATE_KEY
//     ? FIREBASE_PRIVATE_KEY.replace(/^"|"$/g, "").replace(/\\n/g, "\n")
//     : null;

//   if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && privateKey) {
//     admin.initializeApp({
//       credential: admin.credential.cert({
//         project_id: FIREBASE_PROJECT_ID,
//         client_email: FIREBASE_CLIENT_EMAIL,
//         private_key: privateKey
//       })
//     });
//     console.log("🔥 Firebase initialized");
//   } else {
//     console.log("⚠️ Firebase not initialized (missing env vars)");
//   }
// } catch (e) {
//   console.error("Firebase init error:", e.message);
// }

// // ======================================================================
// // MONGO CONNECTION
// // ======================================================================
// (async () => {
//   try {
//     await connectDB();
//     console.log("✅ MongoDB Connected");
//     initializeReferralSystem();
//   } catch (err) {
//     console.error("❌ MongoDB connection failed:", err.message);
//     process.exit(1);
//   }
// })();

// // ======================================================================
// // ROUTES
// // ======================================================================
// app.use("/api/auth", authRoutes);
// app.use("/api/categories", categoryRoutes);
// app.use("/api/products", productRoutes);
// app.use("/api/users", userRoutes);

// // USER WALLET ROUTES
// app.use("/api/wallet", walletRoutes);

// // ADMIN WALLET ROUTES (IMPORTANT)
// app.use("/api/admin/wallet", adminWalletRoutes);

// app.use("/api/referral", referralCommissionRoutes);
// app.use("/api/referral", referralRoutes);

// app.use("/api/payments", paymentRoutes);
// app.use("/api/orders", orderRoutes);
// app.use("/api/admin", adminRoutes);

// app.use("/api/plans", planRoutes);
// app.use("/api/cart", cartRoutes);
// app.use("/api/wishlist", wishlistRoutes);
// app.use("/api/images", imageStoreRoutes);
// app.use("/api/banners", bannerRoutes);
// app.use("/api/success-stories", successStoryRoutes);
// app.use("/api/installment", installmentRoutes);

// // HEALTH CHECK ROUTES (API Testing Dashboard)
// app.use("/api/health-check", healthCheckRoutes);

// // ======================================================================
// // ROOT
// // ======================================================================
// app.get("/", (req, res) => {
//   res.send("Epi Backend API is running");
// });

// // ======================================================================
// // ERROR HANDLER
// // ======================================================================
// app.use((err, req, res, next) => {
//   console.error("ERROR:", err.message);
//   res.status(500).json({ success: false, error: err.message });
// });

// // ======================================================================
// // START SERVER
// // ======================================================================
// const HOST = "0.0.0.0";
// app.listen(PORT, HOST, () => {
//   console.log(`🚀 Server running at http://${HOST}:${PORT}`);
// });

// module.exports = app;

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
const walletRoutes = require("./routes/wallet");        // USER WALLET
const adminWalletRoutes = require("./routes/adminWallet"); // ADMIN WALLET

const referralCommissionRoutes = require("./routes/referralCommission");
const paymentRoutes = require("./routes/payments");
const orderRoutes = require("./routes/orders");
const adminRoutes = require("./routes/admin");

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

const app = express();
const PORT = process.env.PORT || 3000;

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
      "https://admin.epielio.com"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
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
      message: "Invalid JSON payload"
    });
  }
  next(err);
});

// ======================================================================
// FIREBASE INIT
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
        private_key: privateKey
      })
    });
    console.log("🔥 Firebase initialized");
  } else {
    console.log("⚠️ Firebase not initialized (missing env vars)");
  }
} catch (e) {
  console.error("Firebase init error:", e.message);
}

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
// ROUTES (Place specific routes BEFORE generic ones)
// ======================================================================
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/users", userRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/admin/wallet", adminWalletRoutes);
app.use("/api/referral-commission", referralCommissionRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/image-store", imageStoreRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/success-stories", successStoryRoutes);
app.use("/api/installments", installmentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin/notifications", adminNotificationRoutes);

// ⭐ CART & WISHLIST (subroutes with /count, /clear, /add, /remove, /toggle)
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);

// HEALTH CHECK ROUTES (API Testing Dashboard)
app.use("/api/health-check", healthCheckRoutes);

// ======================================================================
// ROOT
// ======================================================================
app.get("/", (req, res) => {
  res.send("Epi Backend API is running");
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
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ======================================================================
// START SERVER
// ======================================================================
const HOST = "0.0.0.0";
app.listen(PORT, HOST, () => {
 // console.log(Server running at http://${HOST}:${PORT});
  console.log(`🚀 Server running at http://${HOST}:${PORT}`);
});

module.exports = app;

