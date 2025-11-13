const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const initializeReferralSystem = require('./scripts/initializeReferralSystem');
const connectDB = require('./config/database'); // ✅ Use centralized DB connection

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categoryRoutes');
const userRoutes = require('./routes/users');
const walletRoutes = require('./routes/wallet');
const paymentRoutes = require('./routes/payments');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const referralRoutes = require('./routes/referralRoutes');
const planRoutes = require('./routes/plans');
const cartRoutes = require('./routes/cartRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const imageStoreRoutes = require('./routes/imageStore');

const app = express();
const PORT = process.env.PORT || 3000;

// ====== Middleware ======
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// JSON parse error handler
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    console.error('Invalid JSON received:', err.message);
    return res.status(400).json({ success: false, message: 'Invalid JSON payload' });
  }
  next(err);
});

// ====== Initialize Firebase Admin ======
try {
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
  const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (firebasePrivateKey) {
    firebasePrivateKey = firebasePrivateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
  }

  if (firebaseProjectId && firebaseClientEmail && firebasePrivateKey) {
    const serviceAccount = {
      project_id: firebaseProjectId,
      client_email: firebaseClientEmail,
      private_key: firebasePrivateKey,
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('✅ Firebase Admin initialized successfully');
  } else {
    console.warn(
      '⚠️ Firebase Admin not initialized: missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY'
    );
  }
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
}

// ====== Connect to MongoDB ======
(async () => {
  try {
    await connectDB();
    console.log('✅ Connected to epi_backend database');

    // Initialize referral system after DB connection
    initializeReferralSystem();
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }
})();

// ====== Routes ======
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



app.get('/', (req, res) => {
  res.send('Epi Backend API is running ✅');
});

// ====== Global Error Handler ======
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: err.message });
});

// ====== Start Server ======


// ====== Start Server ======
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log('');
  console.log('🚀 ════════════════════════════════════════════════');
  console.log(`   Server running on ${HOST}:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('🚀 ════════════════════════════════════════════════');
  console.log('');
  console.log('📋 Status:');
  console.log('   ✅ MongoDB: Connected');
  console.log('   ✅ JWT Auth: Enabled');
  console.log('');
  console.log('🌐 Access URLs:');
  console.log(`   Local:    http://localhost:${PORT}`);
  console.log(`   Network:  http://${HOST}:${PORT}`);
  console.log('');
  console.log('📚 API Endpoints:');
  console.log(`   Health:      GET  http://${HOST}:${PORT}/`);
  console.log(`   Auth:        POST http://${HOST}:${PORT}/api/auth/login`);
  console.log('');
});

// const server = app.listen(PORT, () => {
//   console.log(`🚀 Server is running on port ${PORT}`);
// });

module.exports = app;

