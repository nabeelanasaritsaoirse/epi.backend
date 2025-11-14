const express = require("express");
const router = express.Router();
const { verifyFirebaseToken, verifyToken, verifyRefreshToken, isAdmin, generateTokens } = require("../middlewares/auth");
const User = require("../models/User");
const admin = require("firebase-admin");


router.post("/login", async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "ID token is required",
        code: "NO_ID_TOKEN"
      });
    }

    console.log('Starting login process...');
    
    // Decode token without verification for custom tokens
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (verifyError) {
      // If it's a custom token, decode it manually
      if (verifyError.code === 'auth/argument-error') {
        const base64Payload = idToken.split('.')[1];
        const payload = Buffer.from(base64Payload, 'base64').toString();
        decodedToken = JSON.parse(payload);
        console.log('Custom token decoded:', decodedToken);
      } else {
        throw verifyError;
      }
    }
    
    const uid = decodedToken.uid || decodedToken.sub;
    console.log('Token verified. UID:', uid);

    let user = await User.findOne({ firebaseUid: uid });
    console.log('User found:', user ? 'Yes' : 'No');

    if (!user) {
      console.log('Creating new user...');
      const userData = {
        firebaseUid: uid,
        name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
        profilePicture: decodedToken.picture || '',
      };

      if (decodedToken.email) {
        userData.email = decodedToken.email;
      } else {
        userData.email = `${uid}@temp.user`;
      }

      try {
        user = new User(userData);
        await user.save();
        console.log('User created. ID:', user._id);
      } catch (saveError) {
        if (saveError.code === 11000) {
          // Duplicate key error - check if user exists with this email or firebaseUid
          console.log('Duplicate key error. Checking for existing user...');

          // Try to find by firebaseUid first
          user = await User.findOne({ firebaseUid: uid });

          // If not found by firebaseUid, try by email
          if (!user && decodedToken.email) {
            user = await User.findOne({ email: decodedToken.email });

            // If user exists with this email but different firebaseUid, update the firebaseUid
            if (user) {
              console.log('User exists with this email but different firebaseUid. Updating firebaseUid...');
              user.firebaseUid = uid;
              await user.save();
              console.log('FirebaseUid updated successfully');
            }
          }

          if (!user) throw saveError;
        } else {
          throw saveError;
        }
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        code: "USER_NOT_FOUND"
      });
    }

    console.log('Generating JWT tokens...');
    const tokens = generateTokens(user._id.toString(), user.role);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        profilePicture: user.profilePicture,
        role: user.role,
        referralCode: user.referralCode,
        isAgree: user.isAgree,
        wallet: user.wallet,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });
  } catch (error) {
    console.error('Login error:', error);

    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again',
        code: 'FIREBASE_TOKEN_EXPIRED'
      });
    }

    return res.status(500).json({
      success: false,
      message: "Authentication failed",
      error: error.message
    });
  }
});
router.post("/refresh-token", verifyRefreshToken, async (req, res) => {
  try {
    const tokens = generateTokens(req.user._id.toString(), req.user.role);

    return res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false,
      message: "Token refresh failed",
      error: error.message 
    });
  }
});

router.post("/logout", verifyToken, async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: "Logout successful"
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false,
      message: "Logout failed",
      error: error.message 
    });
  }
});

