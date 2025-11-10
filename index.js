require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const admin = require('firebase-admin');
const initializeReferralSystem = require('./scripts/initializeReferralSystem');

// Routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const userRoutes = require('./routes/users');
const walletRoutes = require('./routes/wallet');
const paymentRoutes = require('./routes/payments');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const referralRoutes = require('./routes/referralRoutes');
const planRoutes = require('./routes/plans');
const imageStoreRoutes = require('./routes/imageStore');
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

Initialize Firebase Admin
try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
}

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/epi-project')
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Initialize referral system after successful database connection
    initializeReferralSystem();
  })
  .catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/images', imageStoreRoutes);



app.get('/', (req, res) => {
  res.send('Epi Project API is running');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
