const crypto = require('crypto');

// Generate a unique referral code
exports.generateReferralCode = async () => {
  // Lazy require to avoid circular dependency
  const User = require('../models/User');

  let referralCode;
  let isUnique = false;

  while (!isUnique) {
    // Generate a random 8-character code
    referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    try {
      // Check if code already exists
      const existingUser = await User.findOne({ referralCode });
      if (!existingUser) {
        isUnique = true;
      }
    } catch (error) {
      console.error('Error checking referral code uniqueness:', error);
      // If there's an error, return a random code and hope for the best
      return crypto.randomBytes(4).toString('hex').toUpperCase();
    }
  }

  return referralCode;
};

// Validate referral code format
exports.validateReferralCode = (code) => {
  // Check if code is 8 characters long and contains only hexadecimal characters
  return /^[0-9A-F]{8}$/.test(code);
};

// Calculate commission amount
exports.calculateCommission = (amount, percentage) => {
  return (amount * percentage) / 100;
};

// Check if referral is still active
exports.isReferralActive = (startDate, endDate) => {
  const now = new Date();
  return now >= startDate && now <= endDate;
}; 