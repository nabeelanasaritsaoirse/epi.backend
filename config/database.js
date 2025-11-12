const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  // Use environment variable if available, otherwise fallback to epi_backend
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/epi_backend';
  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log(`✅ MongoDB Connected to ${mongoose.connection.name}`);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
