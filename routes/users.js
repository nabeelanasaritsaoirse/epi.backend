const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middlewares/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const { uploadSingleMiddleware } = require('../middlewares/uploadMiddleware');
const { uploadSingleFileToS3, deleteImageFromS3 } = require('../services/awsUploadService');


// CREATE NEW USER (ADMIN ONLY)
router.post('/admin/create', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, email, password, phoneNumber, role, referralLimit } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    // ⭐ PHONE NUMBER VALIDATION
    if (phoneNumber && !/^[0-9]{10}$/.test(phoneNumber)) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits' });
    }

    // Check if email exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // auto UID
    const randomFirebaseUid = 'admin-created-' + Math.random().toString(36).substring(2);

    const newUser = new User({
      name,
      email,
      firebaseUid: randomFirebaseUid,
      phoneNumber: phoneNumber || '',
      role: role || 'user',
      referralLimit: referralLimit || 50
    });

    await newUser.save();

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: newUser
    });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// UPDATE USER (ADMIN ONLY)
router.put('/admin/:userId', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, email, phoneNumber, role, isActive, referralLimit } = req.body;

    // ⭐ PHONE NUMBER VALIDATION
    if (phoneNumber !== undefined && !/^[0-9]{10}$/.test(phoneNumber)) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits' });
    }

    const updates = {};

    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;
    if (referralLimit !== undefined) updates.referralLimit = referralLimit;

    updates.updatedAt = Date.now();

    const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: updates },
      { new: true }
    ).select('-__v');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// DELETE USER (ADMIN ONLY)
