const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const connectDB = require('./config/database'); // keep your DB connector
const authRoutes = require('./routes/auth');
const wishlistRoutes = require('./routes/wishlistRoutes'); // optional - keep if exists
const cartRoutes = require('./routes/cartRoutes'); // optional - keep if exists

// NEW: categories router (ensure the path is correct relative to this file)
const categoriesRouter = require('./routes/categoryRoutes');

// Initialize DB connection
connectDB();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Basic session setup (for simulation purposes). In production use a secure store.
app.use(session({
  name: 'sid',
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Optional: simulate a logged-in user when SIMULATE_USER_ID is provided (useful for local testing)
if (process.env.SIMULATE_USER_ID) {
  app.use((req, res, next) => {
    try {
      req.session.userId = req.session.userId || process.env.SIMULATE_USER_ID;
      res.cookie('userId', req.session.userId, { httpOnly: true });
    } catch (e) { /* ignore */ }
    next();
  });
}

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoriesRouter);

// Keep your other mounts if they exist
app.use('/', wishlistRoutes);
app.use('/', cartRoutes);

// debug / health checks
app.get('/ping', (req, res) => res.send('pong'));
app.get('/api/ping', (req, res) => res.json({ success: true, message: 'api pong' }));

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

module.exports = app;
