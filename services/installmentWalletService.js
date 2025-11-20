/**
 * Installment Wallet Service
 *
 * Handles wallet operations for installment order system:
 * - Deduct from wallet for order payments
 * - Credit commission to referrer wallet (90-10 split)
 * - Get wallet balance
 * - Create wallet transactions with MongoDB transactions
 *
 * IMPORTANT: All operations use MongoDB sessions for atomic transactions
 */

const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const { splitCommission } = require('../utils/installmentHelpers');
const {
  UserNotFoundError,
  InsufficientWalletBalanceError
} = require('../utils/customErrors');

/**
 * Get wallet balance for user
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object>} { totalBalance, availableBalance, lockedBalance }
 */
async function getWalletBalance(userId) {
  const user = await User.findById(userId).select('wallet');

  if (!user) {
    throw new UserNotFoundError(userId);
  }

  return {
    totalBalance: user.wallet.balance + user.wallet.holdBalance,
    availableBalance: user.wallet.balance,
    lockedBalance: user.wallet.holdBalance,
    referralBonus: user.wallet.referralBonus || 0,
    investedAmount: user.wallet.investedAmount || 0
  };
}

/**
 * Deduct amount from user wallet
 *
 * IMPORTANT: Must be called within a MongoDB transaction session
 *
 * @param {string} userId - User ID
 * @param {number} amount - Amount to deduct
 * @param {string} description - Transaction description
 * @param {Object} session - MongoDB session for transaction
 * @param {Object} metadata - Additional metadata for transaction
 * @returns {Promise<Object>} { user, walletTransaction }
 * @throws {UserNotFoundError} If user not found
 * @throws {InsufficientWalletBalanceError} If insufficient balance
 */
async function deductFromWallet(userId, amount, description, session, metadata = {}) {
  // Get user with session lock
  const user = await User.findById(userId).session(session);

  if (!user) {
    throw new UserNotFoundError(userId);
  }

  // Check available balance
  const availableBalance = user.wallet.balance || 0;

  if (availableBalance < amount) {
    throw new InsufficientWalletBalanceError(amount, availableBalance);
  }

  // Deduct from wallet
  user.wallet.balance -= amount;
  await user.save({ session });

  // Create wallet transaction record
  const walletTransaction = new WalletTransaction({
    user: userId,
    type: 'withdrawal',
    amount: -amount, // Negative for deduction
    description: description || 'Installment payment via wallet',
    status: 'completed',
    meta: {
      ...metadata,
      balanceAfter: user.wallet.balance
    }
  });

  await walletTransaction.save({ session });

  return {
    user,
    walletTransaction
  };
}

/**
 * Credit commission to referrer wallet with 90-10 split
 *
 * Business Rule:
 * - 90% goes to available balance (withdrawable)
 * - 10% goes to locked balance (holdBalance for investment)
 *
 * IMPORTANT: Must be called within a MongoDB transaction session
 *
 * @param {string} referrerId - Referrer user ID
 * @param {number} totalCommission - Total commission amount
 * @param {string} orderId - Related order ID
 * @param {string} paymentId - Related payment ID
 * @param {Object} session - MongoDB session for transaction
 * @returns {Promise<Object>} { user, availableAmount, lockedAmount, walletTransaction }
 * @throws {UserNotFoundError} If referrer not found
 */
async function creditCommissionToWallet(
  referrerId,
  totalCommission,
  orderId,
  paymentId,
  session
) {
  // Get referrer with session lock
  const referrer = await User.findById(referrerId).session(session);

  if (!referrer) {
    throw new UserNotFoundError(referrerId);
  }

  // Split commission: 90% available, 10% locked
  const { availableAmount, lockedAmount } = splitCommission(totalCommission);

  // Credit to wallet
  referrer.wallet.balance += availableAmount; // 90% available for withdrawal
  referrer.wallet.holdBalance += lockedAmount; // 10% locked for investment
  referrer.wallet.referralBonus = (referrer.wallet.referralBonus || 0) + totalCommission;

  await referrer.save({ session });

  // Create wallet transaction for available amount (90%)
  const walletTransaction = new WalletTransaction({
    user: referrerId,
    type: 'referral_bonus',
    amount: availableAmount, // Only the withdrawable portion
    description: `Commission earned (90% available): Order ${orderId}`,
    status: 'completed',
    meta: {
      orderId,
      paymentId,
      totalCommission,
      availableAmount,
      lockedAmount,
      commissionSplit: '90-10',
      balanceAfter: referrer.wallet.balance,
      holdBalanceAfter: referrer.wallet.holdBalance
    }
  });

  await walletTransaction.save({ session });

  // Create separate transaction record for locked amount (10%)
  const lockedTransaction = new WalletTransaction({
    user: referrerId,
    type: 'investment',
    amount: lockedAmount,
    description: `Commission locked (10% for investment): Order ${orderId}`,
    status: 'completed',
    meta: {
      orderId,
      paymentId,
      totalCommission,
      lockedAmount,
      commissionSplit: '90-10',
      holdBalanceAfter: referrer.wallet.holdBalance
    }
  });

  await lockedTransaction.save({ session });

  return {
    user: referrer,
    availableAmount,
    lockedAmount,
    totalCommission,
    walletTransaction, // Main commission transaction
    lockedTransaction // Locked investment transaction
  };
}