router.delete('/admin/:userId', verifyToken, isAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


/**
 * @route   GET /api/users/me/profile
 * @desc    Get authenticated user's complete profile
 * @access  Private (Token Required)
 */
router.get('/me/profile', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId)
      .select('-__v')
      .populate('wallet.transactions')
      .populate('savedPlans.product')
      .populate('referredBy', 'name email')
      .populate('referredUsers', 'name email')
      .populate({
        path: 'wishlist',
        select: 'name price originalPrice brand images category rating'
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      user: user
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get all users (admin only)
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const users = await User.find()
      .select('-__v')
      .sort({ createdAt: -1 });

    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/users/profile/:userId
 * @desc    Get specific user's profile by ID
 * @access  Public
 */
router.get('/profile/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('-__v')
      .populate('wallet.transactions')
      .populate('savedPlans.product')
      .populate('referredBy', 'name email')
      .populate('referredUsers', 'name email')
      .populate({
        path: 'wishlist',
        select: 'name price originalPrice brand images category rating'
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      user: user
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get user by ID (admin only)
router.get('/:userId', verifyToken, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('-__v')
      .populate('wallet.transactions')
      .populate('savedPlans.product')
      .populate('referredBy')
      .populate('referredUsers');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user KYC status (admin only)
router.put('/:userId/kyc/:documentId', async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    
    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }
    
    // Find the user
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Find the document in the array
    const documentIndex = user.kycDocuments.findIndex(
      doc => doc._id.toString() === req.params.documentId
    );
    
    if (documentIndex === -1) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Update the document status
    const updateQuery = {
      [`kycDocuments.${documentIndex}.status`]: status,
      [`kycDocuments.${documentIndex}.updatedAt`]: new Date()
    };
    
    // Update isVerified based on status
    if (status === 'verified') {
      updateQuery[`kycDocuments.${documentIndex}.isVerified`] = true;
      updateQuery[`kycDocuments.${documentIndex}.verifiedAt`] = new Date();
    } else {
      updateQuery[`kycDocuments.${documentIndex}.isVerified`] = false;
    }
    
    // Add rejection reason if status is rejected
    if (status === 'rejected' && rejectionReason) {
      updateQuery[`kycDocuments.${documentIndex}.rejectionReason`] = rejectionReason;
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: updateQuery },
      { new: true }
    ).select('-__v');
    
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error updating KYC status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user transactions (admin only)
router.get('/:userId/transactions', verifyToken, isAdmin, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.params.userId })
      .sort({ createdAt: -1 });
    
    res.status(200).json(transactions);
  } catch (error) {
    console.error('Error fetching user transactions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update withdrawal status (admin only)
router.put('/transactions/:transactionId', verifyToken, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status || !['pending', 'completed', 'failed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid transaction status' });
    }
    
    const transaction = await Transaction.findById(req.params.transactionId);
    
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    // Handle refunds if withdrawal is cancelled or failed
    if ((status === 'cancelled' || status === 'failed') && 
        transaction.type === 'withdrawal' && 
        transaction.status === 'pending') {
      // Refund the amount to user's wallet
      await User.findByIdAndUpdate(
        transaction.user,
        { $inc: { 'wallet.balance': transaction.amount } }
      );
    }
    
    transaction.status = status;
    await transaction.save();
    
    res.status(200).json(transaction);
  } catch (error) {
    console.error('Error updating transaction status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// User wishlist routes

/**
 * @route   GET /api/users/:userId/wishlist
 * @desc    Get user's wishlist
 * @access  Public
 */
router.get('/:userId/wishlist', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate({
        path: 'wishlist',
        select: 'name price originalPrice brand images category rating'
      });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.status(200).json({
      success: true,
      wishlist: user.wishlist
    });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route   POST /api/users/:userId/wishlist
 * @desc    Add product to wishlist
 * @access  Public
 */
router.post('/:userId/wishlist', async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.params.userId;
    
    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }
    
    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    // Check if product is already in wishlist
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    if (user.wishlist.includes(productId)) {
      return res.status(400).json({ success: false, message: 'Product already in wishlist' });
    }
    
    // Add product to wishlist
    user.wishlist.push(productId);
    await user.save();
    
    // Return the updated wishlist with populated product details
    const updatedUser = await User.findById(userId).populate({
      path: 'wishlist',
      select: 'name price originalPrice brand images category rating'
    });
    
    res.status(200).json({
      success: true,
      message: 'Product added to wishlist',
      wishlist: updatedUser.wishlist
    });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route   DELETE /api/users/:userId/wishlist/:productId
 * @desc    Remove product from wishlist
 * @access  Public
 */
router.delete('/:userId/wishlist/:productId', async (req, res) => {
  try {
    const productId = req.params.productId;
    const userId = req.params.userId;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Check if product is in wishlist
    if (!user.wishlist.includes(productId)) {
      return res.status(400).json({ success: false, message: 'Product not in wishlist' });
    }
    
    // Remove product from wishlist
    user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
    await user.save();
    
    // Return the updated wishlist with populated product details
    const updatedUser = await User.findById(userId).populate({
      path: 'wishlist',
      select: 'name price originalPrice brand images category rating'
    });
    
    res.status(200).json({
      success: true,
      message: 'Product removed from wishlist',
      wishlist: updatedUser.wishlist
    });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route   GET /api/users/:userId/wishlist/check/:productId
 * @desc    Check if product is in wishlist
 * @access  Public
 */
router.get('/:userId/wishlist/check/:productId', async (req, res) => {
  try {
    const productId = req.params.productId;
    const userId = req.params.userId;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const isInWishlist = user.wishlist.includes(productId);
    
    res.status(200).json({
      success: true,
      isInWishlist
    });
  } catch (error) {
    console.error('Error checking wishlist:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route   GET /api/users/:userId/wishlist/count
 * @desc    Get count of items in wishlist
 * @access  Public
 */
router.get('/:userId/wishlist/count', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const wishlistCount = user.wishlist.length;
    
    res.status(200).json({
      success: true,
      count: wishlistCount
    });
  } catch (error) {
    console.error('Error getting wishlist count:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get user bank details
router.get('/:userId/bank-details', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('bankDetails');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      bankDetails: user.bankDetails
    });
  } catch (error) {
    console.error('Error fetching bank details:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route   POST /api/users/:userId/bank-details
 * @desc    Add a new bank account
 * @access  Private
 */
router.post('/:userId/bank-details', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      accountNumber,
      ifscCode,
      accountHolderName,
      bankName,
      branchName,
      upiId,
      isDefault
    } = req.body;

    // Verify user permissions (either the same user or admin)
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Validate required fields - at least account details OR UPI is required
    const hasAccountDetails = accountNumber && ifscCode && accountHolderName && bankName;
    const hasUpiDetails = upiId;

    if (!hasAccountDetails && !hasUpiDetails) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either bank account details (accountNumber, ifscCode, accountHolderName, bankName) or UPI ID'
      });
    }

    // Validate IFSC code format (if provided)
    if (ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid IFSC code format. It should be 11 characters (e.g., SBIN0001234)'
      });
    }

    // Validate account number (if provided) - must be numeric and 9-18 digits
    if (accountNumber && !/^\d{9,18}$/.test(accountNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account number. It should be 9-18 digits'
      });
    }

    // Validate UPI ID format (if provided)
    if (upiId && !/^[\w.-]+@[\w.-]+$/.test(upiId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid UPI ID format (e.g., username@upi)'
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check for duplicate account number
    if (accountNumber) {
      const duplicateAccount = user.bankDetails.find(
        bank => bank.accountNumber === accountNumber
      );
      if (duplicateAccount) {
        return res.status(409).json({
          success: false,
          message: 'Bank account with this account number already exists'
        });
      }
    }

    // Check for duplicate UPI ID
    if (upiId) {
      const duplicateUpi = user.bankDetails.find(
        bank => bank.upiId === upiId
      );
      if (duplicateUpi) {
        return res.status(409).json({
          success: false,
          message: 'Bank account with this UPI ID already exists'
        });
      }
    }

    // Create new bank details object
    const newBankDetails = {
      accountNumber: accountNumber || '',
      ifscCode: ifscCode ? ifscCode.toUpperCase() : '',
      accountHolderName: accountHolderName || '',
      bankName: bankName || '',
      branchName: branchName || '',
      upiId: upiId || '',
      isDefault: isDefault || false,
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // If this is the first bank account or isDefault is true, update all other accounts
    if (isDefault || user.bankDetails.length === 0) {
      if (user.bankDetails.length > 0) {
        await User.updateOne(
          { _id: userId },
          { $set: { "bankDetails.$[].isDefault": false } }
        );
      }
      newBankDetails.isDefault = true;
    }

    // Add bank details to user
    user.bankDetails.push(newBankDetails);
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Bank account added successfully',
      bankDetails: user.bankDetails
    });
  } catch (error) {
    console.error('Error adding bank details:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route   PUT /api/users/:userId/bank-details/:bankId
 * @desc    Update a bank account
 * @access  Private
 */
router.put('/:userId/bank-details/:bankId', verifyToken, async (req, res) => {
  try {
    const { userId, bankId } = req.params;
    const {
      accountNumber,
      ifscCode,
      accountHolderName,
      bankName,
      branchName,
      upiId,
      isDefault
    } = req.body;

    // Verify user permissions (either the same user or admin)
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Validate IFSC code format (if provided)
    if (ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid IFSC code format. It should be 11 characters (e.g., SBIN0001234)'
      });
    }

    // Validate account number (if provided) - must be numeric and 9-18 digits
    if (accountNumber && !/^\d{9,18}$/.test(accountNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account number. It should be 9-18 digits'
      });
    }

    // Validate UPI ID format (if provided)
    if (upiId && !/^[\w.-]+@[\w.-]+$/.test(upiId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid UPI ID format (e.g., username@upi)'
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Find bank account index
    const bankIndex = user.bankDetails.findIndex(bank => bank._id.toString() === bankId);
    if (bankIndex === -1) {
      return res.status(404).json({ success: false, message: 'Bank account not found' });
    }

    // Check for duplicate account number (excluding current account)
    if (accountNumber) {
      const duplicateAccount = user.bankDetails.find(
        (bank, index) => bank.accountNumber === accountNumber && index !== bankIndex
      );
      if (duplicateAccount) {
        return res.status(409).json({
          success: false,
          message: 'Another bank account with this account number already exists'
        });
      }
    }

    // Check for duplicate UPI ID (excluding current account)
    if (upiId) {
      const duplicateUpi = user.bankDetails.find(
        (bank, index) => bank.upiId === upiId && index !== bankIndex
      );
      if (duplicateUpi) {
        return res.status(409).json({
          success: false,
          message: 'Another bank account with this UPI ID already exists'
        });
      }
    }

    // Update bank details fields if provided
    if (accountNumber !== undefined) user.bankDetails[bankIndex].accountNumber = accountNumber;
    if (ifscCode !== undefined) user.bankDetails[bankIndex].ifscCode = ifscCode.toUpperCase();
    if (accountHolderName !== undefined) user.bankDetails[bankIndex].accountHolderName = accountHolderName;
    if (bankName !== undefined) user.bankDetails[bankIndex].bankName = bankName;
    if (branchName !== undefined) user.bankDetails[bankIndex].branchName = branchName;
    if (upiId !== undefined) user.bankDetails[bankIndex].upiId = upiId;

    // If account number or IFSC changed, reset verification status
    if (accountNumber !== undefined || ifscCode !== undefined) {
      user.bankDetails[bankIndex].isVerified = false;
    }

    // Handle default setting
    if (isDefault) {
      // Set all bank accounts to non-default
      user.bankDetails.forEach((bank, index) => {
        user.bankDetails[index].isDefault = false;
      });
      // Set this account as default
      user.bankDetails[bankIndex].isDefault = true;
    }

    user.bankDetails[bankIndex].updatedAt = new Date();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Bank account updated successfully',
      bankDetails: user.bankDetails
    });
  } catch (error) {
    console.error('Error updating bank details:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete a bank detail
router.delete('/:userId/bank-details/:bankId', verifyToken, async (req, res) => {
  try {
    const { userId, bankId } = req.params;
    
    // Verify user permissions (either the same user or admin)
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Check if bank details exist
    const bankExists = user.bankDetails.some(bank => bank._id.toString() === bankId);
    if (!bankExists) {
      return res.status(404).json({ success: false, message: 'Bank details not found' });
    }
    
    // Remove bank details
    await User.findByIdAndUpdate(
      userId,
      { $pull: { bankDetails: { _id: bankId } } }
    );
    
    // Get updated user
    const updatedUser = await User.findById(userId).select('bankDetails');
    
    res.status(200).json({
      success: true,
      message: 'Bank details deleted successfully',
      bankDetails: updatedUser.bankDetails
    });
  } catch (error) {
    console.error('Error deleting bank details:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Set default bank details
router.put('/:userId/bank-details/:bankId/default', verifyToken, async (req, res) => {
  try {
    const { userId, bankId } = req.params;
    
    // Verify user permissions (either the same user or admin)
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Check if bank details exist
    const bankExists = user.bankDetails.some(bank => bank._id.toString() === bankId);
    if (!bankExists) {
      return res.status(404).json({ success: false, message: 'Bank details not found' });
    }
    
    // First set all bank details isDefault to false
    await User.updateOne(
      { _id: userId },
      { $set: { "bankDetails.$[].isDefault": false } }
    );
    
    // Set selected bank details as default
    await User.updateOne(
      { _id: userId, "bankDetails._id": bankId },
      { $set: { "bankDetails.$.isDefault": true } }
    );
    
    // Get updated user
    const updatedUser = await User.findById(userId).select('bankDetails');
    
    res.status(200).json({
      success: true,
      message: 'Default bank details updated successfully',
      bankDetails: updatedUser.bankDetails
    });
  } catch (error) {
    console.error('Error updating default bank details:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get user KYC documents
router.get('/:userId/kycDocuments', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('kycDocuments');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Check if any documents are verified
    const hasVerifiedDocs = user.kycDocuments.some(doc => doc.isVerified === true);
    
    res.status(200).json({
      success: true,
      kycDocuments: user.kycDocuments,
      hasVerifiedDocs: hasVerifiedDocs
    });
  } catch (error) {
    console.error('Error fetching KYC documents:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all users' KYC documents
router.get('/admin/kyc-documents/all', async (req, res) => {
  try {
    const {
      search = '',
      page = 1,
      limit = 10
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const perPage = parseInt(limit);

    const filter = {
      'kycDocuments.0': { $exists: true } // Only users with at least one kycDocument
    };

    // Add search filter (by name or email)
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Count total users matching the filter
    const total = await User.countDocuments(filter);

    // Pipeline to get users with their latest document timestamp
    const aggregationPipeline = [
      { $match: filter },
      { 
        $addFields: {
          // Find the most recent document's timestamp for each user
          latestDocumentTimestamp: {
            $max: "$kycDocuments.uploadedAt"
          }
        }
      },
      { $sort: { latestDocumentTimestamp: -1 } }, // Sort by latest document timestamp
      { $skip: skip },
      { $limit: perPage },
      {
        $project: {
          name: 1,
          email: 1,
          kycDocuments: 1
        }
      }
    ];

    // Fetch paginated users with sorting based on latest document
    const users = await User.aggregate(aggregationPipeline);

    // Format response
    const data = users.map(user => ({
      userId: user._id,
      name: user.name,
      email: user.email,
      kycDocuments: user.kycDocuments
    }));

    res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      limit: perPage,
      totalPages: Math.ceil(total / perPage),
      data
    });

  } catch (error) {
    console.error('Error fetching all KYC documents:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete a KYC document
router.delete('/:userId/kycDocuments/:documentId', verifyToken, async (req, res) => {
  try {
    const { userId, documentId } = req.params;
    
    // Verify user permissions (either the same user or admin)
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Check if document exists
    const docExists = user.kycDocuments.some(doc => doc._id.toString() === documentId);
    if (!docExists) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    
    // Remove document
    await User.findByIdAndUpdate(
      userId,
      { $pull: { kycDocuments: { _id: documentId } } }
    );
    
    // Get updated user and check if any documents are still verified
    const updatedUser = await User.findById(userId);
    const hasVerifiedDocs = updatedUser.kycDocuments.some(doc => doc.isVerified === true);
    
    res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
      kycDocuments: updatedUser.kycDocuments,
      hasVerifiedDocs: hasVerifiedDocs
    });
  } catch (error) {
    console.error('Error deleting KYC document:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route   GET /api/users/:userId/addresses
 * @desc    Get user addresses
 * @access  Private
 */
router.get('/:userId/addresses', async (req, res) => {
  try {
    const { userId } = req.params;
    
    
    const user = await User.findById(userId).select('addresses');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.status(200).json({
      success: true,
      addresses: user.addresses
    });
  } catch (error) {
    console.error('Error fetching addresses:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route   POST /api/users/:userId/addresses
 * @desc    Add a new address
 * @access  Private
 */
router.post('/:userId/addresses', async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      addressLine1, 
      addressLine2, 
      name,
      city, 
      state, 
      pincode, 
      country,
      phoneNumber,
      addressType,
      landmark,
      isDefault
    } = req.body;
    

    
    // Validate required fields
    if (!addressLine1 || !city || !state || !pincode || !phoneNumber || !name) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide all required fields: addressLine1, city, state, pincode, phoneNumber, name' 
      });
    }
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Create new address object
    const newAddress = {
      name,
      addressLine1,
      addressLine2: addressLine2 || '',
      city,
      state,
      pincode,
      country: country || 'India',
      phoneNumber,
      addressType: addressType || 'home',
      landmark: landmark || '',
      isDefault: isDefault || false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // If this is the first address or isDefault is true, update all other addresses
    if (isDefault || user.addresses.length === 0) {
      // If there are existing addresses, set all to not default
      if (user.addresses.length > 0) {
        await User.updateOne(
          { _id: userId },
          { $set: { "addresses.$[].isDefault": false } }
        );
      }
      // Ensure the new address is set as default
      newAddress.isDefault = true;
    }
    
    // Add address to user
    user.addresses.push(newAddress);
    await user.save();
    
    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      addresses: user.addresses
    });
  } catch (error) {
    console.error('Error adding address:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route   PUT /api/users/:userId/addresses/:addressId
 * @desc    Update an address
 * @access  Private
 */
router.put('/:userId/addresses/:addressId', async (req, res) => {
  try {
    const { userId, addressId } = req.params;
    const { 
      name,
      addressLine1, 
      addressLine2, 
      city, 
      state, 
      pincode, 
      country,
      phoneNumber,
      addressType,
      landmark,
      isDefault
    } = req.body;
    
    
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Find address index
    const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
    if (addressIndex === -1) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }
    
    // Update address fields if provided
    if (addressLine1) user.addresses[addressIndex].addressLine1 = addressLine1;
    if (addressLine2 !== undefined) user.addresses[addressIndex].addressLine2 = addressLine2;
    if (city) user.addresses[addressIndex].city = city;
    if (name) user.addresses[addressIndex].name = name;
    if (state) user.addresses[addressIndex].state = state;
    if (pincode) user.addresses[addressIndex].pincode = pincode;
    if (country) user.addresses[addressIndex].country = country;
    if (phoneNumber) user.addresses[addressIndex].phoneNumber = phoneNumber;
    if (addressType) user.addresses[addressIndex].addressType = addressType;
    if (landmark !== undefined) user.addresses[addressIndex].landmark = landmark;
    
    // Handle default address setting
    if (isDefault) {
      // Set all addresses to non-default
      user.addresses.forEach((addr, index) => {
        user.addresses[index].isDefault = false;
      });
      // Set this address as default
      user.addresses[addressIndex].isDefault = true;
    }
    
    user.addresses[addressIndex].updatedAt = new Date();
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      addresses: user.addresses
    });
  } catch (error) {
    console.error('Error updating address:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route   DELETE /api/users/:userId/addresses/:addressId
 * @desc    Delete an address
 * @access  Private
 */
router.delete('/:userId/addresses/:addressId', async (req, res) => {
  try {
    const { userId, addressId } = req.params;
    
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Find address
    const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
    if (addressIndex === -1) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }
    
    // Check if this was the default address
    const wasDefault = user.addresses[addressIndex].isDefault;
    
    // Remove address
    user.addresses.splice(addressIndex, 1);
    
    // If the deleted address was the default and there are other addresses,
    // set the first one as default
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Address deleted successfully',
      addresses: user.addresses
    });
  } catch (error) {
    console.error('Error deleting address:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route   PUT /api/users/:userId/addresses/:addressId/default
 * @desc    Set an address as default
 * @access  Private
 */
router.put('/:userId/addresses/:addressId/default', verifyToken, async (req, res) => {
  try {
    const { userId, addressId } = req.params;
    
    // Verify user permissions (either the same user or admin)
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Check if address exists
    const addressExists = user.addresses.some(addr => addr._id.toString() === addressId);
    if (!addressExists) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }
    
    // First set all addresses isDefault to false
    await User.updateOne(
      { _id: userId },
      { $set: { "addresses.$[].isDefault": false } }
    );
    
    // Set selected address as default
    await User.updateOne(
      { _id: userId, "addresses._id": addressId },
      { $set: { "addresses.$.isDefault": true } }
    );
    
    // Get updated user
    const updatedUser = await User.findById(userId).select('addresses');
    
    res.status(200).json({
      success: true,
      message: 'Default address updated successfully',
      addresses: updatedUser.addresses
    });
  } catch (error) {
    console.error('Error updating default address:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route POST /:userId/kyc-documents
 * @desc Add KYC document to user and schedule auto-verification after 2 hours
 * @access Private
 */
router.post('/:userId/kycDocuments', async (req, res) => {
  try {
    const { userId } = req.params;
    const { docType, docUrl } = req.body;
    
    // Validate required fields
    if (!docType || !docUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide all required fields: docType, docUrl' 
      });
    }
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Create new document object
    const newDocument = {
      docType,
      docUrl,
      status: 'pending',
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Add document to user
    user.kycDocuments.push(newDocument);
    await user.save();
    
    // Get the ID of the newly added document
    const docId = user.kycDocuments[user.kycDocuments.length - 1]._id;
    
    // Schedule auto-verification after 2 hours
    setTimeout(async () => {
      try {
        const userToUpdate = await User.findById(userId);
        if (!userToUpdate) {
          console.error('User not found during auto-verification');
          return;
        }
        
        // Find the document by ID
        const docIndex = userToUpdate.kycDocuments.findIndex(
          doc => doc._id.toString() === docId.toString()
        );
        
        if (docIndex !== -1) {
          // Update document status
          userToUpdate.kycDocuments[docIndex].status = 'verified';
          userToUpdate.kycDocuments[docIndex].isVerified = true;
          userToUpdate.kycDocuments[docIndex].verifiedAt = new Date();
          userToUpdate.kycDocuments[docIndex].updatedAt = new Date();
          
          // If this is Aadhar or PAN, also update the verification in kycDetails
          if (userToUpdate.kycDocuments[docIndex].docType.toLowerCase().includes('aadhar')) {
            userToUpdate.kycDetails.aadharVerified = true;
          } else if (userToUpdate.kycDocuments[docIndex].docType.toLowerCase().includes('pan')) {
            userToUpdate.kycDetails.panVerified = true;
          }
          
          await userToUpdate.save();
          console.log(`Document ${docId} auto-verified successfully for user ${userId}`);
        } else {
          console.error(`Document ${docId} not found for user ${userId} during auto-verification`);
        }
      } catch (error) {
        console.error('Error during auto-verification:', error);
      }
    }, 2 * 60 * 60 * 1000); // 2 hours in milliseconds
    
    res.status(201).json({
      success: true,
      message: 'KYC document added successfully. It will be automatically verified within 2 hours.',
      kycDocuments: user.kycDocuments
    });
  } catch (error) {
    console.error('Error adding KYC document:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route   PUT /api/users/:userId/kyc-details
 * @desc    Update KYC Details (Aadhar and PAN Card info)
 * @access  Private
 */
router.put('/:userId/kyc-details', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { aadharCardNumber, panCardNumber } = req.body;
    
    // Verify user permissions (either the same user or admin)
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    // Validate input format
    if (aadharCardNumber && !/^\d{12}$/.test(aadharCardNumber)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Aadhar Card Number must be 12 digits' 
      });
    }
    
    if (panCardNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panCardNumber)) {
      return res.status(400).json({ 
        success: false, 
        message: 'PAN Card Number must be in valid format (e.g., ABCDE1234F)' 
      });
    }
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Initialize kycDetails if it doesn't exist
    if (!user.kycDetails) {
      user.kycDetails = {
        aadharCardNumber: '',
        panCardNumber: '',
        aadharVerified: false,
        panVerified: false
      };
    }
    
    // Update fields if provided
    const updates = {};
    
    if (aadharCardNumber) {
      updates['kycDetails.aadharCardNumber'] = aadharCardNumber;
      // Reset verification status when number changes
      updates['kycDetails.aadharVerified'] = false;
    }
    
    if (panCardNumber) {
      updates['kycDetails.panCardNumber'] = panCardNumber;
      // Reset verification status when number changes
      updates['kycDetails.panVerified'] = false;
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one field to update'
      });
    }
    
    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true }
    );
    
    res.status(200).json({
      success: true,
      message: 'KYC details updated successfully',
      kycDetails: updatedUser.kycDetails
    });
  } catch (error) {
    console.error('Error updating KYC details:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route   GET /api/users/:userId/kyc-details
 * @desc    Get user KYC details
 * @access  Private
 */
router.get('/:userId/kyc-details', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verify user permissions (either the same user or admin)
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    const user = await User.findById(userId).select('kycDetails');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.status(200).json({
      success: true,
      kycDetails: user.kycDetails || {
        aadharCardNumber: '',
        panCardNumber: '',
        aadharVerified: false,
        panVerified: false
      }
    });
  } catch (error) {
    console.error('Error fetching KYC details:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route   PUT /api/users/:userId/kyc-details/verify
 * @desc    Verify KYC Details (Admin only)
 * @access  Private (Admin)
 */
router.put('/:userId/kyc-details/verify', verifyToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { aadharVerified, panVerified } = req.body;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if user has KYC details
    if (!user.kycDetails) {
      return res.status(400).json({
        success: false,
        message: 'User does not have KYC details to verify'
      });
    }

    // Update verification status
    const updates = {};

    if (aadharVerified !== undefined) {
      // Only allow verification if aadharCardNumber is present
      if (aadharVerified && !user.kycDetails.aadharCardNumber) {
        return res.status(400).json({
          success: false,
          message: 'Cannot verify Aadhar Card: Number not provided'
        });
      }
      updates['kycDetails.aadharVerified'] = Boolean(aadharVerified);
    }

    if (panVerified !== undefined) {
      // Only allow verification if panCardNumber is present
      if (panVerified && !user.kycDetails.panCardNumber) {
        return res.status(400).json({
          success: false,
          message: 'Cannot verify PAN Card: Number not provided'
        });
      }
      updates['kycDetails.panVerified'] = Boolean(panVerified);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one verification status to update'
      });
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'KYC verification status updated successfully',
      kycDetails: updatedUser.kycDetails
    });
  } catch (error) {
    console.error('Error updating KYC verification status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route   GET /api/users/:userId/kyc-withdrawal-status
 * @desc    Check KYC verification status for withdrawal eligibility
 * @access  Private
 */
router.get('/:userId/kyc-withdrawal-status', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user permissions (either the same user or admin)
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Find user
    const user = await User.findById(userId).select('kycDetails kycDocuments bankDetails');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check new KYC system (separate Kyc model)
    const Kyc = require('../models/Kyc');
    const newKyc = await Kyc.findOne({ userId });
    const isNewKycApproved = newKyc && ['approved', 'auto_approved'].includes(newKyc.status);

    // Check KYC verification status from old system
    const kycDetails = user.kycDetails || {};
    const kycDocuments = user.kycDocuments || [];

    // Check if Aadhar is verified (either in kycDetails or kycDocuments)
    const aadharVerified = kycDetails.aadharVerified ||
      kycDocuments.some(doc =>
        doc.docType && doc.docType.toLowerCase().includes('aadhar') && doc.isVerified
      );

    // Check if PAN is verified (either in kycDetails or kycDocuments)
    const panVerified = kycDetails.panVerified ||
      kycDocuments.some(doc =>
        doc.docType && doc.docType.toLowerCase().includes('pan') && doc.isVerified
      );

    // Check if any KYC document is verified
    const hasVerifiedDocument = kycDocuments.some(doc => doc.isVerified);

    // Check if user has at least one bank account
    const hasBankAccount = user.bankDetails && user.bankDetails.length > 0;

    // Check if user has a verified bank account
    const hasVerifiedBankAccount = user.bankDetails &&
      user.bankDetails.some(bank => bank.isVerified);

    // Determine overall withdrawal eligibility
    // Rule: User must have KYC approved (NEW system OR OLD system) AND at least one bank account
    const isKycApproved = isNewKycApproved || aadharVerified || panVerified;
    const isEligibleForWithdrawal = isKycApproved && hasBankAccount;

    // Build detailed status response
    const status = {
      isEligibleForWithdrawal,
      kycStatus: {
        // New KYC system status
        newKycStatus: newKyc ? newKyc.status : 'not_submitted',
        isNewKycApproved,
        // Old KYC system status
        aadharVerified,
        panVerified,
        hasVerifiedDocument,
        aadharNumber: (newKyc?.aadhaarNumber ? '****' + newKyc.aadhaarNumber.slice(-4) : null) ||
          (kycDetails.aadharCardNumber ? '****' + kycDetails.aadharCardNumber.slice(-4) : null),
        panNumber: (newKyc?.panNumber ? newKyc.panNumber.slice(0, 2) + '****' + newKyc.panNumber.slice(-2) : null) ||
          (kycDetails.panCardNumber ? kycDetails.panCardNumber.slice(0, 2) + '****' + kycDetails.panCardNumber.slice(-2) : null)
      },
      bankStatus: {
        hasBankAccount,
        hasVerifiedBankAccount,
        totalBankAccounts: user.bankDetails ? user.bankDetails.length : 0
      },
      pendingDocuments: kycDocuments.filter(doc => doc.status === 'pending').length,
      rejectedDocuments: kycDocuments.filter(doc => doc.status === 'rejected').length
    };

    // Build requirements message
    const requirements = [];
    if (!isKycApproved) {
      requirements.push('Verify your Aadhar Card or PAN Card');
    }
    if (!hasBankAccount) {
      requirements.push('Add at least one bank account');
    }

    res.status(200).json({
      success: true,
      isEligibleForWithdrawal,
      status,
      requirements: requirements.length > 0 ? requirements : null,
      message: isEligibleForWithdrawal
        ? 'You are eligible for withdrawal'
        : 'Complete KYC verification to enable withdrawals'
    });
  } catch (error) {
    console.error('Error checking KYC withdrawal status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route   PUT /api/users/:userId/profile-picture
 * @desc    Update user profile picture with S3 upload
 * @access  Private
 */
router.put('/:userId/profile-picture', verifyToken, uploadSingleMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user permissions (either the same user or admin)
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Accept both 'file' and 'image' fields (multer.fields populates req.files)
    let selectedFile = null;
    if (req.files && req.files.file && req.files.file.length > 0) {
      selectedFile = req.files.file[0];
    } else if (req.files && req.files.image && req.files.image.length > 0) {
      selectedFile = req.files.image[0];
    }

    // No file uploaded
    if (!selectedFile) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image file'
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Delete old profile picture from S3 if it exists
    if (user.profilePicture && user.profilePicture.includes('s3.amazonaws.com')) {
      try {
        await deleteImageFromS3(user.profilePicture);
      } catch (deleteError) {
        console.error('Error deleting old profile picture:', deleteError);
        // Continue with upload even if delete fails
      }
    }

    // Upload new profile picture to S3 — pass selectedFile (same shape as previous req.file)
    const uploadResult = await uploadSingleFileToS3(
      selectedFile,
      'profile-pictures/',
      480 // resize width
    );

    // Update user profile picture URL
    user.profilePicture = uploadResult.url;
    user.updatedAt = Date.now();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully',
      profilePicture: user.profilePicture,
      uploadDetails: {
        size: uploadResult.size,
        mimeType: uploadResult.mimeType
      }
    });
  } catch (error) {
    console.error('Error updating profile picture:', error);
    // If multer/middleware forwarded an error, respond gracefully
    res.status(500).json({
      success: false,
      message: 'Server error: ' + (error.message || error)
    });
  }
});


/**
 * @route   POST /api/users/:userId/request-deletion
 * @desc    Request account deletion (user initiated)
 * @access  Private
 */
router.post('/:userId/request-deletion', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    // Verify user permissions (only the same user can request deletion)
    if (req.user._id.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only delete your own account' 
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Add deletion request timestamp
    user.deletionRequest = {
      requestedAt: new Date(),
      reason: reason || 'User requested account deletion',
      status: 'pending'
    };
    
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Account deletion request submitted successfully. Your account will be deleted within 30 days.',
      deletionScheduledAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    });

  } catch (error) {
    console.error('Error requesting account deletion:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

/**
 * @route   POST /api/users/:userId/cancel-deletion
 * @desc    Cancel account deletion request
 * @access  Private
 */
router.post('/:userId/cancel-deletion', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user permissions
    if (req.user._id.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }

    // FIX: Set status to 'cancelled' instead of using $unset
    // The schema has a default value for status, so $unset doesn't work properly
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'deletionRequest.status': 'cancelled',
          'deletionRequest.cancelledAt': new Date()
        }
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Account deletion request cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling account deletion:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

/**
 * @route   POST /api/users/admin/:userId/cancel-deletion
 * @desc    Admin cancels a user's account deletion request
 * @access  Admin only
 */
router.post('/admin/:userId/cancel-deletion', verifyToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // FIX: Set status to 'cancelled' instead of using $unset
    // The schema has a default value for status, so $unset doesn't work properly
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'deletionRequest.status': 'cancelled',
          'deletionRequest.cancelledAt': new Date()
        }
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      message: `Deletion request cancelled for user ${user.email || user.phoneNumber}`,
      user: { _id: user._id, name: user.name, email: user.email, phoneNumber: user.phoneNumber }
    });

  } catch (error) {
    console.error('Error cancelling deletion (admin):', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route   DELETE /api/users/:userId/delete-account
 * @desc    Permanently delete user account and all associated data
 * @access  Private (User or Admin)
 */
router.delete('/:userId/delete-account', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { confirmPassword } = req.body;

    // Verify user permissions (either the same user or admin)
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized to delete this account' 
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Start deletion process
    console.log(`Starting account deletion for user: ${user.email}`);

    // 1. Delete profile picture from S3 if exists
    if (user.profilePicture && user.profilePicture.includes('s3.amazonaws.com')) {
      try {
        await deleteImageFromS3(user.profilePicture);
        console.log('Profile picture deleted from S3');
      } catch (error) {
        console.error('Error deleting profile picture:', error);
      }
    }

    // 2. Delete KYC documents from S3
    if (user.kycDocuments && user.kycDocuments.length > 0) {
      for (const doc of user.kycDocuments) {
        if (doc.docUrl && doc.docUrl.includes('s3.amazonaws.com')) {
          try {
            await deleteImageFromS3(doc.docUrl);
            console.log(`KYC document deleted: ${doc.docType}`);
          } catch (error) {
            console.error('Error deleting KYC document:', error);
          }
        }
      }
    }

    // 3. Delete user transactions
    try {
      const deletedTransactions = await Transaction.deleteMany({ user: userId });
      console.log(`Deleted ${deletedTransactions.deletedCount} transactions`);
    } catch (error) {
      console.error('Error deleting transactions:', error);
    }

    // 4. Delete user orders (if Order model exists)
    // try {
    //   const deletedOrders = await Order.deleteMany({ user: userId });
    //   console.log(`Deleted ${deletedOrders.deletedCount} orders`);
    // } catch (error) {
    //   console.error('Error deleting orders:', error);
    // }

    // 5. Remove user from referral chains
    try {
      // Remove this user from other users' referredUsers arrays
      await User.updateMany(
        { referredUsers: userId },
        { $pull: { referredUsers: userId } }
      );

      // Remove referredBy reference if this user referred others
      await User.updateMany(
        { referredBy: userId },
        { $unset: { referredBy: 1 } }
      );

      console.log('Referral chain cleaned up');
    } catch (error) {
      console.error('Error cleaning referral chain:', error);
    }

    // 6. Finally, delete the user account
    await User.findByIdAndDelete(userId);
    
    console.log(`Account deleted successfully: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'Account and all associated data deleted successfully',
      deletedData: {
        user: true,
        transactions: true,
        profilePicture: user.profilePicture ? true : false,
        kycDocuments: user.kycDocuments?.length || 0,
        addresses: user.addresses?.length || 0,
        bankDetails: user.bankDetails?.length || 0
      }
    });

  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while deleting account' 
    });
  }
});

/**
 * @route   GET /api/users/:userId/deletion-info
 * @desc    Get information about what data will be deleted
 * @access  Private
 */
router.get('/:userId/deletion-info', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user permissions
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Count transactions
    const transactionCount = await Transaction.countDocuments({ user: userId });

    res.status(200).json({
      success: true,
      deletionInfo: {
        dataToBeDeleted: [
          'Your profile information (name, email, phone)',
          'Profile picture',
          'All saved addresses',
          'Bank account details',
          'KYC documents and verification status',
          'Wallet balance and transaction history',
          'Wishlist items',
          'Referral code and referral history',
          'All app preferences and settings'
        ],
        dataCounts: {
          addresses: user.addresses?.length || 0,
          bankAccounts: user.bankDetails?.length || 0,
          kycDocuments: user.kycDocuments?.length || 0,
          transactions: transactionCount,
          wishlistItems: user.wishlist?.length || 0,
          walletBalance: user.wallet?.balance || 0
        },
        retentionPeriod: '30 days',
        note: 'After deletion, this action cannot be undone. Some data may be retained for legal and compliance purposes as per our Privacy Policy.'
      }
    });

  } catch (error) {
    console.error('Error fetching deletion info:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});


/* ============================================================
   📌 GET USER VERIFICATION STATUS (ADMIN)
   Check user's phone/email and verification status
============================================================ */
router.get('/admin/verification-status/:userId', verifyToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select(
      'name email phoneNumber phoneVerified emailVerified authMethod createdAt'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.json({
      success: true,
      data: {
        userId: user._id,
        name: user.name,
        email: user.email || null,
        phoneNumber: user.phoneNumber || null,
        phoneVerified: user.phoneVerified || false,
        emailVerified: user.emailVerified || false,
        authMethod: user.authMethod || 'unknown',
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Error fetching verification status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;