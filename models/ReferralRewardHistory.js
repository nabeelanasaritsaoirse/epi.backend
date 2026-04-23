const mongoose = require('mongoose');

const referralRewardHistorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  triggerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rewardType: { type: String, enum: ['MILESTONE', 'CHAIN', 'MANUAL'], required: true },
  milestoneAchieved: { type: Number },
  amount: { type: Number, default: 0 },
  badgeName: { type: String, default: '' },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Avoid duplicate milestone rewards for the same milestone mapping
referralRewardHistorySchema.index(
  { user: 1, rewardType: 1, milestoneAchieved: 1 },
  { unique: true, partialFilterExpression: { rewardType: 'MILESTONE' } }
);

module.exports = mongoose.model('ReferralRewardHistory', referralRewardHistorySchema);
