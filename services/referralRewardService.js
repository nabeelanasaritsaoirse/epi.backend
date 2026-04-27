const mongoose = require('mongoose');
const User = require('../models/User');
const ReferralRewardConfig = require('../models/ReferralRewardConfig');
const ReferralRewardHistory = require('../models/ReferralRewardHistory');
const Referral = require('../models/Referral');

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
    const milestones = config.milestones.slice().sort((a, b) => b.referralsNeeded - a.referralsNeeded);

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
           await this.giveReward({
             userId: referrerId,
             triggerUserId,
             rewardType: 'MILESTONE',
             milestoneAchieved: ms.referralsNeeded,
             amount: ms.rewardAmount,
             rewardTypeConfig: ms.rewardType,
             badgeName: ms.badgeName,
             notes: `Reached ${ms.referralsNeeded} referrals milestone!`
           });
           
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

                if (chainAmount > 0) {
                  await this.giveReward({
                    userId: referrerUser.referredBy,
                    triggerUserId: referrerId,
                    rewardType: 'CHAIN',
                    milestoneAchieved: null,
                    amount: chainAmount,
                    rewardTypeConfig: 'CASH', // Chain rewards are always CASH here
                    badgeName: '',
                    notes: `Chain reward: ${referrerUser.name || 'User'} reached ${ms.referralsNeeded} referrals.`
                  });
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

exports.giveReward = async ({ userId, triggerUserId, rewardType, milestoneAchieved, amount, rewardTypeConfig, badgeName, notes, createdBy }) => {
  try {
     const isCash = (rewardTypeConfig === 'CASH' || rewardTypeConfig === 'BOTH' || rewardType === 'CHAIN');
     const isBadge = (rewardTypeConfig === 'BADGE' || rewardTypeConfig === 'BOTH');
     
     const finalAmount = isCash ? amount : 0;
     const finalBadge = isBadge ? badgeName : '';

     const history = new ReferralRewardHistory({
       user: userId,
       triggerUser: triggerUserId,
       rewardType,
       milestoneAchieved,
       amount: finalAmount,
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
         await User.findByIdAndUpdate(userId, {
            $set: { title: finalBadge },
            $push: { 
              badges: { 
                name: finalBadge, 
                achievedAt: new Date(),
                milestone: milestoneAchieved 
              } 
            }
         });
      }

     return history;
  } catch (err) {
     if (err.code !== 11000) { // ignore duplicate key errors for milestone
        console.error("Error giving reward:", err);
     }
     throw err;
  }
};
