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
 * LEGACY SYSTEM (Transaction model — kept for backward compatibility):
 *   - referral_commission: old 50/50 lock/unlock model, preserved for old users.
 *   - investment: user spending to unlock legacy hold.
 *
 * This function does not create transactions. It computes totals from existing
 * Transaction and WalletTransaction records and writes the summary back to User.
 */
module.exports = async function recalcWallet(userId) {
  const user = await User.findById(userId);
  if (!user) return null;

  // Fetch all transactions for the user from BOTH models
  const txns = await Transaction.find({ user: userId });
  const walletTxns = await WalletTransaction.find({ user: userId });

  // ── Common accumulators ──────────────────────────────────────────────────
  let completedDeposits = 0;  // Razorpay deposits, bonus, refunds (completed)
  let pendingDeposits   = 0;  // Razorpay deposits not yet verified
  let withdrawals       = 0;  // Completed cash withdrawals + installment payments
  let refundAmount      = 0;  // Refunds credited back
  let bonusAmount       = 0;  // Admin/promo bonuses
  let commissionAmount  = 0;  // installment_commission / commission types

  // ── LEGACY system accumulators (Transaction model only) ──────────────────
  let legacyReferralTotal    = 0; // sum of referral_commission amounts
  let legacyInvestmentAmount = 0; // sum of legacy investment transactions

  // ── NEW system accumulators (WalletTransaction model only) ───────────────
  let referralBonus90   = 0;  // 90% available portion  (referral_bonus type)
  let commissionLocked10 = 0; // 10% locked portion     (investment type)

  // ── Walk Transaction records ─────────────────────────────────────────────
  for (const tx of txns) {
    const t      = (tx.type || "").toString();
    const txAmt  = Number(tx.amount || 0);

    switch (t) {
      case "bonus":
        if (tx.status === "completed") completedDeposits += txAmt;
        else pendingDeposits += txAmt;
        bonusAmount += txAmt;
        break;

      case "deposit":
        if (tx.status === "completed") completedDeposits += txAmt;
        else pendingDeposits += txAmt;
        break;

      case "withdrawal":
        if (tx.status === "completed") withdrawals += txAmt;
        break;

      case "refund":
        if (tx.status === "completed") refundAmount += txAmt;
        break;

      case "investment":
        // LEGACY: user spending to unlock legacy referral hold
        if (tx.status === "completed") legacyInvestmentAmount += txAmt;
        break;

      case "referral_commission":
        // LEGACY: old 20% commission (50/50 lock model — kept for old users)
        legacyReferralTotal += txAmt; // include all statuses (consistent with original)
        break;

      case "installment_commission":
      case "commission":
        if (tx.status === "completed") commissionAmount += txAmt;
        break;

      case "purchase":
      case "purchase_refund":
      case "order_payment":
      case "emi_payment":
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
        // Installment payment deduction from wallet
        if (wTx.status === "completed") withdrawals += wAmt;
        break;

      case "referral_bonus":
        // NEW system: 90% commission credit — tracked separately, NOT mixed into completedDeposits
        if (wTx.status === "completed") referralBonus90 += wAmt;
        break;

      case "investment":
        // NEW system: 10% locked commission — tracked separately, NOT mixed into legacyInvestmentAmount
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

  // ── LEGACY 50/50 unlock logic (only for legacy referral_commission) ───────
  const legacyLocked           = legacyReferralTotal * 0.5;
  const legacyRemainingRequired = Math.max(legacyLocked - legacyInvestmentAmount, 0);
  const legacyWithdrawable     = Math.max(legacyReferralTotal - legacyRemainingRequired, 0);

  // ── NEW 90/10 unlock logic ────────────────────────────────────────────────
  // commissionUsedInApp now tracks TOTAL wallet deductions (commission + Razorpay)
  const commissionEarned    = user.wallet.commissionEarned    || 0;
  const commissionUsedInApp = user.wallet.commissionUsedInApp || 0;

  // 10% unlock: if total in-app spending >= 10% of commission earned, unlock the locked 10%
  const hasMetRequirement  = commissionEarned > 0
    ? commissionUsedInApp >= commissionEarned * 0.1
    : true; // no commission earned → no restriction

  const unlockedCommission    = hasMetRequirement ? commissionLocked10 : 0;
  const stillLockedCommission = hasMetRequirement ? 0 : commissionLocked10;

  // ── Final balance calculation ─────────────────────────────────────────────
  const walletBalance =
    completedDeposits    +
    refundAmount         +
    referralBonus90      +   // 90% new commission (available)
    unlockedCommission   +   // 10% unlocked when rule met
    legacyWithdrawable   -   // legacy commission (unlocked portion)
    withdrawals          -
    legacyInvestmentAmount;  // legacy investment deduction (0 for new users)

  const availableBalance = walletBalance;

  const holdBalance =
    pendingDeposits       +
    stillLockedCommission +   // 10% locked until rule met
    legacyRemainingRequired;  // legacy remaining investment requirement (0 for new users)

  const totalBalance = availableBalance + holdBalance;

  // Total commission earned for display (all types combined)
  const totalReferralEarnings = legacyReferralTotal + referralBonus90 + commissionLocked10;
  const totalEarnings = totalReferralEarnings + commissionAmount + bonusAmount;

  // ── Persist to user document ──────────────────────────────────────────────
  if (!user.wallet) user.wallet = {};

  user.wallet.balance          = Number(parseFloat(walletBalance).toFixed(2));
  user.wallet.holdBalance      = Number(parseFloat(holdBalance).toFixed(2));
  user.wallet.referralBonus    = Number(parseFloat(totalReferralEarnings).toFixed(2));
  user.wallet.investedAmount   = Number(parseFloat(legacyInvestmentAmount).toFixed(2));
  user.wallet.requiredInvestment = Number(parseFloat(legacyRemainingRequired).toFixed(2));

  // Commission tracking fields — set to 0 if undefined (updated elsewhere in installment system)
  if (user.wallet.commissionEarned    === undefined) user.wallet.commissionEarned    = 0;
  if (user.wallet.commissionUsedInApp === undefined) user.wallet.commissionUsedInApp = 0;

  user.availableBalance = Number(parseFloat(availableBalance).toFixed(2));
  user.totalBalance     = Number(parseFloat(totalBalance).toFixed(2));
  user.totalEarnings    = Number(parseFloat(totalEarnings).toFixed(2));

  await user.save();
  return user;
};
