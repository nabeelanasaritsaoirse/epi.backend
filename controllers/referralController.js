// controllers/referralController.js
const mongoose = require("mongoose");
const User = require("../models/User");
const Referral = require("../models/Referral");
const DailyCommission = require("../models/DailyCommission");
const CommissionWithdrawal = require("../models/CommissionWithdrawal");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { generateReferralCode } = require("../utils/referralUtils");

/**
 * Keep existing public API but add product-level commission/pending tracking (Option B)
 */

/* ---------- generateReferralCode ---------- */
exports.generateReferralCode = async (userId) => {
  try {
    if (!userId) throw new Error("User ID is required");

    const existingUser = await User.findById(userId);
    if (!existingUser) throw new Error("User not found");

    // ALWAYS return the existing referral code (user object returned so route can access createdAt/updatedAt).
    return existingUser;
  } catch (error) {
    console.error("Error in generateReferralCode:", error);
    throw new Error("Error fetching referral code: " + error.message);
  }
};

/* ---------- processReferral ----------
   Behavior preserved:
   - Creates Referral doc when processing a referral
   - Also creates a purchase entry (product-level) using installmentDetails
   - Updates referred user's referredBy
*/
exports.processReferral = async (referrerId, referredUserId, installmentDetails) => {
  try {
    const referrer = await User.findById(referrerId);
    const referredUser = await User.findById(referredUserId);
    if (!referrer || !referredUser) throw new Error("User not found");

    // If a referral already exists for this pair, do not create duplicate referral doc
    let existingReferral = await Referral.findOne({
      referrer: referrerId,
      referredUser: referredUserId,
    });

    // Extract base values first then compute totalAmount safely
    const {
      dailyAmount: _dailyAmount = 100,
      days: _days = 30,
      commissionPercentage: _commissionPercentage = 30,
      name = "Default Plan",
      productId = null,
      orderId = null,
    } = installmentDetails || {};

    // compute derived
    const dailyAmount = Number(_dailyAmount) || 100;
    const days = Number(_days) || 30;
    const commissionPercentage = Number(_commissionPercentage) || 30;
    const totalAmount = (installmentDetails && installmentDetails.totalAmount != null)
      ? Number(installmentDetails.totalAmount)
      : dailyAmount * days;

    if (!existingReferral) {
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + days);

      // Create new referral document
      existingReferral = await Referral.create({
        referrer: referrerId,
        referredUser: referredUserId,
        status: "ACTIVE",
        startDate,
        endDate,
        dailyAmount,
        days,
        totalAmount,
        commissionPercentage,
        installmentDetails: Object.assign({}, installmentDetails, { name }),
      });

      // Add the initial purchase entry (product-level)
      const productSnapshot = {};
      if (productId) {
        try {
          let product;
          if (mongoose.Types.ObjectId.isValid(productId) && productId.length === 24) {
            product = await Product.findById(productId).select("productId name");
          }
          if (!product) {
            product = await Product.findOne({ productId }).select("productId name");
          }
          if (product) {
            productSnapshot.productId = product.productId;
            productSnapshot.productName = product.name;
          }
        } catch (err) {
          // ignore snapshot if product fetch fails
        }
      }
      await existingReferral.addPurchase(orderId || null, productId || null, totalAmount || 0, productSnapshot, { dailyAmount, days, commissionPercentage });
    } else {
      // if exists, optionally add another purchase entry when installmentDetails provided with product/order
      if (installmentDetails && (installmentDetails.productId || installmentDetails.orderId || installmentDetails.totalAmount)) {
        const productSnapshot = {};
        if (installmentDetails.productId) {
          try {
            let product;
            if (mongoose.Types.ObjectId.isValid(installmentDetails.productId) && installmentDetails.productId.length === 24) {
              product = await Product.findById(installmentDetails.productId).select("productId name");
            }
            if (!product) {
              product = await Product.findOne({ productId: installmentDetails.productId }).select("productId name");
            }
            if (product) {
              productSnapshot.productId = product.productId;
              productSnapshot.productName = product.name;
            }
          } catch (err) {}
        }
        await existingReferral.addPurchase(
          installmentDetails.orderId || null,
          installmentDetails.productId || null,
          installmentDetails.totalAmount || 0,
          productSnapshot,
          { dailyAmount, days, commissionPercentage }
        );
      }
    }

    // Link referredUser -> referredBy (if not already linked)
    await User.findByIdAndUpdate(referredUserId, { $set: { referredBy: referrerId } }, { new: false });

    return existingReferral;
  } catch (error) {
    console.error("Error in processReferral:", error);
    throw new Error("Error processing referral: " + error.message);
  }
};

