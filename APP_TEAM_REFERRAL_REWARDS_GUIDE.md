# App & Frontend Team Guide: Advanced Referral Leaderboard & Rewards

This document explains the APIs, data structures, and logic required for the App (Frontend/Mobile) team to implement the Advanced Referral Leaderboard and Referral Rewards system.

## 1. Overview of the System
The App needs to display:
1. **User Dashboard / Stats:** How many people the user has referred and how much commission they have earned.
2. **Referral Leaderboard:** A public ranking of top referrers.
3. **Referred Users List (Screens 1, 2, 3):** Detailed lists showing who the user referred, what products those friends bought, and the daily commission progress.
4. **Rewards & Badges:** Milestones the user hits (cash added to wallet, badges added to their profile).

---

## 2. API Endpoints & Logic

### 2.1 Get Comprehensive Stats
**Endpoint:** `GET /api/referrals/stats`
**Headers:** `Authorization: Bearer <token>`
**Logic:** Use this to show the main summary at the top of the user's referral page.
**Response Data:**
Returns `totalReferrals`, `activeReferrals`, `totalEarnings`, `totalProducts`, `totalCommission`, and `availableBalance`.

### 2.2 Leaderboard API
**Endpoint:** `GET /api/referrals/leaderboard`
**Headers:** `Authorization: Bearer <token>`
**Logic:** Use this to render the public leaderboard. It returns an array of top users sorted by their referral count or earnings. 
**UI Action:** Display rank, user name, profile picture, and total earnings. If a user has a `title` (Badge), display it next to their name.

### 2.3 Referral Drill-Down Screens (Screens 1, 2, 3)
To show detailed progress on friends' purchases:

- **Screen 1 (List of Friends):** `GET /api/referrals/list/:referrerId`
  Shows everyone the user has referred, aggregating the total products and commissions for each friend.
- **Screen 2 (Friend Details):** `GET /api/referrals/friend/:referredUserId`
  Shows all the products a specific friend has purchased, including the `commissionPerDay`, `paidDays`, and `pendingDays`.
- **Screen 3 (Product Drill-down):** `GET /api/referrals/product/:referredUserId/:productId?orderId=...`
  Shows the daily SIP progress, earned commission vs total expected commission for a specific product.

### 2.4 User Rewards History
**Endpoint:** `GET /api/referrals/my-rewards`
**Headers:** `Authorization: Bearer <token>`
**Logic:** Shows the history of all Milestone Rewards, Chain Rewards, and Manual Rewards the user has received.
**UI Action:** Display a list of rewards (Cash amounts or Badges earned).

---

## 3. Handling Rewards in the App

1. **Cash Rewards:** 
   When a user hits a milestone, cash is *automatically* credited to their wallet on the backend. The next time you fetch `/api/referrals/wallet/:userId`, the `balance` will be higher. You do not need to call a "claim" API.
2. **Badges (Titles):**
   When a user hits a Badge milestone, the backend saves the badge name in the `title` field on the User model. 
   - Ensure that wherever you display a user's profile picture and name, you check if `user.title` exists and display it (e.g., "Gold Member", "Super Referrer").
3. **Chain Rewards:**
   If the user's friend hits a milestone, the user might get a "Chain Reward" cash bonus. This will appear in their Wallet transactions and My Rewards history.

## 4. UI/UX Recommendations
- **Dynamic Updates:** Use pull-to-refresh on the Leaderboard and Referral Stats screens so users can see real-time changes when their friends make daily payments.
- **Badges:** Create visual icons for badges like Bronze, Silver, and Gold, mapping them to the string returned in `user.title`.
- **Progress Bars:** In Screen 3 (Product Details), use `paidDays` vs `totalDays` to render a clean visual progress bar for the commission.
