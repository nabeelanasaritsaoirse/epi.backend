const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
  referralsNeeded: { type: Number, required: true },
  rewardAmount: { type: Number, default: 0 },
  rewardType: { type: String, enum: ['CASH', 'BADGE', 'BOTH'], default: 'CASH' },
  badgeName: { type: String, default: '' }
}, { _id: false });

const referralRewardConfigSchema = new mongoose.Schema({
  milestones: [milestoneSchema],
  chainRewardEnabled: { type: Boolean, default: false },
  chainRewardType: { type: String, enum: ['FLAT', 'PERCENTAGE'], default: 'FLAT' },
  chainRewardValue: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('ReferralRewardConfig', referralRewardConfigSchema);
