const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middlewares/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');


// CREATE NEW USER (ADMIN ONLY)
router.post('/admin/create', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, email, password, phoneNumber, role, referralLimit } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    // Check if email exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // IMPORTANT: Admin-created users MUST have firebaseUid.
    // We will auto-generate a random one so your model does not break.
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

module.exports = router; 