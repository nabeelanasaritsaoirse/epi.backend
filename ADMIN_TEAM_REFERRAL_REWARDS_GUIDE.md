# Admin & QA Team Guide: Advanced Referral Leaderboard & Rewards

This document explains the Admin interfaces, configuration options, and QA testing scenarios for the Advanced Referral Leaderboard and Referral Rewards system.

## 1. Overview
Admins have full control over viewing the leaderboard, correcting referral mistakes, configuring automatic milestone rewards, and issuing manual bonuses to users.

---

## 2. Admin API Endpoints & Logic

All routes require Admin JWT authentication (`Authorization: Bearer <admin_token>`).

### 2.1 Leaderboard & User Management
- **All Users Leaderboard:** `GET /api/admin/referrals/all-users?page=1&limit=20&search=john`
  - *Logic:* Fetches a paginated list of all users and their exact referral stats (total referrals, active referrals, total earnings). The admin panel can use this as a master leaderboard.
- **Detailed User View:** `GET /api/admin/referrals/user/:userId`
  - *Logic:* Click into any user on the leaderboard to see exactly who they referred, the status of those referrals, purchase details, and their withdrawal history.
- **Reassign Referrer:** `PUT /api/admin/referrals/user/:userId/referrer`
  - *Body:* `{ "newReferrerId": "...", "reason": "User mistake" }`
  - *Logic:* If User B forgot to use User A's code, an admin can manually link them. **Safety Check:** The system blocks this change if User B has already started paying installments under a different referral.

### 2.2 Reward Configuration
- **Get Config:** `GET /api/admin/referrals/reward-config`
- **Update Config:** `PUT /api/admin/referrals/reward-config`
  - *Body example:* 
    ```json
    {
      "milestones": [
        { "referralsNeeded": 10, "rewardType": "BOTH", "rewardAmount": 50, "badgeName": "Bronze" }
      ],
      "chainRewardEnabled": true,
      "chainRewardType": "PERCENTAGE",
      "chainRewardValue": 10
    }
    ```
  - *Logic:* Defines what happens when a user hits a target. `rewardType` can be `CASH`, `BADGE`, or `BOTH`. Chain rewards give a bonus to the person who referred the achiever.

### 2.3 Issuing & Viewing Rewards
- **Manual Reward:** `POST /api/admin/referrals/manual-reward`
  - *Body:* `{ "userId": "...", "amount": 100, "title": "Special Contributor", "notes": "Promo" }`
  - *Logic:* Instantly adds cash to the user's wallet and updates their Badge title.
- **Reward History:** `GET /api/admin/referrals/reward-history`
  - *Logic:* A full audit log of every reward given by the system (milestones, chains, and manual admin inputs).

---

## 3. QA Testing Scenarios

### Test 1: Reassigning Referrer
1. Create User A and User B. User B signs up without a referral code.
2. Admin uses the `PUT /user/:userId/referrer` API to set User B's referrer to User A.
3. Validate that User B now appears in User A's referral list.
4. Have User B make a purchase. Try changing the referrer again. The API should **block** the change and return an error because active purchases exist.

### Test 2: Milestone Rewards (Cash & Badge)
1. Set a config: 2 referrals = ₹50 + "Silver" Badge.
2. User A refers User B and User C. Both make a purchase (Status changes to `ACTIVE`).
3. The system should automatically trigger the reward.
4. Check User A's wallet -> Balance should be up by ₹50.
5. Check User A's profile -> Title should now be "Silver".
6. Check `GET /api/admin/referrals/reward-history` -> A log should appear showing the automated reward.

### Test 3: Chain Rewards
1. Enable Chain Rewards in Admin Panel (Type: Percentage, Value: 10%).
2. User X refers User Y.
3. User Y hits a milestone that awards them ₹100.
4. User X should automatically receive ₹10 in their wallet as a "CHAIN" reward.

### Test 4: Manual Rewards
1. Admin issues a ₹500 manual reward to a test user via the Admin Panel.
2. User should immediately see ₹500 in their `availableBalance`.
