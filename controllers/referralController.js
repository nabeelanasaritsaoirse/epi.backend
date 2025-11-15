// controllers/referralController.js
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
          const product = await Product.findById(productId).select("productId name");
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
            const product = await Product.findById(installmentDetails.productId).select("productId name");
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
    const referrals = await Referral.find({ referrer: referrerId })
      .populate('referredUser', 'name email profilePicture')
      .populate('purchases.product', 'productId name');

    const referralList = referrals.map((ref) => {
      const totalProducts = ref.purchases.length;
      const totalCommission = ref.purchases.reduce((sum, p) => sum + ((p.commissionPerDay || 0) * (p.paidDays || 0)), 0);

      const productList = ref.purchases.map((p) => ({
        productName: p.productSnapshot?.productName || (p.product ? p.product.name : null),
        productId: p.productSnapshot?.productId || (p.product ? p.product.productId : null),
        pendingStatus: (p.pendingDays || 0) > 0 ? "PENDING" : p.status,
        totalAmount: p.amount,
        dateOfPurchase: p.date,
      }));

      return {
        _id: ref._id,
        referredUser: {
          _id: ref.referredUser._id,
          name: ref.referredUser.name,
          profilePicture: ref.referredUser.profilePicture,
        },
        totalProducts,
        totalCommission,
        productList,
      };
    });

    return { success: true, referrals: referralList };
  } catch (error) {
    throw new Error('Error fetching referral list: ' + error.message);
  }
};

/* ---------- getReferredUserDetails (Screen 2) ---------- */
exports.getReferredUserDetails = async (referredUserId) => {
  try {
    const referredUser = await User.findById(referredUserId).select('name email profilePicture');
    if (!referredUser) throw new Error('Referred user not found');

    const referral = await Referral.findOne({ referredUser: referredUserId }).populate('purchases.product', 'productId name pricing');

    if (!referral) {
      return {
        success: true,
        friendDetails: {
          _id: referredUser._id,
          name: referredUser.name,
          email: referredUser.email,
          profilePicture: referredUser.profilePicture,
          totalProducts: 0,
          totalCommission: 0,
          products: [],
        },
      };
    }

    const totalProducts = referral.purchases.length;
    const totalCommission = referral.purchases.reduce((c, p) => c + ((p.commissionPerDay || 0) * (p.paidDays || 0)), 0);

    const products = referral.purchases.map((p) => {
      return {
        productId: p.productSnapshot?.productId || (p.product ? p.product.productId : null),
        productName: p.productSnapshot?.productName || (p.product ? p.product.name : null),
        pendingStatus: (p.pendingDays || 0) > 0 ? "PENDING" : p.status,
        totalAmount: p.amount,
        dateOfPurchase: p.date,
        days: p.days,
        commissionPerDay: p.commissionPerDay || ((p.dailyAmount || referral.dailyAmount || 0) * (p.commissionPercentage || referral.commissionPercentage || 0) / 100),
        paidDays: p.paidDays || 0,
        pendingDays: p.pendingDays || 0
      };
    });

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
/* ---------- getReferralProductDetails (Screen 3) ---------- */
exports.getReferralProductDetails = async (referredUserId, productId) => {
  try {
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
        dateOfPurchase: purchase.date,
        totalPrice: purchase.amount,

        // EXISTING
        commissionPerDay,
        totalCommission,
        earnedCommission,
        pendingDays,
        pendingInvestmentAmount,
        status: purchase.status,

        // ✅ NEW FIELD — DAILY SIP AMOUNT
        dailySip: purchase.dailyAmount || referral.dailyAmount || 0
      },
    };
  } catch (error) {
    throw new Error("Error fetching referral product details: " + error.message);
  }
};

