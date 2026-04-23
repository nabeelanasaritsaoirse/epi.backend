# Advanced Referral Leaderboard & Rewards System

This document outlines the complete functionality of the Advanced Referral Leaderboard and Referral Rewards system for the Admin, App (Frontend), QA, and Technical teams.

## 1. Overview
The system tracks user referrals, calculates daily commissions, and automatically issues milestone and chain rewards when users reach specific referral targets. It also provides comprehensive data for ranking users (Leaderboard) and allows admins to configure reward tiers or issue manual rewards.

---

## 2. Admin Team Guide

### 2.1 Managing the Leaderboard & Referral Data
- **All Users Leaderboard (`/api/admin/referrals/all-users`):** Admins can view a paginated list of all users, showing their total referrals, active referrals, and total earnings. This data acts as the administrative leaderboard.
- **Detailed User View (`/api/admin/referrals/user/:userId`):** Clicking on a user reveals exactly who they referred, the status of those referrals, purchase details, and their withdrawal history.
- **Reassign Referrer (`/api/admin/referrals/user/:userId/referrer`):** Admins can manually change who referred a user (as long as the user hasn't made purchases under the old referral). This helps fix mistakes where a user forgot to use a referral code.

### 2.2 Managing Referral Rewards
- **Reward Configuration (`/api/admin/referrals/reward-config`):** Admins can set up specific **Milestones**. 
  - *Example:* "Reach 10 referrals -> Get ₹50 and a 'Bronze' badge."
  - Rewards can be Cash (`CASH`), a Title/Badge (`BADGE`), or `BOTH`.
- **Chain Rewards:** Admins can enable "Chain Rewards". If User A refers User B, and User B hits a milestone, User A also gets a bonus (either a `FLAT` amount or a `PERCENTAGE` of User B's reward).
- **Manual Rewards (`/api/admin/referrals/manual-reward`):** Admins can manually grant cash bonuses or badges to any user for promotional purposes.
- **Reward History (`/api/admin/referrals/reward-history`):** A complete audit trail of all automated milestone rewards, chain rewards, and manual admin rewards.

---

## 3. App (Frontend/Mobile) Team Guide

### 3.1 Displaying the Leaderboard & Stats
- **User's Referral Stats:** The API provides `totalReferrals`, `activeReferrals`, `totalEarnings`, and `availableBalance`. Use this to show the user their personal dashboard.
- **Leaderboard Data:** When building a public leaderboard, you can rank users based on `totalReferrals` or `totalEarnings`.
- **Referred Users List:** You will receive a list of people the user referred, including their product purchases, commission per day, and pending days.

### 3.2 Displaying Rewards
- **Badges/Titles:** When a user earns a badge, it is saved in the `title` field on their User profile. Ensure the UI displays this title (e.g., next to their name on the profile or leaderboard).
- **Wallet Updates:** Cash rewards are automatically added to the user's `wallet.balance` and `availableBalance`. No extra API call is needed to claim them.
- **Reward Notifications:** Depending on the setup, consider showing an in-app notification when a user hits a milestone.

---

## 4. QA Team (Testing Scenarios)

### 4.1 Referral Tracking & Leaderboard
- **[ ]** Verify that when User B signs up using User A's referral, User B appears in User A's referral list.
- **[ ]** Verify that `totalReferrals`, `activeReferrals`, and `totalEarnings` update correctly when User B makes an installment purchase.

### 4.2 Milestone Rewards (Automated)
- **[ ]** Set a milestone in Admin Panel (e.g., 2 referrals = ₹10).
- **[ ]** Have a test user successfully refer 2 people who make purchases (Status becomes `ACTIVE`).
- **[ ]** Check the test user's wallet to ensure ₹10 was added automatically.
- **[ ]** Check if the badge/title was assigned correctly (if configured).

### 4.3 Chain Rewards
- **[ ]** Enable Chain Rewards (e.g., 10% percentage).
- **[ ]** When User B hits a ₹10 milestone, verify that User A (who referred User B) automatically receives ₹1 in their wallet.

### 4.4 Admin Controls
- **[ ]** Test the "Reassign Referrer" function. Ensure it blocks the change if the referred user already has active purchases.
- **[ ]** Test issuing a Manual Reward from the admin panel and verify it reflects in the user's wallet immediately.

---

## 5. Technical Team (Architecture & Logic)

### 5.1 Database Models
- `ReferralRewardConfig`: Stores the active milestones array and chain reward settings (`chainRewardEnabled`, `chainRewardType`, `chainRewardValue`).
- `ReferralRewardHistory`: Acts as an audit log. Contains `user`, `triggerUser` (who caused the chain reward), `rewardType` (`MILESTONE`, `CHAIN`, `MANUAL`), and `amount`.
- `User`: The user schema now utilizes the `title` field (strict: false) to store the earned Badge name.

### 5.2 Core Service Logic (`referralRewardService.js`)
- **`checkAndIssueRewards(referrerId, triggerUserId)`:** 
  - Triggered automatically when a referral changes to `ACTIVE` (e.g., in `processReferral`).
  - Counts the number of active/completed referrals for the referrer.
  - Compares against `ReferralRewardConfig.milestones`.
  - If a milestone is met and not previously awarded (checked via `ReferralRewardHistory`), it triggers `giveReward`.
  - Also evaluates Chain Reward logic if enabled.
- **`giveReward(...)`:**
  - Creates the history log.
  - Increments `wallet.balance`, `availableBalance`, and `totalEarnings` via `$inc`.
  - Sets the User's `title` via `$set` if it's a BADGE reward.

### 5.3 Important Edge Cases Handled
- **Idempotency:** Milestone rewards are checked against `ReferralRewardHistory` so users don't get duplicate rewards if a referral status updates multiple times.
- **Duplicate Key Errors:** Handled silently in `giveReward` to prevent app crashes if a concurrent request tries to grant the same milestone.
- **Referral Changing:** Admins are blocked from changing a user's referrer if there are existing purchase records (`oldReferral.purchases.length > 0`).