router.post("/signup", async (req, res) => {
  try {
    const {
      name,
      email,
      phoneNumber,
      profilePicture,
      referralCode,
      referredByCode,
      firebaseUid,
    } = req.body;

    if (!firebaseUid) {
      return res.status(400).json({ 
        success: false,
        message: "Firebase UID is required",
        code: "NO_FIREBASE_UID"
      });
    }

    if (!email && !phoneNumber) {
      return res.status(400).json({ 
        success: false,
        message: "Email or phone number is required",
        code: "NO_CONTACT_INFO"
      });
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid email format",
          code: "INVALID_EMAIL"
        });
      }
    }

    const searchConditions = [{ firebaseUid }];
    if (email && !email.includes('@phone.user') && !email.includes('@temp.user')) {
      searchConditions.push({ email });
    }
    if (phoneNumber) {
      searchConditions.push({ phoneNumber });
    }

    let existingUser = await User.findOne({ $or: searchConditions });
    
    if (existingUser) {
      const tokens = generateTokens(existingUser._id.toString(), existingUser.role);
      
      return res.status(200).json({
        success: true,
        message: "User already exists",
        data: {
          userId: existingUser._id,
          name: existingUser.name,
          email: existingUser.email,
          phoneNumber: existingUser.phoneNumber,
          role: existingUser.role,
          referralCode: existingUser.referralCode,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken
        }
      });
    }

    const userData = {
      name: name || phoneNumber || 'User',
      firebaseUid,
      profilePicture: profilePicture || "",
    };

    if (email && !email.includes('@phone.user') && !email.includes('@temp.user')) {
      userData.email = email;
    } else if (phoneNumber) {
      userData.email = `${firebaseUid}@phone.user`;
      userData.phoneNumber = phoneNumber;
    } else {
      userData.email = `${firebaseUid}@temp.user`;
    }

    if (phoneNumber) {
      userData.phoneNumber = phoneNumber;
    }

    let user = new User(userData);

    const codeToUse = referralCode || referredByCode;
    let referrer = null;
    
    if (codeToUse) {
      referrer = await User.findOne({ referralCode: codeToUse });

      if (referrer) {
        user.referredBy = referrer._id;
        await user.save();

        await User.findByIdAndUpdate(referrer._id, {
          $push: { referredUsers: user._id },
        });
      } else {
        await user.save();
        
        const tokens = generateTokens(user._id.toString(), user.role);
        
        return res.status(201).json({
          success: true,
          message: "User created successfully, but referral code was invalid",
          data: {
            userId: user._id,
            name: user.name,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            referralCode: user.referralCode,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken
          }
        });
      }
    } else {
      await user.save();
    }

    const tokens = generateTokens(user._id.toString(), user.role);

    return res.status(201).json({
      success: true,
      message: "Signup successful",
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        referralCode: user.referralCode,
        referralApplied: referrer ? true : false,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false,
      message: "Server error",
      error: error.message 
    });
  }
});

router.post("/checkUserExists", async (req, res) => {
  try {
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
      return res.status(400).json({ 
        success: false,
        message: "Email or phone number is required",
        code: "NO_CONTACT_INFO"
      });
    }

    const searchConditions = [];
    if (email && !email.includes('@phone.user') && !email.includes('@temp.user')) {
      searchConditions.push({ email });
    }
    if (phoneNumber) {
      searchConditions.push({ phoneNumber });
    }

    if (searchConditions.length === 0) {
      return res.status(200).json({
        success: true,
        exists: false,
        message: "User does not exist"
      });
    }

    let existingUser = await User.findOne({ $or: searchConditions });
    
    if (existingUser) {
      return res.status(200).json({
        success: true,
        exists: true,
        message: "User already exists",
        data: {
          userId: existingUser._id
        }
      });
    } else {
      return res.status(200).json({
        success: true,
        exists: false,
        message: "User does not exist"
      });
    }
  } catch (error) {
    return res.status(500).json({ 
      success: false,
      message: "Server error",
      error: error.message 
    });
  }
});

router.get("/profile/:userId", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select("-__v")
      .populate("wallet.transactions", "type amount status createdAt");

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found",
        code: "USER_NOT_FOUND"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      data: user
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false,
      message: "Server error",
      error: error.message 
    });
  }
});

router.put("/profile", verifyToken, async (req, res) => {
  try {
    const { name, phoneNumber, deviceToken } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (phoneNumber) updates.phoneNumber = phoneNumber;
    if (deviceToken) updates.deviceToken = deviceToken;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
        code: "NO_UPDATE_FIELDS"
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true }
    ).select("-__v");

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

router.put("/update-user-details", async (req, res) => {
  try {
    const { idToken, name, deviceToken } = req.body;

    console.log('Update user details request received');

    // Validate required field
    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "Firebase ID token is required",
        code: "NO_ID_TOKEN"
      });
    }

    // Verify Firebase token
    console.log('Verifying Firebase token...');
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    console.log('Firebase token verified successfully. UID:', uid);

    // Find user by firebaseUid
    let user = await User.findOne({ firebaseUid: uid });

    if (!user) {
      console.log('User not found with UID:', uid);
      return res.status(404).json({
        success: false,
        message: "User not found. Please login first",
        code: "USER_NOT_FOUND"
      });
    }

    console.log('User found. User ID:', user._id);

    // Prepare updates object
    const updates = {};

    if (name && name.trim() !== '') {
      updates.name = name.trim();
      console.log('Updating name to:', name);
    }

    if (deviceToken && deviceToken.trim() !== '') {
      updates.deviceToken = deviceToken.trim();
      console.log('Updating device token');
    }

    // Check if there are any updates
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update. Please provide name or deviceToken",
        code: "NO_UPDATE_FIELDS"
      });
    }

    // Update user
    updates.updatedAt = Date.now();
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $set: updates },
      { new: true }
    ).select("-__v");

    console.log('User details updated successfully');

    return res.status(200).json({
      success: true,
      message: "User details updated successfully",
      data: {
        userId: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phoneNumber: updatedUser.phoneNumber,
        profilePicture: updatedUser.profilePicture,
        deviceToken: updatedUser.deviceToken,
        role: updatedUser.role,
        referralCode: updatedUser.referralCode,
        isAgree: updatedUser.isAgree,
        wallet: updatedUser.wallet
      }
    });
  } catch (error) {
    console.error('Update user details error:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });

    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        success: false,
        message: 'Firebase token expired. Please login again',
        code: 'FIREBASE_TOKEN_EXPIRED'
      });
    }

    if (error.code === 'auth/argument-error') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update user details",
      error: error.message,
      errorCode: error.code,
      errorName: error.name
    });
  }
});

