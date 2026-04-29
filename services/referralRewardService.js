const mongoose = require('mongoose');
const User = require('../models/User');
const ReferralRewardConfig = require('../models/ReferralRewardConfig');
const ReferralRewardHistory = require('../models/ReferralRewardHistory');
const Referral = require('../models/Referral');
const { triggerNotification } = require('./notificationSystemService');

/**
 * Issue a single reward (cash + badge) and persist history.
 * Separated out so both milestone and chain logic can call it cleanly.
 */
async function giveReward({ userId, triggerUserId, rewardType, milestoneAchieved, amount, percentage, sourceReward, rewardTypeConfig, badgeName, notes, createdBy }) {
  const isCash  = (rewardTypeConfig === 'CASH'  || rewardTypeConfig === 'BOTH');
  const isBadge = (rewardTypeConfig === 'BADGE' || rewardTypeConfig === 'BOTH');

  const finalAmount = isCash  ? (amount || 0) : 0;
  const finalBadge  = isBadge ? (badgeName || '') : '';

  // Persist reward history record
  const history = new ReferralRewardHistory({
    user: userId,
    triggerUser: triggerUserId,
    rewardType,
    milestoneAchieved,
    amount: finalAmount,
    percentage,
    sourceReward,
    badgeName: finalBadge,
    notes,
    createdBy
  });

  await history.save(); // throws 11000 on duplicate — caller handles it

  // Credit cash to wallet
  if (finalAmount > 0) {
    await User.findByIdAndUpdate(userId, {
      $inc: {
        totalEarnings:      finalAmount,
        availableBalance:   finalAmount,
        'wallet.balance':   finalAmount
      }
    });
  }

  // Grant badge
  if (finalBadge) {
    const updateObj = {
      $push: {
        badges: {
          name:       finalBadge,
          achievedAt: new Date(),
          milestone:  milestoneAchieved,
          rewardType
        }
      }
    };
    // Only promote main title for MILESTONE rewards
    if (rewardType === 'MILESTONE') {
      updateObj.$set = { title: finalBadge };
    }
    await User.findByIdAndUpdate(userId, updateObj);
  }

  return history;
}

/**
 * Check and issue milestone + chain rewards for a referrer.
 *
 * Safe to call multiple times — each milestone is idempotent:
 *   - Pre-check: skip if ReferralRewardHistory already has this milestone for this user
 *   - DB index: unique constraint prevents double-save even under race conditions
 *
 * @param {string|ObjectId} referrerId     - The referrer whose milestone count to evaluate
 * @param {string|ObjectId} triggerUserId  - The referred user who triggered this check
 */
async function checkAndIssueRewards(referrerId, triggerUserId) {
  try {
    const config = await ReferralRewardConfig.findOne({});
    if (!config || !config.milestones || config.milestones.length === 0) return;

    // Count how many referrals this person has that are ACTIVE or COMPLETED
    const referralsCount = await Referral.countDocuments({
      referrer: referrerId,
      status: { $in: ['ACTIVE', 'COMPLETED'] }
    });

    const milestones = config.milestones
      .slice()
      .sort((a, b) => a.referralsNeeded - b.referralsNeeded);

    for (const ms of milestones) {
      // Skip milestones the referrer hasn't reached yet
      if (referralsCount < ms.referralsNeeded) continue;

      // ── MILESTONE REWARD ──────────────────────────────────────────────
      try {
        const alreadyGot = await ReferralRewardHistory.findOne({
          user:             referrerId,
          rewardType:       'MILESTONE',
          milestoneAchieved: ms.referralsNeeded
        });

        if (!alreadyGot) {
          const result = await giveReward({
            userId:          referrerId,
            triggerUserId,
            rewardType:      'MILESTONE',
            milestoneAchieved: ms.referralsNeeded,
            amount:          ms.rewardAmount,
            rewardTypeConfig: ms.rewardType,
            badgeName:       ms.badgeName,
            notes:           `Reached ${ms.referralsNeeded} referrals milestone!`
          });

          if (result) {
            try {
              await triggerNotification({
                type:  'REFERRAL_REWARD',
                userId: referrerId,
                title: 'Congratulations! 🎉',
                body:  ms.badgeName
                  ? `You've achieved the ${ms.badgeName} badge and earned ₹${ms.rewardAmount}!`
                  : `You've earned ₹${ms.rewardAmount} for reaching ${ms.referralsNeeded} referrals!`,
                sendPush:  true,
                sendInApp: true,
                metadata:  { milestone: ms.referralsNeeded, rewardId: result._id }
              });
            } catch (notifErr) {
              console.error('[RewardService] Milestone notification failed (non-fatal):', notifErr.message);
            }
          }

          // ── CHAIN REWARD ─────────────────────────────────────────────
          if (config.chainRewardEnabled) {
            try {
              const referrerUser = await User.findById(referrerId).select('name referredBy');

              if (referrerUser && referrerUser.referredBy) {
                let chainAmount = 0;
                if (config.chainRewardType === 'FLAT') {
                  chainAmount = config.chainRewardValue;
                } else if (config.chainRewardType === 'PERCENTAGE') {
                  chainAmount = (ms.rewardAmount * config.chainRewardValue) / 100;
                }

                if (chainAmount > 0 || ms.badgeName) {
                  const alreadyGotChain = await ReferralRewardHistory.findOne({
                    user:              referrerUser.referredBy,
                    triggerUser:       referrerId,
                    rewardType:        'CHAIN',
                    milestoneAchieved: ms.referralsNeeded
                  });

                  if (!alreadyGotChain) {
                    const chainResult = await giveReward({
                      userId:            referrerUser.referredBy,
                      triggerUserId:     referrerId,
                      rewardType:        'CHAIN',
                      milestoneAchieved: ms.referralsNeeded,
                      amount:            chainAmount,
                      percentage:        config.chainRewardType === 'PERCENTAGE' ? config.chainRewardValue : null,
                      sourceReward: {
                        type:   'MILESTONE',
                        amount: ms.rewardAmount
                      },
                      rewardTypeConfig: ms.rewardType,
                      badgeName:        ms.badgeName,
                      notes:            `Chain reward: Your referral ${referrerUser.name || 'User'} reached milestone ${ms.referralsNeeded}.`
                    });

                    if (chainResult) {
                      try {
                        await triggerNotification({
                          type:   'CHAIN_REWARD',
                          userId: referrerUser.referredBy,
                          title:  'Chain Reward Earned! 💰',
                          body:   `You earned ₹${chainAmount} because your referral ${referrerUser.name || 'User'} hit a milestone!`,
                          sendPush:  true,
                          sendInApp: true,
                          metadata:  { triggerUserId: referrerId, amount: chainAmount }
                        });
                      } catch (notifErr) {
                        console.error('[RewardService] Chain notification failed (non-fatal):', notifErr.message);
                      }
                    }
                  }
                }
              }
            } catch (chainErr) {
              // Chain reward failure must NOT block the referrer's own milestone reward
              console.error(`[RewardService] Chain reward failed for milestone ${ms.referralsNeeded} (non-fatal):`, chainErr.message);
            }
          }
        }
      } catch (msErr) {
        // One milestone failure must NOT block subsequent milestones
        if (msErr.code !== 11000) {
          console.error(`[RewardService] Milestone ${ms.referralsNeeded} reward failed (non-fatal):`, msErr.message);
        }
        // 11000 = duplicate key → already saved by a parallel call, safe to skip
      }
    }
  } catch (error) {
    console.error('[RewardService] checkAndIssueRewards failed:', error.message);
  }
}

module.exports = { checkAndIssueRewards, giveReward };
