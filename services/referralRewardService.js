const mongoose = require('mongoose');
const User = require('../models/User');
const ReferralRewardConfig = require('../models/ReferralRewardConfig');
const ReferralRewardHistory = require('../models/ReferralRewardHistory');
const Referral = require('../models/Referral');
const { triggerNotification } = require('./notificationSystemService');

/**
 * Check and issue milestone and chain rewards for a referrer.
 * Called automatically when a referral becomes active.
 */
exports.checkAndIssueRewards = async (referrerId, triggerUserId) => {
  try {
    const config = await ReferralRewardConfig.findOne({});
    if (!config) return; // Feature not configured yet

    // We count successful referrals
    // In this app, successful usually means having an ACTIVE Referral doc (the referred user has purchased).
    const referralsCount = await Referral.countDocuments({ referrer: referrerId, status: { $in: ['ACTIVE', 'COMPLETED'] } });

    // Or we can just count documents by 'referrerId'. Since Referral is created when processing, 
    // any Referral doc indicates they at least started a purchase. Let's use the active+completed filter to be safe.
    // Wait config could specify if it relies on Referral count.
    
    // Process milestones
    const milestones = config.milestones.slice().sort((a, b) => a.referralsNeeded - b.referralsNeeded);

    for (const ms of milestones) {
      if (referralsCount >= ms.referralsNeeded) {
        // Check if user already got this milestone reward
        const alreadyGot = await ReferralRewardHistory.findOne({
          user: referrerId,
          rewardType: 'MILESTONE',
          milestoneAchieved: ms.referralsNeeded
        });

        if (!alreadyGot) {
           // Issue Milestone Reward
           const result = await this.giveReward({
             userId: referrerId,
             triggerUserId,
             rewardType: 'MILESTONE',
             milestoneAchieved: ms.referralsNeeded,
             amount: ms.rewardAmount,
             rewardTypeConfig: ms.rewardType,
             badgeName: ms.badgeName,
             notes: `Reached ${ms.referralsNeeded} referrals milestone!`
           });

           // Send Notification for Milestone Reward
           if (result) {
              await triggerNotification({
                type: 'REFERRAL_REWARD',
                userId: referrerId,
                title: 'Congratulations! 🎉',
                body: ms.badgeName 
                  ? `You've achieved the ${ms.badgeName} badge and earned ₹${ms.rewardAmount}!`
                  : `You've earned ₹${ms.rewardAmount} for reaching ${ms.referralsNeeded} referrals!`,
                sendPush: true,
                sendInApp: true,
                metadata: { milestone: ms.referralsNeeded, rewardId: result._id }
              });
           }
           
           // Chain Reward
           if (config.chainRewardEnabled) {
             const referrerUser = await User.findById(referrerId);
             if (referrerUser && referrerUser.referredBy) {
                let chainAmount = 0;
                if (config.chainRewardType === 'FLAT') {
                  chainAmount = config.chainRewardValue;
                } else if (config.chainRewardType === 'PERCENTAGE') {
                  chainAmount = (ms.rewardAmount * config.chainRewardValue) / 100;
                }

                if (chainAmount > 0 || ms.badgeName) {
                  // Double check User A hasn't already received a chain reward triggered by User B's same milestone
                  const alreadyGotChain = await ReferralRewardHistory.findOne({
                    user: referrerUser.referredBy,
                    triggerUser: referrerId,
                    rewardType: 'CHAIN',
                    milestoneAchieved: ms.referralsNeeded
                  });

                  if (!alreadyGotChain) {
                    const chainResult = await this.giveReward({
                      userId: referrerUser.referredBy,
                      triggerUserId: referrerId,
                      rewardType: 'CHAIN',
                      milestoneAchieved: ms.referralsNeeded,
                      amount: chainAmount,
                      percentage: config.chainRewardType === 'PERCENTAGE' ? config.chainRewardValue : null,
                      sourceReward: {
                        type: 'MILESTONE',
                        amount: ms.rewardAmount
                      },
                      rewardTypeConfig: ms.rewardType, // Mirror the original milestone reward type (CASH/BADGE/BOTH)
                      badgeName: ms.badgeName,
                      notes: `Chain reward: Your referral ${referrerUser.name || 'User'} reached milestone ${ms.referralsNeeded}.`
                    });

                    if (chainResult) {
                       await triggerNotification({
                         type: 'CHAIN_REWARD',
                         userId: referrerUser.referredBy,
                         title: 'Chain Reward Earned! 💰',
                         body: `You earned ₹${chainAmount} because your referral ${referrerUser.name || 'User'} hit a milestone!`,
                         sendPush: true,
                         sendInApp: true,
                         metadata: { triggerUserId: referrerId, amount: chainAmount }
                       });
                    }
                  }
                }
             }
           }
        }
      }
    }
  } catch (error) {
    console.error("Error issuing milestone rewards:", error);
  }
};

exports.giveReward = async ({ userId, triggerUserId, rewardType, milestoneAchieved, amount, percentage, sourceReward, rewardTypeConfig, badgeName, notes, createdBy }) => {
  try {
     const isCash = (rewardTypeConfig === 'CASH' || rewardTypeConfig === 'BOTH');
     const isBadge = (rewardTypeConfig === 'BADGE' || rewardTypeConfig === 'BOTH');
     
     const finalAmount = isCash ? amount : 0;
     const finalBadge = isBadge ? badgeName : '';

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
     
     await history.save();
     
     // actually give the cash
     if (finalAmount > 0) {
        await User.findByIdAndUpdate(userId, {
           $inc: { 
             totalEarnings: finalAmount, // Optionally increment earnings
             availableBalance: finalAmount,
             "wallet.balance": finalAmount
           }
        });
     }
     
      // actually give the badge
      if (finalBadge) {
          const updateObj = {
             $push: { 
               badges: { 
                 name: finalBadge, 
                 achievedAt: new Date(),
                 milestone: milestoneAchieved,
                 rewardType: rewardType // Store whether it's MILESTONE or CHAIN
               } 
             }
          };

          // Only update the main "title" if it's a direct milestone reward
          if (rewardType === 'MILESTONE') {
             updateObj.$set = { title: finalBadge };
          }

          await User.findByIdAndUpdate(userId, updateObj);
       }

     return history;
  } catch (err) {
     if (err.code !== 11000) { // ignore duplicate key errors for milestone
        console.error("Error giving reward:", err);
     }
     throw err;
  }
};
