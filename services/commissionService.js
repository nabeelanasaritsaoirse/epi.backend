/**
 * Commission Service
 *
 * Handles commission calculation and crediting for installment orders.
 *
 * Business Rules:
 * - Commission calculated on EVERY payment (not just after order completion)
 * - Default commission rate: 25%
 * - Can be overridden by product.referralBonus.value
 * - Commission automatically split 90% available, 10% locked (handled by wallet service)
 * - Only credits commission if order has a referrer
 */

const walletService = require('./installmentWalletService');
const { calculateCommission } = require('../utils/installmentHelpers');

/**
 * Calculate and credit commission for a payment
 *
 * @param {Object} params - Commission calculation parameters
 * @param {Object} params.order - InstallmentOrder document
 * @param {Object} params.payment - PaymentRecord document
 * @param {Object} params.session - MongoDB transaction session
 * @returns {Promise<Object>} Commission details
 */
async function calculateAndCreditCommission({ order, payment, session }) {
  try {
    // ========================================
    // 1. Check if Order Has Referrer
    // ========================================
    if (!order.referrer) {
      console.log(`⚠️  No referrer for order ${order.orderId}, skipping commission`);
      return {
        commissionCalculated: false,
        reason: 'No referrer'
      };
    }

    // ========================================
    // 2. Get Commission Rate
    // ========================================
    // Priority: order.commissionPercentage > productCommissionPercentage > default 25%
    const commissionRate = order.commissionPercentage || order.productCommissionPercentage || 25;

    // ========================================
    // 3. Calculate Commission on Payment Amount
    // ========================================
    const commissionAmount = calculateCommission(payment.amount, commissionRate);

    if (commissionAmount <= 0) {
      console.log(`⚠️  Commission amount is ₹0 for order ${order.orderId}`);
      return {
        commissionCalculated: false,
        reason: 'Commission amount is zero'
      };
    }

    console.log(`💰 Calculating commission for order ${order.orderId}:`);
    console.log(`   Payment amount: ₹${payment.amount}`);
    console.log(`   Commission rate: ${commissionRate}%`);
    console.log(`   Commission amount: ₹${commissionAmount}`);

    // ========================================
    // 4. Credit Commission to Referrer Wallet
    // ========================================
    // This automatically handles 90-10 split (90% available, 10% locked)
    const commissionResult = await walletService.creditCommissionToWallet(
      order.referrer,
      commissionAmount,
      order._id.toString(),
      payment._id.toString(),
      session
    );

    console.log(`✅ Commission credited to referrer ${order.referrer}`);
    console.log(`   Available: ₹${commissionResult.availableAmount}`);
    console.log(`   Locked: ₹${commissionResult.lockedAmount}`);

    // ========================================
    // 5. Update Payment Record with Commission Details
    // ========================================
    payment.commissionCalculated = true;
    payment.commissionAmount = commissionAmount;
    payment.commissionPercentage = commissionRate;
    payment.commissionCreditedToReferrer = true;
    payment.commissionTransactionId = commissionResult.walletTransaction._id;

    await payment.save({ session });

    // ========================================
    // 6. Update Order's Total Commission Paid
    // ========================================
    order.totalCommissionPaid = (order.totalCommissionPaid || 0) + commissionAmount;
    await order.save({ session });

    console.log(`📊 Order ${order.orderId} total commission: ₹${order.totalCommissionPaid}`);

    // ========================================
    // 7. Return Commission Details
    // ========================================
    return {
      commissionCalculated: true,
      commissionAmount,
      commissionRate,
      availableAmount: commissionResult.availableAmount,
      lockedAmount: commissionResult.lockedAmount,
      referrerId: order.referrer,
      transactionId: commissionResult.walletTransaction._id
    };

  } catch (error) {
    console.error(`❌ Commission calculation failed for order ${order.orderId}:`, error);
    throw error;
  }
}

/**
 * Batch calculate commissions for multiple payments
 * Used in combined daily payment scenarios
 *
 * @param {Array} paymentsData - Array of { order, payment } objects
 * @param {Object} session - MongoDB transaction session
 * @returns {Promise<Array>} Array of commission results
 */
async function batchCalculateCommissions(paymentsData, session) {
  const results = [];

  for (const { order, payment } of paymentsData) {
    try {
      const commissionResult = await calculateAndCreditCommission({
        order,
        payment,
        session
      });
      results.push({
        orderId: order.orderId,
        paymentId: payment.paymentId,
        ...commissionResult
      });
    } catch (error) {
      console.error(`❌ Failed to calculate commission for order ${order.orderId}:`, error);
      // Continue with other payments even if one fails
      results.push({
        orderId: order.orderId,
        paymentId: payment.paymentId,
        commissionCalculated: false,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Get commission summary for an order
 *
 * @param {Object} order - InstallmentOrder document
 * @returns {Object} Commission summary
 */
function getOrderCommissionSummary(order) {
  if (!order.referrer) {
    return {
      hasReferrer: false,
      totalCommissionPaid: 0,
      commissionPercentage: 0
    };
  }

  const commissionRate = order.commissionPercentage || order.productCommissionPercentage || 25;
  const estimatedTotalCommission = (order.productPrice * commissionRate) / 100;
  const remainingCommission = Math.max(0, estimatedTotalCommission - (order.totalCommissionPaid || 0));

  return {
    hasReferrer: true,
    referrerId: order.referrer,
    commissionPercentage: commissionRate,
    totalCommissionPaid: order.totalCommissionPaid || 0,
    estimatedTotalCommission,
    remainingCommission,
    progress: estimatedTotalCommission > 0
      ? Math.round(((order.totalCommissionPaid || 0) / estimatedTotalCommission) * 100)
      : 0
  };
}

module.exports = {
  calculateAndCreditCommission,
  batchCalculateCommissions,
  getOrderCommissionSummary
};
