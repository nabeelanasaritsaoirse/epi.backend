// controllers/couponController.js
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const InstallmentOrder = require('../models/InstallmentOrder');

/**
 * Create a new coupon (admin only)
 */
exports.createCoupon = async (req, res) => {
  try {
    const {
      couponCode,
      discountType,
      discountValue,
      minOrderValue,
      expiryDate,
      couponType = 'INSTANT',
      maxUsageCount,
      maxUsagePerUser,
      description,
      rewardCondition,
      rewardValue,
      // New fields
      firstTimeUserOnly = false,
      applicableProducts = [],
      applicableCategories = [],
      maxDiscountAmount = null,
      applicablePaymentMethods = [],
      minDaysSinceLastOrder = null,
      isWinBackCoupon = false,
      isStackable = false,
      stackPriority = 0
    } = req.body;

    // BASE VALIDATION
    if (!couponCode || !expiryDate) {
      return res.status(400).json({
        success: false,
        message: 'couponCode and expiryDate are required'
      });
    }

    // Validate couponType
    const allowedTypes = ['INSTANT', 'REDUCE_DAYS', 'MILESTONE_REWARD'];
    if (!allowedTypes.includes(couponType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid couponType'
      });
    }

    // Additional validation for NON-milestone coupons
    if (couponType !== 'MILESTONE_REWARD') {
      if (!discountType || discountValue === undefined) {
        return res.status(400).json({
          success: false,
          message:
            'discountType and discountValue are required for INSTANT or REDUCE_DAYS coupon'
        });
      }

      if (!['flat', 'percentage'].includes(discountType)) {
        return res.status(400).json({
          success: false,
          message: 'discountType must be flat or percentage'
        });
      }

      if (discountValue < 0) {
        return res.status(400).json({
          success: false,
          message: 'discountValue must be a positive number'
        });
      }
    }

    // MILESTONE coupon special validation
    if (couponType === 'MILESTONE_REWARD') {
      if (!rewardCondition || rewardCondition <= 0) {
        return res.status(400).json({
          success: false,
          message: 'rewardCondition must be > 0 for milestone coupon'
        });
      }
      if (!rewardValue || rewardValue <= 0) {
        return res.status(400).json({
          success: false,
          message: 'rewardValue must be > 0 for milestone coupon'
        });
      }
    }

    // Check duplicate
    const exists = await Coupon.findOne({ couponCode: couponCode.toUpperCase() });
    if (exists) {
      return res
        .status(409)
        .json({ success: false, message: 'Coupon already exists' });
    }

    // Create coupon
    const coupon = new Coupon({
      couponCode: couponCode.toUpperCase(),
      couponType,
      expiryDate: new Date(expiryDate),
      minOrderValue: minOrderValue ?? 0,
      isActive: true,

      // only for INSTANT / REDUCE_DAYS
      discountType: couponType !== 'MILESTONE_REWARD' ? discountType : null,
      discountValue: couponType !== 'MILESTONE_REWARD' ? discountValue : 0,

      // milestone fields
      rewardCondition: couponType === 'MILESTONE_REWARD' ? rewardCondition : null,
      rewardValue: couponType === 'MILESTONE_REWARD' ? rewardValue : null,
      milestonePaymentsRequired:
        couponType === 'MILESTONE_REWARD' ? rewardCondition : null,
      milestoneFreeDays:
        couponType === 'MILESTONE_REWARD' ? rewardValue : null,

      maxUsageCount: maxUsageCount ?? null,
      maxUsagePerUser: maxUsagePerUser ?? null,
      description: description || '',

      // New restriction fields
      firstTimeUserOnly,
      applicableProducts,
      applicableCategories,
      maxDiscountAmount,
      applicablePaymentMethods,

      // Win-back coupon fields
      minDaysSinceLastOrder,
      isWinBackCoupon,

      // Stackable coupon fields
      isStackable,
      stackPriority,

      // Track who created this coupon
      createdBy: req.user?._id || null
    });

    await coupon.save();

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      coupon
    });
  } catch (err) {
    console.error('Error creating coupon:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

/**
 * Get all coupons
 */
exports.getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, coupons });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

/**
 * Validate a coupon for an order amount
 */
