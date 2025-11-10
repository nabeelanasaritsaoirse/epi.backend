const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const imageStoreSchema = new Schema({
  imagePath: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['banner', 'category', 'product', 'promotional', 'slider', 'icon', 'logo', 'background', 'advertisement']
  },
  platform: {
    type: String,
    required: true,
    enum: ['web', 'app', 'both'],
    default: 'both'
  },
  orderBy: {
    type: Number,
    required: true,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  width: {
    type: Number
  },
  height: {
    type: Number
  },
  fileSize: {
    type: Number
  },
  mimeType: {
    type: String
  },
  altText: {
    type: String
  },
  description: {
    type: String
  },
  linkUrl: {
    type: String
  },
  clickCount: {
    type: Number,
    default: 0
  },
  metadata: {
    type: Map,
    of: String
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
  deletedBy: {
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
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

imageStoreSchema.index({ type: 1, platform: 1, orderBy: 1, isActive: 1 });
imageStoreSchema.index({ isDeleted: 1, isActive: 1 });
imageStoreSchema.index({ createdAt: -1 });

imageStoreSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

imageStoreSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: Date.now() });
  next();
});

imageStoreSchema.statics.getImageTypes = function() {
  return ['banner', 'category', 'product', 'promotional', 'slider', 'icon', 'logo', 'background', 'advertisement'];
};

imageStoreSchema.statics.getPlatforms = function() {
  return ['web', 'app', 'both'];
};

module.exports = mongoose.model('ImageStore', imageStoreSchema);