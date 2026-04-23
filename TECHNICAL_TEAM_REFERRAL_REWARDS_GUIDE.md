# Technical Team Guide: Advanced Referral Leaderboard & Rewards Architecture

This document breaks down the database schemas, background processes, and core logic handling the Advanced Referral Leaderboard and Referral Rewards system.

## 1. Database Architecture

Three primary collections manage the reward logic, integrating with the existing `User` and `Referral` models.

### 1.1 `ReferralRewardConfig`
A single-document collection that stores global reward rules.
- **Fields:**
  - `milestones`: Array of objects `{ referralsNeeded, rewardType (CASH/BADGE/BOTH), rewardAmount, badgeName }`.
  - `chainRewardEnabled`: Boolean.
  - `chainRewardType`: Enum `['FLAT', 'PERCENTAGE']`.
  - `chainRewardValue`: Number.

### 1.2 `ReferralRewardHistory`
An append-only audit log of all issued rewards. Used for displaying history and ensuring idempotency (preventing duplicate milestone rewards).
- **Fields:**
  - `user`: ObjectId (Who got the reward).
  - `triggerUser`: ObjectId (Who caused it - e.g., in Chain Rewards).
  - `rewardType`: Enum `['MILESTONE', 'CHAIN', 'MANUAL']`.
  - `milestoneAchieved`: Number (e.g., 10).
  - `amount`: Number (Cash value).
  - `badgeName`: String.

### 1.3 `User` Model Updates
- **`title`:** A dynamic schema field (`strict: false`) appended to the User document when they receive a `BADGE` reward. Used by the frontend to display ranks.
- **`wallet.balance`, `availableBalance`, `totalEarnings`:** Updated automatically via MongoDB `$inc` operators when cash rewards are issued.

---

## 2. Core Service Logic: `referralRewardService.js`

This service is the brain of the automated reward system.

### 2.1 `checkAndIssueRewards(referrerId, triggerUserId)`
**When is it called?** 
Triggered during `processReferral` (when an installment plan or product purchase is made and the referral status turns `ACTIVE`).

**Execution Flow:**
1. Loads the `ReferralRewardConfig`.
2. Counts the number of `ACTIVE` or `COMPLETED` referrals belonging to the `referrerId`.
3. Loops through the `milestones` array (sorted descending by `referralsNeeded`).
4. **Idempotency Check:** Queries `ReferralRewardHistory` to see if a `MILESTONE` log already exists for this `user` + `milestoneAchieved`. If yes, it skips.
5. If no log exists, it calls `giveReward()` to issue the milestone.
6. **Chain Logic:** If `chainRewardEnabled` is true, it looks up the referrer's `referredBy` user. It calculates the chain amount (Flat or Percentage of the milestone) and calls `giveReward()` for the parent user as a `CHAIN` reward.

### 2.2 `giveReward(...)`
Handles the actual database mutations.
1. Creates the `ReferralRewardHistory` document.
2. If cash is involved (`amount > 0`), runs an atomic update:
   ```javascript
   await User.findByIdAndUpdate(userId, {
      $inc: { totalEarnings: amount, availableBalance: amount, "wallet.balance": amount }
   });
   ```
3. If a badge is involved, runs an atomic update:
   ```javascript
   await User.findByIdAndUpdate(userId, {
      $set: { title: badgeName }
   }, { strict: false });
   ```

---

## 3. Leaderboard & Stats Logic (`referralController.js`)

- **Daily Commissions:** `processDailyCommission()` runs iteratively over all active referrals. It checks `paidDays` vs `days` on the `purchases` array, credits a `DailyCommission` doc, and increments the user's wallet.
- **Data Aggregation:** The Leaderboard APIs (`getAllUsersWithReferrals`, `getReferralStats`) aggregate `totalReferrals`, `activeReferrals`, and calculate `totalEarnings` directly from the `DailyCommission` collection + rewards, ensuring accurate financial data.
- **Dual-Source Referral Data:** In `getReferralList` and `getReferredUserDetails`, the code intelligently merges legacy `Referral.purchases` with new `InstallmentOrder` models to accurately reflect total products purchased and commission generated, avoiding duplicates using a `Set` of product/order IDs.

---

## 4. Technical Edge Cases Handled

- **Race Conditions:** `giveReward` catches duplicate key errors (`err.code === 11000`) silently if multiple simultaneous requests try to insert the exact same milestone reward for a user.
- **Referral Changing (Admin):** In `adminReferralController.updateUserReferrer`, changing a user's referrer is blocked if `oldReferral.purchases.length > 0`. This maintains financial integrity so commissions don't break midway through an installment plan.
