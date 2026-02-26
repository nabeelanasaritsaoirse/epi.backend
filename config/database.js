const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  // Use environment variable if available, otherwise fallback to epi_backend
//  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/epi_backend';
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/epi_backend';

  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 20,                  // Handle concurrent requests (default is 5)
      minPoolSize: 5,                   // Keep 5 connections warm
      socketTimeoutMS: 45000,           // Drop hung queries after 45s
      serverSelectionTimeoutMS: 5000,   // Fail fast if DB unreachable
      autoIndex: process.env.NODE_ENV !== 'production', // Auto-create indexes in dev only
    });
    console.log(`✅ MongoDB Connected to ${mongoose.connection.name}`);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;