router.post("/admin-login", async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('Admin login attempt received');

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
        code: "MISSING_CREDENTIALS"
      });
    }

    console.log('Verifying admin credentials...');

    // Get admin credentials from environment variables
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@epi.com';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123456';

    // Verify credentials
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      console.log('Invalid admin credentials provided');
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
        code: "INVALID_CREDENTIALS"
      });
    }

    console.log('Admin credentials verified successfully');

    // Check if admin user exists in database
    let adminUser = await User.findOne({ email: ADMIN_EMAIL, role: 'admin' });

    // If admin doesn't exist, create one
    if (!adminUser) {
      console.log('Admin user not found in database. Creating admin user...');

      // Generate a unique firebaseUid for admin
      const crypto = require('crypto');
      const adminFirebaseUid = 'admin_' + crypto.randomBytes(8).toString('hex');

      adminUser = new User({
        name: 'Admin',
        email: ADMIN_EMAIL,
        firebaseUid: adminFirebaseUid,
        role: 'admin',
        profilePicture: '',
        phoneNumber: '',
        isActive: true
      });

      await adminUser.save();
      console.log('Admin user created successfully. User ID:', adminUser._id);
    } else {
      console.log('Admin user found. User ID:', adminUser._id);
    }

    // Generate JWT tokens
    console.log('Generating JWT tokens for admin...');
    const tokens = generateTokens(adminUser._id.toString(), adminUser.role);
    console.log('Tokens generated successfully');

    return res.status(200).json({
      success: true,
      message: "Admin login successful",
      data: {
        userId: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        profilePicture: adminUser.profilePicture,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });
  } catch (error) {
    console.error('Admin login error:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });

    // Handle duplicate key error
    if (error.code === 11000) {
      console.log('Duplicate key error during admin creation. Trying to find existing admin...');

      try {
        const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@epi.com';
        const adminUser = await User.findOne({ email: ADMIN_EMAIL, role: 'admin' });

        if (adminUser) {
          const tokens = generateTokens(adminUser._id.toString(), adminUser.role);

          return res.status(200).json({
            success: true,
            message: "Admin login successful",
            data: {
              userId: adminUser._id,
              name: adminUser.name,
              email: adminUser.email,
              role: adminUser.role,
              profilePicture: adminUser.profilePicture,
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken
            }
          });
        }
      } catch (recoveryError) {
        console.error('Error recovering from duplicate key:', recoveryError);
      }
    }

    return res.status(500).json({
      success: false,
      message: "Admin login failed",
      error: error.message,
      errorCode: error.code,
      errorName: error.name
    });
  }
});

router.post("/applyReferralCode", verifyToken, async (req, res) => {
  try {
    const { referralCode } = req.body;

    if (!referralCode) {
      return res.status(400).json({ 
        success: false,
        message: "Referral code is required",
        code: "NO_REFERRAL_CODE"
      });
    }

    const user = req.user;

    if (user.referredBy) {
      return res.status(400).json({ 
        success: false,
        message: "Referral code already applied to this account",
        code: "REFERRAL_ALREADY_APPLIED"
      });
    }

    const referrer = await User.findOne({ referralCode: referralCode });
    if (!referrer) {
      return res.status(404).json({ 
        success: false,
        message: "Invalid referral code",
        code: "INVALID_REFERRAL_CODE"
      });
    }

    if (referrer._id.toString() === user._id.toString()) {
      return res.status(400).json({ 
        success: false,
        message: "You cannot use your own referral code",
        code: "SELF_REFERRAL"
      });
    }

    user.referredBy = referrer._id;
    await user.save();

    await User.findByIdAndUpdate(referrer._id, {
      $push: { referredUsers: user._id },
    });

    return res.status(200).json({
      success: true,
      message: "Referral code applied successfully",
      data: {
        userId: user._id,
        referrerId: referrer._id
      }
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false,
      message: "Server error",
      error: error.message 
    });
  }
});