exports.validateCoupon = async (req, res) => {
  try {
    const { couponCode, orderAmount } = req.body;

    if (!couponCode || orderAmount === undefined) {
      return res
        .status(400)
        .json({ success: false, message: 'couponCode and orderAmount required' });
    }

    const coupon = await Coupon.findActiveByCode(couponCode);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found or inactive' });
    }

    // Check validity
    const { valid, error } = coupon.isValid();
    if (!valid) {
      return res.status(400).json({ success: false, message: error });
    }

    // Order-value check
    if (orderAmount < coupon.minOrderValue) {
      return res.status(400).json({
        success: false,
        message: `Minimum order value is ₹${coupon.minOrderValue}`
      });
    }

    // HANDLE BASED ON TYPE
    let discountAmount = 0;
    let finalAmount = orderAmount;

    if (coupon.couponType !== 'MILESTONE_REWARD') {
      discountAmount = coupon.calculateDiscount(orderAmount);
      finalAmount = orderAmount - discountAmount;
    }

    res.status(200).json({
      success: true,
      message: 'Coupon is valid',
      coupon: {
        code: coupon.couponCode,
        couponType: coupon.couponType,
        discountAmount,
        finalAmount,
        originalAmount: orderAmount,

        // milestone fields
        rewardCondition: coupon.rewardCondition,
        rewardValue: coupon.rewardValue
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

/**
 * Delete coupon
 */
exports.deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    res.status(200).json({ success: true, message: 'Coupon deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

/**
 * Update coupon (admin only)
 */
exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      maxUsageCount,
      maxUsagePerUser,
      isActive,
      expiryDate,
      description,
      minOrderValue,
      discountValue,
      discountType,
      // New fields
      firstTimeUserOnly,
      applicableProducts,
      applicableCategories,
      maxDiscountAmount,
      applicablePaymentMethods,
      minDaysSinceLastOrder,
      isWinBackCoupon,
      isStackable,
      stackPriority
    } = req.body;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    // Update basic fields if provided
    if (maxUsageCount !== undefined) coupon.maxUsageCount = maxUsageCount;
    if (maxUsagePerUser !== undefined) coupon.maxUsagePerUser = maxUsagePerUser;
    if (isActive !== undefined) coupon.isActive = isActive;
    if (expiryDate) coupon.expiryDate = new Date(expiryDate);
    if (description !== undefined) coupon.description = description;
    if (minOrderValue !== undefined) coupon.minOrderValue = minOrderValue;
    if (discountValue !== undefined) coupon.discountValue = discountValue;
    if (discountType !== undefined) coupon.discountType = discountType;

    // Update restriction fields
    if (firstTimeUserOnly !== undefined) coupon.firstTimeUserOnly = firstTimeUserOnly;
    if (applicableProducts !== undefined) coupon.applicableProducts = applicableProducts;
    if (applicableCategories !== undefined) coupon.applicableCategories = applicableCategories;
    if (maxDiscountAmount !== undefined) coupon.maxDiscountAmount = maxDiscountAmount;
    if (applicablePaymentMethods !== undefined) coupon.applicablePaymentMethods = applicablePaymentMethods;

    // Update win-back fields
    if (minDaysSinceLastOrder !== undefined) coupon.minDaysSinceLastOrder = minDaysSinceLastOrder;
    if (isWinBackCoupon !== undefined) coupon.isWinBackCoupon = isWinBackCoupon;

    // Update stackable fields
    if (isStackable !== undefined) coupon.isStackable = isStackable;
    if (stackPriority !== undefined) coupon.stackPriority = stackPriority;

    await coupon.save();

    res.json({ success: true, message: 'Coupon updated successfully', coupon });
  } catch (err) {
    console.error('Error updating coupon:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

/**
 * Get coupon usage history (admin only)
 */
exports.getCouponUsage = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id)
      .populate('usageHistory.user', 'name email phoneNumber')
      .populate('usageHistory.orderId', 'orderId productName totalPaidAmount');

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    res.json({
      success: true,
      couponCode: coupon.couponCode,
      couponType: coupon.couponType,
      maxUsageCount: coupon.maxUsageCount,
      currentUsageCount: coupon.currentUsageCount,
      remainingUses: coupon.maxUsageCount
        ? Math.max(0, coupon.maxUsageCount - coupon.currentUsageCount)
        : 'Unlimited',
      maxUsagePerUser: coupon.maxUsagePerUser,
      totalDiscountGiven: coupon.usageHistory.reduce((sum, h) => sum + (h.discountApplied || 0), 0),
      usageHistory: coupon.usageHistory.map(h => ({
        user: h.user,
        orderId: h.orderId,
        usedAt: h.usedAt,
        discountApplied: h.discountApplied
      }))
    });
  } catch (err) {
    console.error('Error getting coupon usage:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

/**
 * Create referral coupon for a user (admin only)
 * Creates a unique coupon linked to a referrer
 */
exports.createReferralCoupon = async (req, res) => {
  try {
    const {
      userId,
      discountValue,
      discountType = 'flat',
      commissionPercent = 10,
      expiryDays = 365,
      maxUsageCount = null,
      description
    } = req.body;

    if (!userId || !discountValue) {
      return res.status(400).json({
        success: false,
        message: 'userId and discountValue are required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Generate unique code based on user name
    const baseName = user.name.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '');
    const randomPart = Math.random().toString(36).substr(2, 4).toUpperCase();
    const uniqueCode = `${baseName}${randomPart}`;

    // Check if code already exists
    const exists = await Coupon.findOne({ couponCode: uniqueCode });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Code collision, please try again' });
    }

    const coupon = new Coupon({
      couponCode: uniqueCode,
      couponType: 'INSTANT',
      discountType,
      discountValue,
      linkedToReferrer: userId,
      referrerCommissionPercent: commissionPercent,
      isReferralCoupon: true,
      isActive: true,
      expiryDate: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
      maxUsageCount,
      description: description || `Referral code for ${user.name}`,
      createdBy: req.user?._id || null
    });

    await coupon.save();

    res.status(201).json({
      success: true,
      message: `Referral code ${uniqueCode} created for ${user.name}`,
      coupon: {
        code: coupon.couponCode,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        commissionPercent: coupon.referrerCommissionPercent,
        expiryDate: coupon.expiryDate,
        linkedTo: {
          userId: user._id,
          name: user.name,
          email: user.email
        }
      }
    });
  } catch (err) {
    console.error('Error creating referral coupon:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

/**
 * Generate personal codes for specific users (admin only)
 * Creates unique child coupons from a parent coupon
 */
exports.generatePersonalCodes = async (req, res) => {
  try {
    const { parentCouponId, userIds } = req.body;

    if (!parentCouponId || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'parentCouponId and userIds array are required'
      });
    }

    const parentCoupon = await Coupon.findById(parentCouponId);
    if (!parentCoupon) {
      return res.status(404).json({ success: false, message: 'Parent coupon not found' });
    }

    // Mark as parent coupon
    if (!parentCoupon.isParentCoupon) {
      parentCoupon.isParentCoupon = true;
      await parentCoupon.save();
    }

    const generatedCodes = [];
    const errors = [];

    for (const userId of userIds) {
      try {
        const user = await User.findById(userId);
        if (!user) {
          errors.push({ userId, error: 'User not found' });
          continue;
        }

        // Check if user already has a code from this parent
        const existingCode = await Coupon.findOne({
          parentCoupon: parentCouponId,
          assignedToUser: userId
        });

        if (existingCode) {
          errors.push({ userId, error: 'User already has a code from this coupon' });
          continue;
        }

        // Generate unique code
        const randomPart = Math.random().toString(36).substr(2, 6).toUpperCase();
        const uniqueCode = `${parentCoupon.couponCode}-${randomPart}`;

        const personalCoupon = new Coupon({
          couponCode: uniqueCode,
          couponType: parentCoupon.couponType,
          discountType: parentCoupon.discountType,
          discountValue: parentCoupon.discountValue,
          maxDiscountAmount: parentCoupon.maxDiscountAmount,
          minOrderValue: parentCoupon.minOrderValue,
          parentCoupon: parentCouponId,
          assignedToUser: userId,
          isPersonalCode: true,
          maxUsageCount: 1,
          maxUsagePerUser: 1,
          isActive: true,
          expiryDate: parentCoupon.expiryDate,
          description: `Personal code for ${user.name} (Parent: ${parentCoupon.couponCode})`,
          createdBy: req.user?._id || null
        });

        await personalCoupon.save();
        generatedCodes.push({
          userId,
          userName: user.name,
          userEmail: user.email,
          code: uniqueCode
        });
      } catch (userErr) {
        errors.push({ userId, error: userErr.message });
      }
    }

    res.status(201).json({
      success: true,
      totalGenerated: generatedCodes.length,
      totalErrors: errors.length,
      parentCoupon: parentCoupon.couponCode,
      codes: generatedCodes,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error('Error generating personal codes:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

/**
 * Generate bulk unassigned codes (admin only)
 */
exports.generateBulkCodes = async (req, res) => {
  try {
    const { parentCouponId, count = 10 } = req.body;

    if (!parentCouponId) {
      return res.status(400).json({
        success: false,
        message: 'parentCouponId is required'
      });
    }

    if (count < 1 || count > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Count must be between 1 and 1000'
      });
    }

    const parentCoupon = await Coupon.findById(parentCouponId);
    if (!parentCoupon) {
      return res.status(404).json({ success: false, message: 'Parent coupon not found' });
    }

    // Mark as parent coupon
    if (!parentCoupon.isParentCoupon) {
      parentCoupon.isParentCoupon = true;
      await parentCoupon.save();
    }

    const generatedCodes = [];

    for (let i = 0; i < count; i++) {
      const randomPart = Math.random().toString(36).substr(2, 6).toUpperCase();
      const uniqueCode = `${parentCoupon.couponCode}-${randomPart}`;

      const coupon = new Coupon({
        couponCode: uniqueCode,
        couponType: parentCoupon.couponType,
        discountType: parentCoupon.discountType,
        discountValue: parentCoupon.discountValue,
        maxDiscountAmount: parentCoupon.maxDiscountAmount,
        minOrderValue: parentCoupon.minOrderValue,
        parentCoupon: parentCouponId,
        isPersonalCode: true,
        maxUsageCount: 1,
        isActive: true,
        expiryDate: parentCoupon.expiryDate,
        description: `Bulk code #${i + 1} (Parent: ${parentCoupon.couponCode})`,
        createdBy: req.user?._id || null
      });

      await coupon.save();
      generatedCodes.push(uniqueCode);
    }

    res.status(201).json({
      success: true,
      parentCoupon: parentCoupon.couponCode,
      totalGenerated: generatedCodes.length,
      codes: generatedCodes
    });
  } catch (err) {
    console.error('Error generating bulk codes:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

/**
 * Get user's assigned personal coupons
 */
exports.getUserCoupons = async (req, res) => {
  try {
    const userId = req.user._id;

    const coupons = await Coupon.find({
      assignedToUser: userId,
      isActive: true,
      expiryDate: { $gt: new Date() }
    }).select('couponCode couponType discountType discountValue maxDiscountAmount expiryDate description currentUsageCount maxUsageCount');

    // Also get referral coupons linked to this user
    const referralCoupons = await Coupon.find({
      linkedToReferrer: userId,
      isActive: true,
      expiryDate: { $gt: new Date() }
    }).select('couponCode couponType discountType discountValue referrerCommissionPercent expiryDate description currentUsageCount maxUsageCount');

    res.json({
      success: true,
      personalCoupons: coupons,
      referralCoupons: referralCoupons
    });
  } catch (err) {
    console.error('Error getting user coupons:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

/**
 * Get coupon by ID (admin only)
 */
exports.getCouponById = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id)
      .populate('linkedToReferrer', 'name email phoneNumber')
      .populate('parentCoupon', 'couponCode')
      .populate('assignedToUser', 'name email')
      .populate('applicableProducts', 'name productId pricing.finalPrice');

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    res.json({ success: true, coupon });
  } catch (err) {
    console.error('Error getting coupon:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

/**
 * Get child coupons of a parent coupon (admin only)
 */
exports.getChildCoupons = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const parentCoupon = await Coupon.findById(id);
    if (!parentCoupon) {
      return res.status(404).json({ success: false, message: 'Parent coupon not found' });
    }

    const childCoupons = await Coupon.find({ parentCoupon: id })
      .populate('assignedToUser', 'name email phoneNumber')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Coupon.countDocuments({ parentCoupon: id });

    res.json({
      success: true,
      parentCoupon: parentCoupon.couponCode,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      childCoupons: childCoupons.map(c => ({
        _id: c._id,
        couponCode: c.couponCode,
        assignedToUser: c.assignedToUser,
        currentUsageCount: c.currentUsageCount,
        isActive: c.isActive,
        expiryDate: c.expiryDate,
        createdAt: c.createdAt
      }))
    });
  } catch (err) {
    console.error('Error getting child coupons:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};
