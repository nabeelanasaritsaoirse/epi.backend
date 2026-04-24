// services/walletCalculator.js
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const WalletTransaction = require("../models/WalletTransaction");

/**
 * Recalculate wallet fields for a user.
 *
 * NEW SYSTEM (WalletTransaction model — installment orders):
 *   - referral_bonus: 90% of commission → available balance
 *   - investment: 10% of commission → locked in holdBalance
 *   - Unlock rule: when commissionUsedInApp >= commissionEarned * 0.1,
 *     the locked 10% moves from holdBalance to available balance.
 *
 * TRANSACTION MODEL (used for Razorpay deposits, withdrawals, bonuses, refunds):
 *   - deposit: Razorpay wallet load (pending until verified)
 *   - withdrawal: User withdrawal requests (completed when admin approves)
 *   - bonus: Admin/promo credits
 *   - refund: Refunds credited back
 *
 * This function does not create transactions. It computes totals from existing
 * Transaction and WalletTransaction records and writes the summary back to User.
 */
module.exports = async function recalcWallet(userId) {
  const user = await User.findById(userId);
  if (!user) return null;

  const txns = await Transaction.find({ user: userId });
  const walletTxns = await WalletTransaction.find({ user: userId });

  // ── Transaction model accumulators ───────────────────────────────────────
  let completedDeposits = 0;  // Razorpay deposits + bonuses (completed)
  let pendingDeposits   = 0;  // Razorpay deposits not yet verified (in holdBalance)
  let withdrawals       = 0;  // Completed cash withdrawals
  let refundAmount      = 0;  // Refunds credited back
  let bonusAmount       = 0;  // Admin/promo bonuses

  // ── WalletTransaction model accumulators (new installment system) ─────────
  let referralBonus90   = 0;  // 90% available commission (referral_bonus type)
  let commissionLocked10 = 0; // 10% locked commission   (investment type)

  // ── Walk Transaction records ─────────────────────────────────────────────
  for (const tx of txns) {
    const t     = (tx.type || "").toString();
    const txAmt = Number(tx.amount || 0);

    switch (t) {
      case "bonus":
        if (tx.status === "completed") { completedDeposits += txAmt; bonusAmount += txAmt; }
        else pendingDeposits += txAmt;
        break;

      case "deposit":
        if (tx.status === "completed") completedDeposits += txAmt;
        else if (tx.status === "pending") pendingDeposits += txAmt;
        break;

      case "withdrawal":
        if (tx.status === "completed") withdrawals += txAmt;
        break;

      case "refund":
        if (tx.status === "completed") refundAmount += txAmt;
        break;

      default:
        break;
    }
  }

  // ── Walk WalletTransaction records ───────────────────────────────────────
  for (const wTx of walletTxns) {
    const wType = (wTx.type || "").toString();
    const wAmt  = Math.abs(Number(wTx.amount || 0));

    switch (wType) {
      case "withdrawal":
        if (wTx.status === "completed") withdrawals += wAmt;
        break;

      case "referral_bonus":
        if (wTx.status === "completed") referralBonus90 += wAmt;
        break;

      case "investment":
        if (wTx.status === "completed") commissionLocked10 += wAmt;
        break;

      case "deposit":
      case "bonus":
        if (wTx.status === "completed") {
          completedDeposits += wAmt;
          bonusAmount += wAmt;
        }
        break;

      default:
        break;
    }
  }

  // ── 10% unlock logic ──────────────────────────────────────────────────────
  const commissionEarned    = user.wallet.commissionEarned    || 0;
  const commissionUsedInApp = user.wallet.commissionUsedInApp || 0;

  const hasMetRequirement = commissionEarned > 0
    ? commissionUsedInApp >= commissionEarned * 0.1
    : true;

  const unlockedCommission    = hasMetRequirement ? commissionLocked10 : 0;
  const stillLockedCommission = hasMetRequirement ? 0 : commissionLocked10;

  // ── Final balance calculation ─────────────────────────────────────────────
  const walletBalance = completedDeposits + refundAmount + referralBonus90 + unlockedCommission - withdrawals;
  const availableBalance = walletBalance;
  const holdBalance      = pendingDeposits + stillLockedCommission;
  const totalBalance     = availableBalance + holdBalance;

  const totalReferralEarnings = referralBonus90 + commissionLocked10;
  const totalEarnings         = totalReferralEarnings + bonusAmount;

  // ── Persist to user document ──────────────────────────────────────────────
  if (!user.wallet) user.wallet = {};

  user.wallet.balance      = Number(parseFloat(walletBalance).toFixed(2));
  user.wallet.holdBalance  = Number(parseFloat(holdBalance).toFixed(2));
  user.wallet.referralBonus = Number(parseFloat(totalReferralEarnings).toFixed(2));

  if (user.wallet.commissionEarned    === undefined) user.wallet.commissionEarned    = 0;
  if (user.wallet.commissionUsedInApp === undefined) user.wallet.commissionUsedInApp = 0;

  user.availableBalance = Number(parseFloat(availableBalance).toFixed(2));
  user.totalBalance     = Number(parseFloat(totalBalance).toFixed(2));
  user.totalEarnings    = Number(parseFloat(totalEarnings).toFixed(2));

  await user.save();
  return user;
};
