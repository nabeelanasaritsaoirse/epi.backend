const User = require('../models/User');
const Referral = require('../models/Referral');
const DailyCommission = require('../models/DailyCommission');
const CommissionWithdrawal = require('../models/CommissionWithdrawal');
const Order = require('../models/Order'); // ✅ Added for new referral screens
const { generateReferralCode } = require('../utils/referralUtils');

// Generate and assign referral code to new user
exports.generateReferralCode = async (userId) => {
  try {
    if (!userId) throw new Error('User ID is required');
    const existingUser = await User.findById(userId);
    if (!existingUser) throw new Error('User not found');

    if (existingUser.referralCode && existingUser.referralCode.length > 0) {
      console.log(`User ${userId} already has referral code: ${existingUser.referralCode}`);
      return existingUser;
    }

    console.log(`Generating new referral code for user ${userId}`);
    const referralCode = await generateReferralCode();
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { referralCode },
      { new: true }
    );
    return updatedUser;
  } catch (error) {
    console.error('Error in generateReferralCode:', error);
    throw new Error('Error generating referral code: ' + error.message);
  }
};

// Process new referral
exports.processReferral = async (referrerId, referredUserId, installmentDetails) => {
  try {
    const referrer = await User.findById(referrerId);
    const referredUser = await User.findById(referredUserId);
    if (!referrer || !referredUser) throw new Error('User not found');

    const existingReferral = await Referral.findOne({
      referrer: referrerId,
      referredUser: referredUserId
    });
    if (existingReferral) throw new Error('This referral has already been processed');

    const { 
      dailyAmount = 100,
      days = 30,
      totalAmount = dailyAmount * days,
      commissionPercentage = 30
    } = installmentDetails || {};

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days);

    const referral = await Referral.create({
      referrer: referrerId,
      referredUser: referredUserId,
      status: 'ACTIVE',
      startDate,
      endDate,
      dailyAmount,
      days,
      totalAmount,
      commissionPercentage,
      installmentDetails
    });

    await User.findByIdAndUpdate(referredUserId, { referredBy: referrerId });
    return referral;
  } catch (error) {
    console.error('Error in processReferral:', error);
    throw new Error('Error processing referral: ' + error.message);
  }
};

// Process daily commission
exports.processDailyCommission = async () => {
  try {
    const activeReferrals = await Referral.find({
      status: 'ACTIVE',
      endDate: { $gt: new Date() }
    });

    for (const referral of activeReferrals) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const commissionAmount = (referral.dailyAmount * referral.commissionPercentage) / 100;

      const existingCommission = await DailyCommission.findOne({
        referral: referral._id,
        date: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }
      });

      if (existingCommission) continue;

      const commission = await DailyCommission.create({
        referral: referral._id,
        referrer: referral.referrer,
        amount: commissionAmount,
        date: new Date(),
        status: 'PENDING'
      });

      await User.findByIdAndUpdate(referral.referrer, {
        $inc: {
          totalEarnings: commissionAmount,
          availableBalance: commissionAmount,
          'wallet.balance': commissionAmount
        },
        $push: {
          'wallet.transactions': {
            type: 'referral_commission',
            amount: commissionAmount,
            description: `Daily commission for referral #${referral._id}`,
            createdAt: new Date()
          }
        }
      });

      await DailyCommission.findByIdAndUpdate(commission._id, { status: 'PAID' });

      const updatedReferral = await Referral.findByIdAndUpdate(
        referral._id,
        { $inc: { commissionEarned: commissionAmount, daysPaid: 1 } },
        { new: true }
      );

      if (updatedReferral.daysPaid >= updatedReferral.days) {
        await Referral.findByIdAndUpdate(referral._id, { status: 'COMPLETED' });
      }
    }
  } catch (error) {
    throw new Error('Error processing daily commission: ' + error.message);
  }
};

// Request commission withdrawal
exports.requestWithdrawal = async (userId, amount, paymentMethod, paymentDetails) => {
  try {
    const user = await User.findById(userId);
    if (!user || user.wallet?.balance < amount) {
      return {
        success: false,
        message: "Withdrawal request failed: Insufficient balance.",
        withdrawal: {}
      };
    }

    const withdrawal = await CommissionWithdrawal.create({
      user: userId,
      amount,
      paymentMethod,
      paymentDetails
    });

    await User.findByIdAndUpdate(userId, {
      $inc: { availableBalance: -amount, 'wallet.balance': -amount },
      $push: {
        'wallet.transactions': {
          type: 'withdrawal',
          amount: -amount,
          description: `Withdrawal request #${withdrawal._id}`,
          createdAt: new Date()
        }
      }
    });

    return {
      success: true,
      message: "Withdrawal request submitted successfully.",
      withdrawal: withdrawal
    };
  } catch (error) {
    return {
      success: false,
      message: "Withdrawal request failed: " + error.message,
      withdrawal: {}
    };
  }
};

// Get user's referral statistics
exports.getReferralStats = async (userId) => {
  try {
    const referrals = await Referral.find({ referrer: userId });
    const dailyCommissions = await DailyCommission.find({ referrer: userId });
    const withdrawals = await CommissionWithdrawal.find({ user: userId });

    const totalEarnings = dailyCommissions.reduce((sum, c) => sum + c.amount, 0);
    const totalWithdrawn = withdrawals
      .filter(w => ['COMPLETED', 'PENDING'].includes(w.status))
      .reduce((sum, w) => sum + w.amount, 0);

    return {
      totalReferrals: referrals.length,
      activeReferrals: referrals.filter(r => r.status === 'ACTIVE').length,
      totalEarnings,
      totalWithdrawn,
      availableBalance: totalEarnings - totalWithdrawn
    };
  } catch (error) {
    throw new Error('Error getting referral stats: ' + error.message);
  }
};

