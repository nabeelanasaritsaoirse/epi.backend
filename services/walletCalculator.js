// services/walletCalculator.js
const User = require("../models/User");
const Transaction = require("../models/Transaction");

/**
 * Recalculate wallet fields for a user according to rules:
 * - referral_commission: full 20% goes into transactions.
 *   - Half of each referral_commission is locked (hold) and requires investment to unlock.
 *   - The other half is initially withdrawable.
 * - investment transactions reduce the remaining requiredInvestment.
 * - Wallet balance calculation:
 *     walletBalance = completedDeposits + refunds + withdrawableReferral - withdrawals - investmentAmount
 * - holdBalance = pendingDeposits + remainingRequiredInvestment
 *
 * The function does not create new transactions. It only computes totals
 * from Transaction documents and writes the calculated summary back into the User doc.
 */
module.exports = async function recalcWallet(userId) {
  const user = await User.findById(userId);
  if (!user) return null;

  // Fetch all transactions for the user
  const txns = await Transaction.find({ user: userId });

  // Accumulators
  let completedDeposits = 0;
  let pendingDeposits = 0;

  let withdrawals = 0;
  let refundAmount = 0;

  let referralBonusTotal = 0; // sum of all referral_commission amounts (full 20%)
  let investmentAmount = 0;   // sum of investment transactions

  let commissionAmount = 0;   // other commission types (installment_commission, commission)
  let bonusAmount = 0;        // bonus type (promos etc.)

  // Walk through transactions
  for (const tx of txns) {
    const t = (tx.type || "").toString();

    switch (t) {
      case "bonus":
        // used for "add money" or promo bonuses
        if (tx.status === "completed") completedDeposits += Number(tx.amount || 0);
        else pendingDeposits += Number(tx.amount || 0);
        bonusAmount += Number(tx.amount || 0);
        break;

      case "deposit":
        if (tx.status === "completed") completedDeposits += Number(tx.amount || 0);
        else pendingDeposits += Number(tx.amount || 0);
        break;

      case "withdrawal":
        if (tx.status === "completed") withdrawals += Number(tx.amount || 0);
        else if (tx.status === "pending") {
          // if you want to show pending withdrawals separately later, handle here
          withdrawals += 0;
        }
        break;

      case "refund":
        // refunds add back to wallet (assume completed)
        if (tx.status === "completed") refundAmount += Number(tx.amount || 0);
        break;

      case "investment":
        // investments are amounts user moved to "invest" (to unlock referral hold)
        if (tx.status === "completed") investmentAmount += Number(tx.amount || 0);
        break;

      case "referral_commission":
        // This is the full 20% credit. We won't mutate transactions here;
        // walletCalculator will compute locked/unlocked portions from this sum.
        if (tx.status === "completed") {
          referralBonusTotal += Number(tx.amount || 0);
        } else {
          // If referral commissions can be pending, treat as hold until completed.
          // For now, include pending referral commissions in referralBonusTotal
          // but you may want to treat pending differently.
          referralBonusTotal += Number(tx.amount || 0);
        }
        break;

      case "installment_commission":
      case "commission":
        if (tx.status === "completed") commissionAmount += Number(tx.amount || 0);
        break;

      case "purchase":
      case "purchase_refund":
      case "order_payment":
      case "emi_payment":
        // Typically not affecting wallet directly unless you create purchase/refund txns.
        // If some of these types represent wallet deposits/refunds, handle them here.
        // For now we do not change accumulator for these types.
        break;

      default:
        // ignore unknown types but safe-cast amounts if present
        break;
    }
  }

  // Business rule: split referral commission 50/50 into hold and initially withdrawable part.
  // (For a total referralBonusTotal X: locked = X*0.5, unlockedInitial = X*0.5)
  const totalReferralLocked = referralBonusTotal * 0.5; // requires investment to unlock
  // remaining required investment is (totalReferralLocked - investedAmount) but never negative
  const remainingRequiredInvestment = Math.max(totalReferralLocked - investmentAmount, 0);

  // Withdrawable referral money = total referral minus remaining required investment
  // Example: referralBonusTotal = 20, totalReferralLocked = 10
  // if invested = 10 => remainingRequiredInvestment = 0 => withdrawable = 20 - 0 = 20 (fully unlocked)
  // if invested = 0 => remainingRequiredInvestment = 10 => withdrawable = 20 - 10 = 10 (only initial half)
  const withdrawableReferral = Math.max(referralBonusTotal - remainingRequiredInvestment, 0);

  // Wallet balance (money user can spend now)
  // deposits + refunds + withdrawable referral - withdrawals - investments
  const walletBalance =
    Number(completedDeposits || 0) +
    Number(refundAmount || 0) +
    Number(withdrawableReferral || 0) -
    Number(withdrawals || 0) -
    Number(investmentAmount || 0);

  // AvailableBalance => same as walletBalance (frontend expects this)
  const availableBalance = walletBalance;

  // Hold balance includes pending deposits + remaining required investment
  const holdBalance = Number(pendingDeposits || 0) + Number(remainingRequiredInvestment || 0);

  // Total balance = available + hold
  const totalBalance = availableBalance + holdBalance;

  // Total earnings — include referral & other commissions & bonuses
  const totalEarnings = Number(referralBonusTotal || 0) + Number(commissionAmount || 0) + Number(bonusAmount || 0);

  // Persist computed fields onto user document
  // Ensure wallet object exists
  if (!user.wallet) user.wallet = {};

  user.wallet.balance = Number(parseFloat(walletBalance).toFixed(2));
  user.wallet.holdBalance = Number(parseFloat(holdBalance).toFixed(2));
  user.wallet.referralBonus = Number(parseFloat(referralBonusTotal).toFixed(2));
  user.wallet.investedAmount = Number(parseFloat(investmentAmount).toFixed(2));
  user.wallet.requiredInvestment = Number(parseFloat(remainingRequiredInvestment).toFixed(2));

  // Preserve commission tracking fields (these are updated separately in installment system)
  if (user.wallet.commissionEarned === undefined) user.wallet.commissionEarned = 0;
  if (user.wallet.commissionUsedInApp === undefined) user.wallet.commissionUsedInApp = 0;

  user.availableBalance = Number(parseFloat(availableBalance).toFixed(2));
  user.totalBalance = Number(parseFloat(totalBalance).toFixed(2));
  user.totalEarnings = Number(parseFloat(totalEarnings).toFixed(2));

  await user.save();
  return user;
};
