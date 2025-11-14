const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const bannerSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  imageKey: {
    type: String,
    required: true
  },
  altText: {
    type: String,
    default: 'Banner image'
  },
  imageWidth: {
    type: Number
  },
  imageHeight: {
    type: Number
  },
  imageSize: {
    type: Number
  },
  linkUrl: {
    type: String,
    default: null
  },
  targetBlank: {
    type: Boolean,
    default: false
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  platform: {
    type: String,
    enum: ['web', 'app', 'both'],
    default: 'both'
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  clickCount: {
    type: Number,
    default: 0
  },
  impressions: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  deletedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for better query performance
bannerSchema.index({ isActive: 1, isDeleted: 1, displayOrder: 1 });
bannerSchema.index({ platform: 1, isActive: 1 });
bannerSchema.index({ createdAt: -1 });

// Pre-save middleware to update timestamp
bannerSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Pre-findOneAndUpdate middleware
bannerSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: Date.now() });
  next();
});

module.exports = mongoose.model('Banner', bannerSchema);