// Update withdrawal status
exports.updateWithdrawalStatus = async (withdrawalId, status, transactionId = null) => {
  try {
    if (!['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'].includes(status))
      throw new Error('Invalid status value');

    const updates = {
      status,
      processedAt: status === 'COMPLETED' ? new Date() : null
    };
    if (transactionId) updates.transactionId = transactionId;

    const withdrawal = await CommissionWithdrawal.findByIdAndUpdate(
      withdrawalId,
      { $set: updates },
      { new: true }
    );

    if (!withdrawal) throw new Error('Withdrawal not found');
    return withdrawal;
  } catch (error) {
    throw new Error('Error updating withdrawal status: ' + error.message);
  }
};

// Get missed payment days
exports.getMissedPaymentDays = async (referralId) => {
  try {
    const referral = await Referral.findById(referralId);
    if (!referral) throw new Error('Referral not found');

    const now = new Date();
    const startDate = new Date(referral.startDate);
    const totalDaysSinceStart = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
    const expectedPaymentDays = Math.min(totalDaysSinceStart, referral.days);
    const missedDays = expectedPaymentDays - referral.daysPaid;

    const originalEndDate = new Date(startDate);
    originalEndDate.setDate(originalEndDate.getDate() + referral.days);
    const currentEndDate = referral.endDate;

    return {
      referralId: referral._id,
      totalDaysSinceStart,
      expectedPaymentDays,
      actualPaidDays: referral.daysPaid,
      missedDays,
      originalEndDate,
      currentEndDate,
      daysExtended: (currentEndDate - originalEndDate) / (1000 * 60 * 60 * 24)
    };
  } catch (error) {
    throw new Error('Error getting missed payment days: ' + error.message);
  }
};

// Referral List
exports.getReferralList = async (referrerId) => {
  try {
    const referrals = await Referral.find({ referrer: referrerId })
      .populate('referredUser', 'name email profilePicture');

    const referralList = await Promise.all(
      referrals.map(async (ref) => {
        const orders = await Order.find({ user: ref.referredUser._id, orderStatus: 'confirmed' });
        const totalItems = orders.length;
        const totalCommission = ref.commissionEarned || 0;

        return {
          _id: ref._id,
          referredUser: {
            _id: ref.referredUser._id,
            name: ref.referredUser.name,
            email: ref.referredUser.email,
            profilePicture: ref.referredUser.profilePicture || null,
          },
          totalItems,
          commission: totalCommission,
          status: ref.status
        };
      })
    );

    return { success: true, referrals: referralList };
  } catch (error) {
    throw new Error('Error fetching referral list: ' + error.message);
  }
};

// Referred User Details
exports.getReferredUserDetails = async (referredUserId) => {
  try {
    const referredUser = await User.findById(referredUserId).select('name email profilePicture');
    if (!referredUser) throw new Error('Referred user not found');

    const orders = await Order.find({ user: referredUserId }).populate('product', 'name price');
    const referrals = await Referral.find({ referredUser: referredUserId });

    const totalProducts = orders.length;
    const totalCommission = referrals.reduce((sum, r) => sum + (r.commissionEarned || 0), 0);

    const products = orders.map((order) => ({
      productId: order._id,
      productName: order.product?.name || 'N/A',
      dateOfPurchase: order.paymentDetails?.startDate,
      amount: order.orderAmount,
      paymentOption: order.paymentOption,
      status: order.orderStatus,
      pendingStatus: order.paymentStatus === 'pending' ? 'Pending' : 'Completed'
    }));

    return {
      success: true,
      friendDetails: {
        _id: referredUser._id,
        name: referredUser.name,
        email: referredUser.email,
        profilePicture: referredUser.profilePicture,
        totalProducts,
        totalCommission,
        products
      }
    };
  } catch (error) {
    throw new Error('Error fetching referred user details: ' + error.message);
  }
};

// Referral Product Details
exports.getReferralProductDetails = async (referredUserId, productId) => {
  try {
    const order = await Order.findOne({ _id: productId, user: referredUserId }).populate('product', 'name');
    if (!order) throw new Error('Order not found');

    const referral = await Referral.findOne({ referredUser: referredUserId });
    const dailyAmount = order.paymentDetails?.dailyAmount || 0;
    const commissionPerDay = (dailyAmount * (referral?.commissionPercentage || 30)) / 100;

    const startDate = order.paymentDetails?.startDate;
    const endDate = order.paymentDetails?.endDate;
    const now = new Date();
    const totalDays = order.paymentDetails?.totalDuration || 30;
    const daysPassed = Math.min(Math.floor((now - startDate) / (1000 * 60 * 60 * 24)), totalDays);
    const daysPending = Math.max(totalDays - daysPassed, 0);
    const totalCommission = commissionPerDay * totalDays;
    const earnedCommission = commissionPerDay * daysPassed;

    return {
      success: true,
      productDetails: {
        productName: order.product?.name,
        productId: order._id,
        dateOfPurchase: startDate,
        totalPrice: order.orderAmount,
        dailySIP: dailyAmount,
        commissionPerDay,
        totalEarnings: earnedCommission,
        totalExpectedEarnings: totalCommission,
        pendingDays: daysPending,
        paymentOption: order.paymentOption,
        pendingStartDate: now,
        pendingEndDate: endDate
      }
    };
  } catch (error) {
    throw new Error('Error fetching referral product details: ' + error.message);
  }
};
