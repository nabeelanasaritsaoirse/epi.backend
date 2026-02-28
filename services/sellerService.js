"use strict";

/**
 * Seller Service
 *
 * Houses business logic that is shared between:
 *   - sellerController  (HTTP layer)
 *   - installmentOrderService (order / payment layer)
 *
 * Keeping this in a service avoids a controller → service circular dependency.
 */

const User             = require("../models/User");
const WalletTransaction = require("../models/WalletTransaction");

/**
 * Resolve the platform commission rate for a seller product.
 *
 * Priority:
 *   1. seller.sellerProfile.commissionRate (seller-level override)
 *   2. category.commissionRate             (category-level default)
 *   3. platform default (15%)
 *
 * Pass `categoryCommissionRate` from the calling code to avoid an extra
 * Category query — the caller already has the product (with category ref).
 *
 * @param {string|null}  sellerId
 * @param {number|null}  categoryCommissionRate - commission rate from the product's category (pass null if unknown)
 * @returns {Promise<number>} resolved commission percentage (0–100)
 */
exports.resolveSellerCommissionRate = async (sellerId, categoryCommissionRate) => {
  if (!sellerId) return 0;

  const seller = await User.findById(sellerId, { "sellerProfile.commissionRate": 1 }).lean();

  // 1. Seller-level override (explicit number, not null)
  if (seller?.sellerProfile?.commissionRate != null) {
    return seller.sellerProfile.commissionRate;
  }

  // 2. Category-level default
  if (categoryCommissionRate != null && categoryCommissionRate > 0) {
    return categoryCommissionRate;
  }

  // 3. Platform default
  return 15;
};

/**
 * Credit the seller's wallet after order delivery is confirmed.
 *
 * This is the canonical implementation — call this from any delivery-
 * confirmation flow (installmentOrderService.updateDeliveryStatus, etc.)
 * instead of duplicating the logic.
 *
 * Idempotent: safe to call multiple times — returns silently if the order
 * has already been credited (sellerFulfillmentStatus === "delivered").
 *
 * @param {Object} order - InstallmentOrder document (unsaved is fine; save is called inside)
 * @returns {Promise<void>}
 */
exports.creditSellerEarning = async (order) => {
  // Only applies to seller-owned orders with a positive commission
  if (!order.sellerId || order.sellerCommissionPercentage == null) return;
  if (order.sellerCommissionPercentage <= 0) return;

  // Idempotency guard — never credit the same order twice
  if (order.sellerFulfillmentStatus === "delivered") return;

  // Guard against missing/invalid totalProductPrice
  const grossValue = Number(order.totalProductPrice);
  if (!isFinite(grossValue) || grossValue <= 0) {
    console.error(
      `[sellerEarning] Invalid totalProductPrice (${order.totalProductPrice}) for order ${order.orderId} — skipping credit`,
    );
    return;
  }

  const sellerEarning = Math.round(
    grossValue * (1 - order.sellerCommissionPercentage / 100) * 100,
  ) / 100;

  if (sellerEarning <= 0) return;

  // Record the transaction
  await WalletTransaction.create({
    user:        order.sellerId,
    type:        "seller_earning",
    amount:      sellerEarning,
    description: `Earnings for order ${order.orderId}`,
    status:      "completed",
    meta: {
      orderId:         order._id,
      orderIdStr:      order.orderId,
      commissionRate:  order.sellerCommissionPercentage,
      grossOrderValue: grossValue,
    },
  });

  // Credit wallet balance and update seller stats atomically
  await User.findByIdAndUpdate(order.sellerId, {
    $inc: {
      "wallet.balance":               sellerEarning,
      "sellerProfile.totalSales":     1,
      "sellerProfile.totalRevenue":   sellerEarning,
    },
  });

  // Mark fulfillment as delivered (idempotency anchor for future calls)
  order.sellerFulfillmentStatus = "delivered";
  await order.save();
};
