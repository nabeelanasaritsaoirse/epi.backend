# Referral Rewards System — Full Audit Report

## Requirements Checklist

### 1. Milestone Rewards (for direct referrals)
> When a user successfully refers 10, 25, 50 people — they get a bonus reward credited to their wallet.

| Check | Status | Where |
|---|---|---|
| Admin can set milestone numbers (10, 25, 50) | ✅ | `ReferralRewardConfig.milestones[].referralsNeeded` |
| Admin can set reward amount per milestone | ✅ | `ReferralRewardConfig.milestones[].rewardAmount` |
| Cash rewards go to wallet automatically | ✅ | `referralRewardService.giveReward()` → `$inc wallet.balance` |
| Reward triggers automatically when referral count is hit | ✅ | `processReferral()` → calls `checkAndIssueRewards()` |
| Only counts ACTIVE/COMPLETED referrals (not pending) | ✅ | `Referral.countDocuments({ status: { $in: ['ACTIVE', 'COMPLETED'] } })` |
| No duplicate rewards for same milestone | ✅ | Unique compound index on `{user, rewardType, milestoneAchieved}` + `findOne` check |

### 2. Chain Rewards (for building a referral team)
> If User A refers User B, and User B hits a milestone — User A also gets a reward.

| Check | Status | Where |
|---|---|---|
| Chain reward logic exists | ✅ | `referralRewardService.js` lines 49-73 |
| Looks up referrer's parent via `user.referredBy` | ✅ | `User.findById(referrerId) → referrerUser.referredBy` |
| Supports FLAT amount | ✅ | `chainRewardType === 'FLAT'` → gives `chainRewardValue` directly |
| Supports PERCENTAGE of milestone reward | ✅ | `chainRewardType === 'PERCENTAGE'` → `(rewardAmount * chainRewardValue) / 100` |
| Chain rewards credit wallet | ✅ | Same `giveReward()` with `$inc wallet.balance` |
| Chain reward only fires when chainRewardEnabled=true | ✅ | `if (config.chainRewardEnabled)` check at line 50 |

### 3. Referral Leaderboard

| Check | Status | Where |
|---|---|---|
| App Leaderboard API exists | ✅ | `GET /api/referrals/leaderboard` |
| Only shows users with ACTIVE/COMPLETED referrals | ✅ | Aggregation `$match: { status: { $in: ['ACTIVE', 'COMPLETED'] } }` |
| Shows user name, profile picture, title/badge | ✅ | `$project` includes `user.name`, `user.profilePicture`, `user.title` |
| Shows current user's own rank | ✅ | Calculates `currentUserRank` via full aggregation + `findIndex` |
| Paginated | ✅ | `$skip` + `$limit` + pagination in response |
| Admin Leaderboard with only referrers | ✅ | `GET /api/admin/referrals/all-users?leaderboardOnly=true` |

### 4. Admin Panel Controls

| Check | Status | Where |
|---|---|---|
| Set milestone numbers | ✅ | `PUT /api/admin/referrals/reward-config` |
| Set reward amount for each milestone | ✅ | Each milestone has `rewardAmount` |
| Choose CASH, BADGE, or BOTH per milestone | ✅ | `rewardType: enum ['CASH', 'BADGE', 'BOTH']` |
| Turn chain reward ON/OFF | ✅ | `chainRewardEnabled: Boolean` |
| Set chain reward as FLAT or PERCENTAGE | ✅ | `chainRewardType: enum ['FLAT', 'PERCENTAGE']` |
| View full reward history | ✅ | `GET /api/admin/referrals/reward-history` |
| Manually give reward to any user | ✅ | `POST /api/admin/referrals/manual-reward` |

### 5. No Changes to Existing Referral System

| Check | Status | Detail |
|---|---|---|
| Old `processReferral` logic unchanged | ✅ | Reward check is purely additive at line 136-138 |
| Old referral routes unchanged | ✅ | All existing routes untouched |
| Feature not configured yet | ✅ | `if (!config) return;` — skips if admin hasn't set up |
| Old users unaffected | ✅ | Rewards only use `$inc`, never overwrite existing data |

## Bugs Found and Fixed

### Bug 1: verifyToken undefined — CRITICAL
- **File:** `routes/referralRoutes.js` lines 383, 388
- **Problem:** Used bare `verifyToken` but only `auth` was imported
- **Impact:** Leaderboard and My-Rewards APIs would crash with `ReferenceError`
- **Fix:** Changed to `auth.verifyToken`

### Bug 2: Badge name never saved — MEDIUM
- **File:** `models/ReferralRewardHistory.js` line 9
- **Problem:** Model field was `badgeGiven` but service saves `badgeName`
- **Impact:** Badge names in reward history would always be empty
- **Fix:** Changed model field to `badgeName`

## Error Handling Audit

| Scenario | Handled? | How |
|---|---|---|
| No ReferralRewardConfig exists | ✅ | `if (!config) return;` |
| Duplicate milestone reward | ✅ | Unique index + `findOne` check |
| User not found for chain reward | ✅ | `if (referrerUser && referrerUser.referredBy)` |
| Chain reward amount = 0 | ✅ | `if (chainAmount > 0)` check |
| Manual reward missing userId | ✅ | Returns 400 error |
| Admin APIs without auth | ✅ | `verifyToken + isAdmin` middleware |
| Invalid enum values | ✅ | Mongoose enum validation |