/**
 * Add money to wallet (for admin or bonus purposes)
 *
 * IMPORTANT: Must be called within a MongoDB transaction session
 *
 * @param {string} userId - User ID
 * @param {number} amount - Amount to add
 * @param {string} description - Transaction description
 * @param {string} type - Transaction type (default: 'deposit')
 * @param {Object} session - MongoDB session for transaction
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} { user, walletTransaction }
 * @throws {UserNotFoundError} If user not found
 */
async function addMoneyToWallet(
  userId,
  amount,
  description,
  type = 'deposit',
  session,
  metadata = {}
) {
  const user = await User.findById(userId).session(session);

  if (!user) {
    throw new UserNotFoundError(userId);
  }

  // Add to available balance
  user.wallet.balance += amount;
  await user.save({ session });

  // Create transaction record
  const walletTransaction = new WalletTransaction({
    user: userId,
    type,
    amount,
    description: description || 'Money added to wallet',
    status: 'completed',
    meta: {
      ...metadata,
      balanceAfter: user.wallet.balance
    }
  });

  await walletTransaction.save({ session });

  return {
    user,
    walletTransaction
  };
}

/**
 * Get wallet transactions for user
 *
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of wallet transactions
 */
async function getWalletTransactions(userId, options = {}) {
  const {
    type,
    status,
    limit = 50,
    skip = 0,
    startDate,
    endDate
  } = options;

  const query = { user: userId };

  if (type) query.type = type;
  if (status) query.status = status;

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const transactions = await WalletTransaction.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);

  return transactions;
}

/**
 * Get commission earnings summary for referrer
 *
 * @param {string} referrerId - Referrer user ID
 * @returns {Promise<Object>} Commission summary
 */
async function getCommissionSummary(referrerId) {
  const InstallmentOrder = require('../models/InstallmentOrder');

  // Get all orders where this user is the referrer
  const orders = await InstallmentOrder.find({ referrer: referrerId })
    .select('totalCommissionPaid productName status createdAt');

  // Get commission transactions
  const commissionTransactions = await WalletTransaction.find({
    user: referrerId,
    type: { $in: ['referral_bonus', 'investment'] }
  }).sort({ createdAt: -1 });

  // Calculate totals
  const totalCommissionEarned = orders.reduce(
    (sum, order) => sum + (order.totalCommissionPaid || 0),
    0
  );

  const availableCommission = commissionTransactions
    .filter(t => t.type === 'referral_bonus')
    .reduce((sum, t) => sum + t.amount, 0);

  const lockedCommission = commissionTransactions
    .filter(t => t.type === 'investment')
    .reduce((sum, t) => sum + t.amount, 0);

  return {
    totalCommissionEarned,
    availableCommission,
    lockedCommission,
    totalOrders: orders.length,
    activeOrders: orders.filter(o => o.status === 'ACTIVE').length,
    completedOrders: orders.filter(o => o.status === 'COMPLETED').length,
    recentTransactions: commissionTransactions.slice(0, 10)
  };
}

/**
 * Validate wallet balance for payment
 *
 * @param {string} userId - User ID
 * @param {number} amount - Required amount
 * @returns {Promise<boolean>} True if sufficient balance
 * @throws {UserNotFoundError} If user not found
 * @throws {InsufficientWalletBalanceError} If insufficient balance
 */
async function validateWalletBalance(userId, amount) {
  const user = await User.findById(userId).select('wallet');

  if (!user) {
    throw new UserNotFoundError(userId);
  }

  const availableBalance = user.wallet.balance || 0;

  if (availableBalance < amount) {
    throw new InsufficientWalletBalanceError(amount, availableBalance);
  }

  return true;
}

module.exports = {
  getWalletBalance,
  deductFromWallet,
  creditCommissionToWallet,
  addMoneyToWallet,
  getWalletTransactions,
  getCommissionSummary,
  validateWalletBalance
};
