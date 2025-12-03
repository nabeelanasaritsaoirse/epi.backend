const mongoose = require('mongoose');

// This is a test middleware - DO NOT USE IN PRODUCTION
function requireUser(req, res, next) {
  // For testing: Set a mock user ID as a valid ObjectId
  // Using a consistent test ObjectId for development/testing
  req.userId = new mongoose.Types.ObjectId("507f1f77bcf86cd799439011");
  next();
}

module.exports = { requireUser };