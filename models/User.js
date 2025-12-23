

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { generateReferralCode } = require('../utils/referralUtils');

const userSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: props => `${props.value} is not a valid email address!`
    }
  },
  profilePicture: {
    type: String,
    default: ''
  },
  firebaseUid: {
    type: String,
    required: function() {
      // firebaseUid is required for regular users, optional for password-based admins
      return this.role === 'user';
    },
    unique: true,
    sparse: true, // Allow null values for admins
    index: true
  },
  phoneNumber: {
    type: String,
    default: '',
    sparse: true,
    validate: {
      validator: function(v) {
        return !v || /^\+?[1-9]\d{1,14}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number!`
    }
  },
  deviceToken: {
    type: String,
    default: ""
  },
  addresses: [{
    name: {
      type: String,
    },
    addressLine1: {
      type: String,
      required: true
    },
    addressLine2: {
      type: String
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    pincode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true,
      default: 'India'
    },
    phoneNumber: {
      type: String,
      required: true
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    addressType: {
      type: String,
      enum: ['home', 'work', 'other'],
      default: 'home'
    },
    landmark: {
      type: String
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  wallet: {
    balance: {
      type: Number,
      default: 0
    },
    holdBalance: {
      type: Number,
      default: 0
    },
    referralBonus: {
      type: Number,
      default: 0
    },
    investedAmount: {
      type: Number,
      default: 0
    },
    requiredInvestment: {
      type: Number,
      default: 0
    },
    transactions: [{
      type: {
        type: String,
        enum: ['referral_commission', 'withdrawal', 'refund', 'bonus'],
        required: true
      },
      amount: {
        type: Number,
        required: true
      },
      description: {
        type: String,
        default: ''
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  wishlist: [{
    type: Schema.Types.ObjectId,
    ref: 'Product'
  }],
  isAgree: {
    type: Boolean,
    default: false
  },
  kycDetails: {
    aadharCardNumber: {
      type: String,
      default: ''
    },
    panCardNumber: {
      type: String,
      default: ''
    },
    aadharVerified: {
      type: Boolean,
      default: false
    },
    panVerified: {
      type: Boolean,
      default: false
    }
  },
  kycDocuments: [{
    docType: {
      type: String
    },
    docUrl: {
      type: String
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedAt: {
      type: Date
    },
    rejectionReason: {
      type: String
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  bankDetails: [{
    accountNumber: {
      type: String
    },
    ifscCode: {
      type: String
    },
    accountHolderName: {
      type: String
    },
    bankName: {
      type: String
    },
    branchName: {
      type: String
    },
    upiId: {
      type: String
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },
  referredBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  referredUsers: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  referralLimit: {
    type: Number,
    default: 50
  },
  savedPlans: [{
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product'
    },
    targetAmount: {
      type: Number,
      required: false
    },
    savedAmount: {
      type: Number,
      default: 0
    },
    dailySavingAmount: {
      type: Number,
      required: false
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active'
    }
  }],
  role: {
    type: String,
    enum: ['user', 'admin', 'super_admin'],
    default: 'user'
  },

  // Admin-specific fields for password-based login (not Firebase)
  password: {
    type: String,
    default: null,
    // Only required for admin/super_admin users who login with password
    // Regular users use Firebase authentication
  },

  // Module access control for sub-admins
  moduleAccess: [{
    type: String,
    // Array of module IDs that admin can access
    // e.g., ['dashboard', 'products', 'orders', 'categories']
    // Super admin gets all modules automatically
  }],

  // Track who created this admin (for sub-admins)
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Last login timestamp
  lastLogin: {
    type: Date,
    default: null
  },

  isActive: {
    type: Boolean,
    default: true
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  availableBalance: {
    type: Number,
    default: 0
  },
  totalBalance: {
    type: Number,
    default: 0
  },
  authMethod: {
    type: String,
    enum: ['email', 'phone', 'google', 'unknown'],
    default: 'unknown'
  },

  // Chat system fields
  unreadMessageCount: {
    type: Number,
    default: 0,
    min: 0
  },

  chatSettings: {
    allowMessages: {
      type: Boolean,
      default: true
    },
    blockedUsers: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }]
  },

  // Firebase Cloud Messaging Token for push notifications
  fcmToken: {
    type: String,
    default: null
  },

  // Notification preferences
  notificationPreferences: {
    pushEnabled: {
      type: Boolean,
      default: true
    },
    orderUpdates: {
      type: Boolean,
      default: true
    },
    promotionalOffers: {
      type: Boolean,
      default: true
    },
    paymentAlerts: {
      type: Boolean,
      default: true
    },
    systemNotifications: {
      type: Boolean,
      default: true
    }
  },

  deletionRequest: {
    requestedAt: {
      type: Date
    },
    reason: {
      type: String
    },
    status: {
      type: String,
      enum: ['pending', 'cancelled', 'completed'],
      default: 'pending'
    }
  },

  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

userSchema.index({ email: 1 });
userSchema.index({ phoneNumber: 1 });
userSchema.index({ firebaseUid: 1 });
userSchema.index({ referralCode: 1 });
userSchema.index({ referredBy: 1 }); // For efficient referral stats queries

userSchema.pre('save', async function(next) {
  if (this.isNew && !this.referralCode) {
    try {
      this.referralCode = await generateReferralCode();
    } catch (error) {
      const crypto = require('crypto');
      this.referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    }
  }
  
  if (this.isNew && this.authMethod === 'unknown') {
    if (this.email.includes('@phone.user')) {
      this.authMethod = 'phone';
    } else if (this.email.includes('@temp.user')) {
      this.authMethod = 'unknown';
    } else {
      this.authMethod = 'email';
    }
  }
  
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', userSchema);