/* ---------- processDailyCommission ----------
   Now iterates product-level purchases and credits commissions per purchase.
*/
exports.processDailyCommission = async () => {
  try {
    const activeReferrals = await Referral.find({
      status: "ACTIVE",
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    for (const referral of activeReferrals) {
      // Fetch fresh copy to avoid stale embedded doc issues
      const r = await Referral.findById(referral._id);
      let referralChanged = false;

      for (let i = 0; i < r.purchases.length; i++) {
        const purchase = r.purchases[i];

        // Skip non-active purchases
        if (!purchase || purchase.status !== "ACTIVE") continue;

        // Skip if already completed
        if (purchase.paidDays >= (purchase.days || 0)) {
          if (purchase.status !== 'COMPLETED') {
            purchase.status = 'COMPLETED';
            referralChanged = true;
          }
          continue;
        }

        // Prevent duplicate commission for same purchase on same day using lastPaidDate
        if (purchase.lastPaidDate) {
          const lastPaid = new Date(purchase.lastPaidDate);
          lastPaid.setHours(0, 0, 0, 0);
          if (lastPaid.getTime() === today.getTime()) continue;
        }

        // Commission calculation for this purchase
        const commissionAmount = ((purchase.dailyAmount || r.dailyAmount || 0) * (purchase.commissionPercentage || r.commissionPercentage || 0)) / 100;

        // Create DailyCommission entry (one per purchase/day)
        await DailyCommission.create({
          referral: r._id,
          referrer: r.referrer,
          amount: commissionAmount,
          date: new Date(),
          status: "PAID",
        });

        // Update purchase-level fields
        purchase.paidDays = (purchase.paidDays || 0) + 1;
        purchase.lastPaidDate = new Date();
        purchase.pendingDays = Math.max(0, (purchase.days || 0) - (purchase.paidDays || 0));

        // Update referral-level aggregates
        r.commissionEarned = (r.commissionEarned || 0) + commissionAmount;
        r.daysPaid = (r.daysPaid || 0) + 1;
        r.lastPaidDate = new Date();

        // Update user wallet & transactions
        await User.findByIdAndUpdate(r.referrer, {
          $inc: {
            totalEarnings: commissionAmount,
            availableBalance: commissionAmount,
            "wallet.balance": commissionAmount,
          },
          $push: {
            "wallet.transactions": {
              type: "referral_commission",
              amount: commissionAmount,
              description: `Daily commission for referral ${r._id} (purchase ${purchase._id})`,
              createdAt: new Date(),
            },
          },
        });

        referralChanged = true;

        // If purchase completed, mark status
        if (purchase.paidDays >= (purchase.days || 0)) {
          purchase.status = "COMPLETED";
        }
      } // end purchases loop

      // Recalculate referral-level pendingDays (aggregate)
      r.pendingDays = r.purchases.reduce((sum, p) => sum + (p.pendingDays || 0), 0);

      // If all purchases completed mark referral completed
      const allCompleted = r.purchases.length > 0 && r.purchases.every(p => p.status === 'COMPLETED');
      if (allCompleted) {
        r.status = 'COMPLETED';
        r.endDate = r.endDate || new Date();
      }

      if (referralChanged) {
        await r.save();
      }
    }
  } catch (error) {
    console.error("Error processing daily commission:", error);
    throw new Error("Error processing daily commission: " + error.message);
  }
};

/* ---------- requestWithdrawal ---------- */
exports.requestWithdrawal = async (userId, amount, paymentMethod, paymentDetails) => {
  try {
    const user = await User.findById(userId);
    if (!user || user.wallet?.balance < amount) {
      return {
        success: false,
        message: "Withdrawal request failed: Insufficient balance.",
        withdrawal: {},
      };
    }

    const withdrawal = await CommissionWithdrawal.create({
      user: userId,
      amount,
      paymentMethod,
      paymentDetails,
    });

    await User.findByIdAndUpdate(userId, {
      $inc: { availableBalance: -amount, "wallet.balance": -amount },
      $push: {
        "wallet.transactions": {
          type: "withdrawal",
          amount: -amount,
          description: `Withdrawal request #${withdrawal._id}`,
          createdAt: new Date(),
        },
      },
    });

    return {
      success: true,
      message: "Withdrawal request submitted successfully.",
      withdrawal: withdrawal,
    };
  } catch (error) {
    return {
      success: false,
      message: "Withdrawal request failed: " + error.message,
      withdrawal: {},
    };
  }
};

/* ---------- getReferralStats ----------
   Adds totalProducts & totalCommission aggregations (per referrer)
*/
exports.getReferralStats = async (userId) => {
  try {
    const referrals = await Referral.find({ referrer: userId });
    const dailyCommissions = await DailyCommission.find({ referrer: userId });
    const withdrawals = await CommissionWithdrawal.find({ user: userId });

    const totalEarnings = dailyCommissions.reduce((sum, c) => sum + (c.amount || 0), 0);
    const totalWithdrawn = withdrawals.filter(w => ['COMPLETED', 'PENDING'].includes(w.status)).reduce((sum, w) => sum + (w.amount || 0), 0);

    // new aggregates
    const totalProducts = referrals.reduce((sum, r) => sum + (r.purchases ? r.purchases.length : 0), 0);
    const totalCommission = referrals.reduce((sum, r) => sum + (r.totalCommission || 0), 0);

    const totalReferrals = referrals.length;
    const activeReferrals = referrals.filter(r => r.status === 'ACTIVE').length;

    return {
      totalReferrals,
      activeReferrals,
      totalProducts,
      totalCommission,
      totalEarnings,
      totalWithdrawn,
      availableBalance: totalEarnings - totalWithdrawn,
    };
  } catch (error) {
    throw new Error("Error getting referral stats: " + error.message);
  }
};

/* ---------- updateWithdrawalStatus ---------- */
exports.updateWithdrawalStatus = async (withdrawalId, status, transactionId = null) => {
  try {
    if (!['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'].includes(status)) throw new Error('Invalid status value');

    const updates = { status, processedAt: status === 'COMPLETED' ? new Date() : null };
    if (transactionId) updates.transactionId = transactionId;

    const withdrawal = await CommissionWithdrawal.findByIdAndUpdate(withdrawalId, { $set: updates }, { new: true });
    if (!withdrawal) throw new Error('Withdrawal not found');
    return withdrawal;
  } catch (error) {
    throw new Error('Error updating withdrawal status: ' + error.message);
  }
};

/* ---------- getMissedPaymentDays ----------
   Provide product-level missed days (per purchase) and referral-level aggregates.
*/
exports.getMissedPaymentDays = async (referralId) => {
  try {
    const referral = await Referral.findById(referralId);
    if (!referral) throw new Error('Referral not found');

    const now = new Date();

    const purchaseDetails = referral.purchases.map((p) => {
      const start = p.date ? new Date(p.date) : referral.startDate || null;
      if (!start) return { purchaseId: p._id, message: 'No start date available' };

      const totalDaysSinceStart = Math.ceil((now - start) / (1000 * 60 * 60 * 24));
      const expectedPaymentDays = Math.min(totalDaysSinceStart, p.days || 0);
      const missedDays = Math.max(0, expectedPaymentDays - (p.paidDays || 0));
      return {
        purchaseId: p._id,
        product: p.productSnapshot || {},
        totalDaysSinceStart,
        expectedPaymentDays,
        actualPaidDays: p.paidDays || 0,
        missedDays,
        lastPaidDate: p.lastPaidDate || null,
        startDate: start,
        endDate: (() => { const d = new Date(start); d.setDate(d.getDate() + (p.days || 0)); return d; })(),
      };
    });

    const totalMissed = purchaseDetails.reduce((s, pd) => s + (pd.missedDays || 0), 0);
    const totalPaid = referral.purchases.reduce((s, p) => s + (p.paidDays || 0), 0);

    return {
      referralId: referral._id,
      totalMissed,
      totalPaid,
      purchases: purchaseDetails,
    };
  } catch (error) {
    throw new Error('Error getting missed payment days: ' + error.message);
  }
};

/* ---------- getReferralList (Screen 1) ---------- */
exports.getReferralList = async (referrerId) => {
  try {
    const InstallmentOrder = require('../models/InstallmentOrder');

    // Get ALL users who were referred by this referrer (using User.referredBy)
    const referredUsers = await User.find({ referredBy: referrerId })
      .select('name email profilePicture createdAt')
      .sort({ createdAt: -1 });

    // For each referred user, get their referral data (if exists)
    const referralList = await Promise.all(referredUsers.map(async (user) => {
      // Get legacy referral data
      const referral = await Referral.findOne({
        referrer: referrerId,
        referredUser: user._id
      }).populate('purchases.product', 'productId name');

      // Get installment orders data (NEW - this is the primary source now)
      // IMPORTANT: Only include orders where first payment has been made (status !== 'PENDING' AND paidInstallments > 0)
      const installmentOrders = await InstallmentOrder.find({
        referrer: referrerId,
        user: user._id,
        status: { $ne: 'PENDING' },  // Exclude orders where first payment not completed
        paidInstallments: { $gt: 0 } // Ensure at least one installment has been paid
      }).populate('product', 'name images productId');

      let totalProducts = 0;
      let totalCommission = 0;
      let productList = [];

      // Create a Set of InstallmentOrder product IDs to detect duplicates
      const installmentOrderProductIds = new Set();
      const installmentOrderIds = new Set();
      installmentOrders.forEach((order) => {
        if (order.product?.productId) {
          installmentOrderProductIds.add(order.product.productId);
        }
        if (order._id) {
          installmentOrderIds.add(order._id.toString());
        }
      });

      // Include legacy referral data (only if NOT already in InstallmentOrder)
      if (referral && referral.purchases && referral.purchases.length > 0) {
        // Filter out legacy purchases that have a matching InstallmentOrder
        const uniqueLegacyPurchases = referral.purchases.filter((p) => {
          const legacyProductId = p.productSnapshot?.productId || (p.product ? p.product.productId : null);
          const legacyOrderId = p.orderId ? p.orderId.toString() : null;

          // Skip if this product already exists in InstallmentOrder
          if (legacyProductId && installmentOrderProductIds.has(legacyProductId)) {
            return false;
          }
          // Skip if this orderId already exists in InstallmentOrder
          if (legacyOrderId && installmentOrderIds.has(legacyOrderId)) {
            return false;
          }
          return true;
        });

        totalProducts += uniqueLegacyPurchases.length;
        totalCommission += uniqueLegacyPurchases.reduce((sum, p) => sum + ((p.commissionPerDay || 0) * (p.paidDays || 0)), 0);

        productList = uniqueLegacyPurchases.map((p) => ({
          productName: p.productSnapshot?.productName || (p.product ? p.product.name : null),
          productId: p.productSnapshot?.productId || (p.product ? p.product.productId : null),
          productImage: null, // Legacy doesn't have images
          pendingStatus: (p.pendingDays || 0) > 0 ? "PENDING" : p.status,
          totalAmount: p.amount,
          earnedCommission: (p.commissionPerDay || 0) * (p.paidDays || 0),
          dateOfPurchase: p.date,
          source: 'legacy'
        }));
      }

      // Include installment orders data (PRIMARY source - always included)
      if (installmentOrders && installmentOrders.length > 0) {
        totalProducts += installmentOrders.length;

        const installmentProducts = installmentOrders.map((order) => {
          const commissionEarned = order.totalCommissionPaid || 0;
          totalCommission += commissionEarned;

          return {
            productName: order.productName,
            productId: order.product?.productId || null,
            productImage: order.product?.images?.[0] || null,
            pendingStatus: order.status,
            totalAmount: order.productPrice,
            earnedCommission: commissionEarned,
            dateOfPurchase: order.createdAt,
            source: 'installment',
            orderId: order.orderId
          };
        });

        productList = [...productList, ...installmentProducts];
      }

      // Sort products by date (newest first)
      productList.sort((a, b) => new Date(b.dateOfPurchase) - new Date(a.dateOfPurchase));

      return {
        _id: referral?._id || user._id,
        referredUser: {
          _id: user._id,
          name: user.name,
          profilePicture: user.profilePicture || '',
        },
        totalProducts,
        totalCommission,
        productList,
        joinedAt: user.createdAt,
      };
    }));

    return { success: true, referrals: referralList };
  } catch (error) {
    throw new Error('Error fetching referral list: ' + error.message);
  }
};

/* ---------- getReferredUserDetails (Screen 2) ---------- */
exports.getReferredUserDetails = async (referredUserId, referrerId = null) => {
  try {
    const InstallmentOrder = require('../models/InstallmentOrder');

    const referredUser = await User.findById(referredUserId).select('name email profilePicture referredBy');
    if (!referredUser) throw new Error('Referred user not found');

    // Use the referrerId passed in, or fall back to referredUser.referredBy
    const actualReferrerId = referrerId || referredUser.referredBy;

    let totalProducts = 0;
    let totalCommission = 0;
    let products = [];

    // Get legacy referral data
    const referral = await Referral.findOne({ referredUser: referredUserId }).populate('purchases.product', 'productId name pricing');

    // Get InstallmentOrder data first (PRIMARY source - to detect duplicates)
    let installmentOrders = [];
    const installmentOrderProductIds = new Set();
    const installmentOrderIds = new Set();

    if (actualReferrerId) {
      // IMPORTANT: Only include orders where first payment has been made (status !== 'PENDING' AND paidInstallments > 0)
      installmentOrders = await InstallmentOrder.find({
        referrer: actualReferrerId,
        user: referredUserId,
        status: { $ne: 'PENDING' },  // Exclude orders where first payment not completed
        paidInstallments: { $gt: 0 } // Ensure at least one installment has been paid
      }).populate('product', 'name images productId');

      // Build sets for duplicate detection
      installmentOrders.forEach((order) => {
        if (order.product?.productId) {
          installmentOrderProductIds.add(order.product.productId);
        }
        if (order._id) {
          installmentOrderIds.add(order._id.toString());
        }
      });
    }

    // Include legacy referral data (only if NOT already in InstallmentOrder)
    if (referral && referral.purchases && referral.purchases.length > 0) {
      // Filter out legacy purchases that have a matching InstallmentOrder
      const uniqueLegacyPurchases = referral.purchases.filter((p) => {
        const legacyProductId = p.productSnapshot?.productId || (p.product ? p.product.productId : null);
        const legacyOrderId = p.orderId ? p.orderId.toString() : null;

        // Skip if this product already exists in InstallmentOrder
        if (legacyProductId && installmentOrderProductIds.has(legacyProductId)) {
          return false;
        }
        // Skip if this orderId already exists in InstallmentOrder
        if (legacyOrderId && installmentOrderIds.has(legacyOrderId)) {
          return false;
        }
        return true;
      });

      totalProducts += uniqueLegacyPurchases.length;
      totalCommission += uniqueLegacyPurchases.reduce((c, p) => c + ((p.commissionPerDay || 0) * (p.paidDays || 0)), 0);

      products = uniqueLegacyPurchases.map((p) => {
        return {
          productId: p.productSnapshot?.productId || (p.product ? p.product.productId : null),
          productName: p.productSnapshot?.productName || (p.product ? p.product.name : null),
          productImage: null,
          pendingStatus: (p.pendingDays || 0) > 0 ? "PENDING" : p.status,
          totalAmount: p.amount,
          dateOfPurchase: p.date,
          days: p.days,
          commissionPerDay: p.commissionPerDay || ((p.dailyAmount || referral.dailyAmount || 0) * (p.commissionPercentage || referral.commissionPercentage || 0) / 100),
          paidDays: p.paidDays || 0,
          pendingDays: p.pendingDays || 0,
          source: 'legacy'
        };
      });
    }

    // Include InstallmentOrder data (PRIMARY source - always included)
    if (installmentOrders && installmentOrders.length > 0) {
      totalProducts += installmentOrders.length;

      const installmentProducts = installmentOrders.map((order) => {
        const paidInstallments = order.paidInstallments || 0;
        const totalDays = order.totalDays || 0;
        const dailyAmount = order.dailyPaymentAmount || 0;
        const commissionPct = order.productCommissionPercentage || order.commissionPercentage || 10;
        const commissionPerDay = (dailyAmount * commissionPct) / 100;
        const commissionEarned = order.totalCommissionPaid || 0;

        totalCommission += commissionEarned;

        return {
          productId: order.product?.productId || null,
          productName: order.productName,
          productImage: order.product?.images?.[0] || null,
          pendingStatus: order.status,
          totalAmount: order.productPrice,
          dateOfPurchase: order.createdAt,
          days: totalDays,
          commissionPerDay: commissionPerDay,
          paidDays: paidInstallments,
          pendingDays: Math.max(0, totalDays - paidInstallments),
          source: 'installment',
          orderId: order.orderId
        };
      });

      products = [...products, ...installmentProducts];
    }

    // Sort products by date (newest first)
    products.sort((a, b) => new Date(b.dateOfPurchase) - new Date(a.dateOfPurchase));

    return {
      success: true,
      friendDetails: {
        _id: referredUser._id,
        name: referredUser.name,
        email: referredUser.email,
        profilePicture: referredUser.profilePicture,
        totalProducts,
        totalCommission,
        products,
      },
    };
  } catch (error) {
    throw new Error('Error fetching referred user details: ' + error.message);
  }
};

/* ---------- getReferralProductDetails (Screen 3) ---------- */

exports.getReferralProductDetails = async (referredUserId, productId, orderId = null) => {
  try {
    const InstallmentOrder = require('../models/InstallmentOrder');

    // First check if it's an InstallmentOrder (by orderId or productId)
    let installmentOrder = null;

    if (orderId) {
      installmentOrder = await InstallmentOrder.findOne({
        user: referredUserId,
        orderId: orderId
      }).populate('product', 'productId name images pricing');
    }

    if (!installmentOrder && productId) {
      // Try to find by product's productId
      const Product = require('../models/Product');
      const product = await Product.findOne({ productId: productId }).select('_id');

      if (product) {
        installmentOrder = await InstallmentOrder.findOne({
          user: referredUserId,
          product: product._id
        }).populate('product', 'productId name images pricing');
      }
    }

    // If found in InstallmentOrder, return that data
    if (installmentOrder) {
      const paidInstallments = installmentOrder.paidInstallments || 0;
      const totalDays = installmentOrder.totalDays || 0;
      const dailyAmount = installmentOrder.dailyPaymentAmount || 0;
      const commissionPct = installmentOrder.productCommissionPercentage || installmentOrder.commissionPercentage || 10;
      const commissionPerDay = (dailyAmount * commissionPct) / 100;
      const totalCommission = commissionPerDay * totalDays;
      const earnedCommission = installmentOrder.totalCommissionPaid || 0;
      const pendingDays = Math.max(0, totalDays - paidInstallments);
      const pendingInvestmentAmount = pendingDays * commissionPerDay;

      return {
        success: true,
        productDetails: {
          productName: installmentOrder.productName,
          productId: installmentOrder.product?.productId || productId,
          productImage: installmentOrder.product?.images?.[0] || null,
          dateOfPurchase: installmentOrder.createdAt,
          totalPrice: installmentOrder.productPrice,
          commissionPerDay,
          totalCommission,
          earnedCommission,
          pendingDays,
          pendingInvestmentAmount,
          status: installmentOrder.status,
          dailySip: dailyAmount,
          paidDays: paidInstallments,
          totalDays: totalDays,
          orderId: installmentOrder.orderId,
          source: 'installment'
        },
      };
    }

    // Fall back to legacy Referral data
    const referral = await Referral.findOne({ referredUser: referredUserId })
      .populate("purchases.product", "productId name pricing");

    if (!referral) throw new Error("Referral not found");

    const purchase = referral.purchases.find((p) => {
      return (
        p.productSnapshot?.productId === productId ||
        (p.product && p.product.productId === productId)
      );
    });

    if (!purchase) throw new Error("Product not found in referral history");

    const commissionPerDay =
      purchase.commissionPerDay ||
      ((purchase.dailyAmount || referral.dailyAmount || 0) *
        (purchase.commissionPercentage || referral.commissionPercentage || 0)) /
        100;

    const totalCommission = commissionPerDay * (purchase.days || 0);
    const earnedCommission = (purchase.paidDays || 0) * commissionPerDay;

    const pendingDays =
      purchase.pendingDays ||
      Math.max(0, (purchase.days || 0) - (purchase.paidDays || 0));

    const pendingInvestmentAmount = pendingDays * commissionPerDay;

    return {
      success: true,
      productDetails: {
        productName:
          purchase.productSnapshot?.productName ||
          (purchase.product ? purchase.product.name : null),
        productId:
          purchase.productSnapshot?.productId ||
          (purchase.product ? purchase.product.productId : null),
        productImage: null,
        dateOfPurchase: purchase.date,
        totalPrice: purchase.amount,
        commissionPerDay,
        totalCommission,
        earnedCommission,
        pendingDays,
        pendingInvestmentAmount,
        status: purchase.status,
        dailySip: purchase.dailyAmount || referral.dailyAmount || 0,
        paidDays: purchase.paidDays || 0,
        totalDays: purchase.days || 0,
        source: 'legacy'
      },
    };
  } catch (error) {
    throw new Error("Error fetching referral product details: " + error.message);
  }
};

/* ---------- getReferrerInfo (logged-in user's referrer) ---------- */
exports.getReferrerInfo = async (req, res) => {
  try {
    // Normalize ways user id may be provided by the auth middleware
    let resolvedUserId = null;
    if (req.user) {
      resolvedUserId = req.user._id || req.user.id || req.user.userId || null;
      // If req.user is a string id (some middlewares), handle that
      if (!resolvedUserId && typeof req.user === "string") resolvedUserId = req.user;
    }
    resolvedUserId = resolvedUserId || req.query?.userId || req.body?.userId;

    if (!resolvedUserId) {
      return res.status(400).json({ success: false, error: "User ID is required" });
    }

    const user = await User.findById(resolvedUserId).populate(
      "referredBy",
      "name email profilePicture referralCode"
    );

    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    if (!user.referredBy) return res.json({ success: true, referredBy: null });

    const ref = user.referredBy;
    return res.json({
      success: true,
      referredBy: {
        userId: ref._id,
        name: ref.name || "",
        email: ref.email || "",
        profilePicture: ref.profilePicture || "",
        referralCode: ref.referralCode || "",
      },
    });
  } catch (error) {
    console.error("Error in getReferrerInfo:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/* ---------- getComprehensiveReferralStats ----------
   Returns complete referral statistics including:
   - Referral code and limit info
   - Total/active/pending/completed referrals count
   - Earnings and commission breakdown
   - Purchase statistics
   - Optional: List of referred users with details
*/
exports.getComprehensiveReferralStats = async (req, res) => {
  try {
    // Get user ID from authenticated user
    const userId = req.user._id || req.user.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required"
      });
    }

    // Check if detailed user list is requested
    const includeDetails = req.query.detailed === 'true';

    // Fetch the current user
    const user = await User.findById(userId).select(
      'name email referralCode referralLimit'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    // Get all referrals made by this user
    const referrals = await Referral.find({ referrer: userId });

    // Get all users referred by this user
    const referredUsers = await User.find({ referredBy: userId })
      .select('name email profilePicture createdAt')
      .sort({ createdAt: -1 });

    // Get commission and withdrawal data
    const dailyCommissions = await DailyCommission.find({ referrer: userId });
    const withdrawals = await CommissionWithdrawal.find({ user: userId });

    // Calculate statistics
    const totalReferrals = referredUsers.length;
    const referralLimit = user.referralLimit || 50;
    const remainingReferrals = Math.max(0, referralLimit - totalReferrals);
    const referralLimitReached = totalReferrals >= referralLimit;

    // Referral status breakdown
    const activeReferrals = referrals.filter(r => r.status === 'ACTIVE').length;
    const pendingReferrals = referrals.filter(r => r.status === 'PENDING').length;
    const completedReferrals = referrals.filter(r => r.status === 'COMPLETED').length;
    const cancelledReferrals = referrals.filter(r => r.status === 'CANCELLED').length;

    // Earnings calculations
    const totalEarnings = dailyCommissions.reduce((sum, c) => sum + (c.amount || 0), 0);
    const totalCommission = referrals.reduce((sum, r) => sum + (r.totalCommission || 0), 0);
    const totalWithdrawn = withdrawals
      .filter(w => ['COMPLETED', 'PENDING'].includes(w.status))
      .reduce((sum, w) => sum + (w.amount || 0), 0);
    const availableBalance = totalEarnings - totalWithdrawn;

    // Purchase statistics
    const totalProducts = referrals.reduce((sum, r) =>
      sum + (r.purchases ? r.purchases.length : 0), 0
    );
    const totalPurchaseValue = referrals.reduce((sum, r) =>
      sum + (r.totalPurchaseValue || 0), 0
    );

    // Build referral link
    const baseUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'https://yourapp.com';
    const referralLink = `${baseUrl}/signup?referral=${user.referralCode}`;

    // Build response data
    const responseData = {
      referralCode: user.referralCode,
      referralLink,
      totalReferrals,
      referralLimit,
      remainingReferrals,
      referralLimitReached,
      referralStats: {
        activeReferrals,
        pendingReferrals,
        completedReferrals,
        cancelledReferrals,
      },
      earnings: {
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        totalCommission: Math.round(totalCommission * 100) / 100,
        availableBalance: Math.round(availableBalance * 100) / 100,
        totalWithdrawn: Math.round(totalWithdrawn * 100) / 100,
      },
      purchases: {
        totalProducts,
        totalPurchaseValue: Math.round(totalPurchaseValue * 100) / 100,
      },
    };

    // If detailed view is requested, include referred users list
    if (includeDetails) {
      const referredUsersDetailed = await Promise.all(
        referredUsers.map(async (refUser) => {
          const referral = await Referral.findOne({
            referrer: userId,
            referredUser: refUser._id,
          });

          let totalProducts = 0;
          let totalCommission = 0;
          let status = 'PENDING';

          if (referral) {
            totalProducts = referral.purchases ? referral.purchases.length : 0;
            totalCommission = referral.purchases
              ? referral.purchases.reduce((sum, p) =>
                  sum + ((p.commissionPerDay || 0) * (p.paidDays || 0)), 0
                )
              : 0;
            status = referral.status;
          }

          return {
            id: refUser._id,
            name: refUser.name,
            email: refUser.email,
            profilePicture: refUser.profilePicture || '',
            joinedAt: refUser.createdAt,
            status,
            totalProducts,
            totalCommission: Math.round(totalCommission * 100) / 100,
          };
        })
      );

      responseData.referredUsers = referredUsersDetailed;
    }

    return res.json({
      success: true,
      data: responseData,
      message: "Referral statistics retrieved successfully",
    });

  } catch (error) {
    console.error("Error in getComprehensiveReferralStats:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