router.put("/:userId/bank-details", verifyToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    const { accountNumber, ifscCode, accountHolderName, upiId, bankName, branchName, isDefault } = req.body;
    
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Unauthorized access',
        code: 'UNAUTHORIZED'
      });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found",
        code: "USER_NOT_FOUND"
      });
    }
    
    const newBankDetails = {
      accountNumber: accountNumber || '',
      ifscCode: ifscCode || '',
      accountHolderName: accountHolderName || '',
      bankName: bankName || '',
      branchName: branchName || '',
      upiId: upiId || '',
      isDefault: isDefault || false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    if (isDefault) {
      await User.updateOne(
        { _id: userId },
        { $set: { "bankDetails.$[].isDefault": false } }
      );
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $push: { bankDetails: newBankDetails } },
      { new: true }
    ).select("-__v");

    return res.status(200).json({
      success: true,
      message: "Bank details added successfully",
      data: updatedUser.bankDetails
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false,
      message: "Server error",
      error: error.message 
    });
  }
});

router.post("/:userId/kyc", verifyToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    const { documents, aadharCardNumber, panCardNumber } = req.body;

    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Unauthorized access',
        code: 'UNAUTHORIZED'
      });
    }

    if ((!documents || !Array.isArray(documents) || documents.length === 0) && 
        !aadharCardNumber && !panCardNumber) {
      return res.status(400).json({ 
        success: false,
        message: "Please provide at least one document or ID information (Aadhar/PAN)",
        code: "NO_KYC_DATA"
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found",
        code: "USER_NOT_FOUND"
      });
    }
    
    const updates = {};
    
    if (aadharCardNumber || panCardNumber) {
      if (!user.kycDetails) {
        updates.kycDetails = {
          aadharCardNumber: '',
          panCardNumber: '',
          aadharVerified: false,
          panVerified: false
        };
      }
      
      if (aadharCardNumber) {
        if (!/^\d{12}$/.test(aadharCardNumber)) {
          return res.status(400).json({ 
            success: false,
            message: "Aadhar Card Number must be 12 digits",
            code: "INVALID_AADHAR"
          });
        }
        updates['kycDetails.aadharCardNumber'] = aadharCardNumber;
        updates['kycDetails.aadharVerified'] = false;
      }
      
      if (panCardNumber) {
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panCardNumber)) {
          return res.status(400).json({ 
            success: false,
            message: "PAN Card Number must be in valid format (e.g., ABCDE1234F)",
            code: "INVALID_PAN"
          });
        }
        updates['kycDetails.panCardNumber'] = panCardNumber;
        updates['kycDetails.panVerified'] = false;
      }
    }
    
    if (documents && Array.isArray(documents) && documents.length > 0) {
      for (const doc of documents) {
        if (!doc.docType || !doc.docUrl) {
          return res.status(400).json({ 
            success: false,
            message: "Each document must have docType and docUrl",
            code: "INVALID_DOCUMENT_FORMAT"
          });
        }
      }
      
      const formattedDocuments = documents.map(doc => ({
        ...doc,
        status: 'pending',
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
      
      updates.$push = { kycDocuments: { $each: formattedDocuments } };
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updates,
      { new: true }
    ).select("-__v");

    return res.status(200).json({
      success: true,
      message: "KYC details submitted successfully",
      data: {
        kycDetails: updatedUser.kycDetails,
        kycDocuments: updatedUser.kycDocuments
      }
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false,
      message: "Server error",
      error: error.message 
    });
  }
});

router.put("/:userId/agree-terms", verifyToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    const { isAgree } = req.body;
    
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Unauthorized access',
        code: 'UNAUTHORIZED'
      });
    }
    
    if (isAgree === undefined || typeof isAgree !== 'boolean') {
      return res.status(400).json({ 
        success: false,
        message: "isAgree must be a boolean value",
        code: "INVALID_AGREE_VALUE"
      });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found",
        code: "USER_NOT_FOUND"
      });
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { isAgree } },
      { new: true }
    ).select("-__v");

    return res.status(200).json({
      success: true,
      message: isAgree ? "Terms agreed successfully" : "Terms agreement revoked",
      data: {
        userId: updatedUser._id,
        isAgree: updatedUser.isAgree
      }
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false,
      message: "Server error",
      error: error.message 
    });
  }
});


module.exports = router;
