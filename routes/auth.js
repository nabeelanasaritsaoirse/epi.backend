// const express = require("express");
// const router = express.Router();
// const { verifyToken, isAdmin } = require("../middlewares/auth");
// const User = require("../models/User");
// const admin = require("firebase-admin");

// // Login with Firebase token
// router.post("/login", async (req, res) => {
//   try {
//     const { idToken } = req.body;

//     if (!idToken) {
//       return res.status(400).json({ message: "ID token is required" });
//     }

//     // Verify Firebase token
//     const decodedToken = await admin.auth().verifyIdToken(idToken);
//     const uid = decodedToken.uid;

//     // Check if user exists in our database
//     let user = await User.findOne({ firebaseUid: uid });

//     // If user doesn't exist in our database but exists in Firebase, create a new user
//     if (!user && decodedToken.email) {
//       user = new User({
//         name: decodedToken.name || decodedToken.email.split("@")[0],
//         email: decodedToken.email,
//         profilePicture: decodedToken.picture || "",
//         firebaseUid: uid,
//       });
//       await user.save();
//     }

//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     res.status(200).json(user);
//   } catch (error) {
//     console.error("Login error:", error);
//     res.status(401).json({ message: "Authentication failed" });
//   }
// });

// // Get current user profile
// router.get("/profile/:userId", async (req, res) => {
//   try {
//     const user = await User.findById(req.params.userId)
//       .select("-__v -wishlist")
//       .populate("wallet.transactions", "type amount status createdAt");

//     res.status(200).json(user);
//   } catch (error) {
//     console.error("Error fetching user profile:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // Update user profile
// router.put("/profile", verifyToken, async (req, res) => {
//   try {
//     const { name, phoneNumber } = req.body;
//     const updates = {};

//     if (name) updates.name = name;
//     if (phoneNumber) updates.phoneNumber = phoneNumber;

//     const updatedUser = await User.findByIdAndUpdate(
//       req.user._id,
//       { $set: updates },
//       { new: true }
//     ).select("-__v");

//     res.status(200).json(updatedUser);
//   } catch (error) {
//     console.error("Error updating user profile:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // Update bank details
// router.put("/:userId/bank-details", async (req, res) => {
//   try {
//     const userId = req.params.userId;
//     const { accountNumber, ifscCode, accountHolderName, upiId, bankName, branchName, isDefault } = req.body;
    
//     // Find user
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }
    
//     const newBankDetails = {
//       accountNumber: accountNumber || '',
//       ifscCode: ifscCode || '',
//       accountHolderName: accountHolderName || '',
//       bankName: bankName || '',
//       branchName: branchName || '',
//       upiId: upiId || '',
//       isDefault: isDefault || false,
//       createdAt: new Date(),
//       updatedAt: new Date()
//     };
    
//     // If isDefault is true, set all other bank accounts to isDefault: false
//     if (isDefault) {
//       await User.updateOne(
//         { _id: userId },
//         { $set: { "bankDetails.$[].isDefault": false } }
//       );
//     }
    
//     // Add new bank details to the array
//     const updatedUser = await User.findByIdAndUpdate(
//       userId,
//       { $push: { bankDetails: newBankDetails } },
//       { new: true }
//     ).select("-__v");

//     res.status(200).json(updatedUser);
//   } catch (error) {
//     console.error("Error updating bank details:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // Submit KYC documents
// router.post("/:userId/kyc", async (req, res) => {
//   try {
//     const userId = req.params.userId;
//     const { documents, aadharCardNumber, panCardNumber } = req.body;

//     if ((!documents || !Array.isArray(documents) || documents.length === 0) && 
//         !aadharCardNumber && !panCardNumber) {
//       return res.status(400).json({ 
//         message: "Please provide at least one document or ID information (Aadhar/PAN)" 
//       });
//     }

//     // Find user
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }
    
//     const updates = {};
    
//     // Process ID information if provided
//     if (aadharCardNumber || panCardNumber) {
//       // Initialize kycDetails if it doesn't exist
//       if (!user.kycDetails) {
//         updates.kycDetails = {
//           aadharCardNumber: '',
//           panCardNumber: '',
//           aadharVerified: false,
//           panVerified: false
//         };
//       }
      
//       // Validate Aadhar format
//       if (aadharCardNumber) {
//         if (!/^\d{12}$/.test(aadharCardNumber)) {
//           return res.status(400).json({ message: "Aadhar Card Number must be 12 digits" });
//         }
//         updates['kycDetails.aadharCardNumber'] = aadharCardNumber;
//         updates['kycDetails.aadharVerified'] = false;
//       }
      
//       // Validate PAN format
//       if (panCardNumber) {
//         if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panCardNumber)) {
//           return res.status(400).json({ 
//             message: "PAN Card Number must be in valid format (e.g., ABCDE1234F)" 
//           });
//         }
//         updates['kycDetails.panCardNumber'] = panCardNumber;
//         updates['kycDetails.panVerified'] = false;
//       }
//     }
    
//     // Process documents if provided
//     if (documents && Array.isArray(documents) && documents.length > 0) {
//       // Validate each document
//       for (const doc of documents) {
//         if (!doc.docType || !doc.docUrl) {
//           return res.status(400).json({ message: "Each document must have docType and docUrl" });
//         }
//       }
      
//       // Format documents with timestamps
//       const formattedDocuments = documents.map(doc => ({
//         ...doc,
//         status: 'pending',
//         isVerified: false,
//         createdAt: new Date(),
//         updatedAt: new Date()
//       }));
      
//       // Add documents to the updates
//       updates.$push = { kycDocuments: { $each: formattedDocuments } };
//     }
    
//     // Update user with all changes
//     const updatedUser = await User.findByIdAndUpdate(
//       userId,
//       updates,
//       { new: true }
//     ).select("-__v");

//     res.status(200).json(updatedUser);
//   } catch (error) {
//     console.error("Error submitting KYC details:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // Update isAgree status
// router.put("/:userId/agree-terms", async (req, res) => {
//   try {
//     const userId = req.params.userId;
//     const { isAgree } = req.body;
    
//     if (isAgree === undefined || typeof isAgree !== 'boolean') {
//       return res.status(400).json({ message: "isAgree must be a boolean value" });
//     }
    
//     // Find user
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }
    
//     const updatedUser = await User.findByIdAndUpdate(
//       userId,
//       { $set: { isAgree } },
//       { new: true }
//     ).select("-__v");

//     res.status(200).json({
//       success: true,
//       message: isAgree ? "Terms agreed successfully" : "Terms agreement revoked",
//       user: updatedUser
//     });
//   } catch (error) {
//     console.error("Error updating agreement status:", error);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// });

// // Apply referral code
// // Apply referral code for existing users
// router.post("/applyReferralCode", async (req, res) => {
//   try {
//     const { userId, referralCode } = req.body;

//     // Validate required fields
//     if (!userId || !referralCode) {
//       return res
//         .status(400)
//         .json({ message: "User ID and referral code are required" });
//     }

//     // Find the user who wants to apply the code
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     // Check if user already has a referrer
//     if (user.referredBy) {
//       return res.status(400).json({ 
//         message: "You already have a referral applied to your account",
//         success: false
//       });
//     }

//     // Find the referrer using the provided code
//     const referrer = await User.findOne({ referralCode: referralCode });
//     if (!referrer) {
//       return res.status(404).json({ 
//         message: "Invalid referral code", 
//         success: false 
//       });
//     }

//     // Prevent self-referral
//     if (referrer._id.toString() === userId) {
//       return res.status(400).json({ 
//         message: "You cannot use your own referral code", 
//         success: false 
//       });
//     }

//     // Update the user with referrer information
//     user.referredBy = referrer._id;
//     await user.save();

//     // Add current user to referrer's referred users list
//     await User.findByIdAndUpdate(referrer._id, {
//       $push: { referredUsers: user._id },
//     });

//     console.log(`User ${userId} applied referral code from ${referrer._id}`);

//     res.status(200).json({
//       message: "Referral code applied successfully",
//       success: true,
//       referrer: referrer._id
//     });

//   } catch (error) {
//     console.error("Apply referral code error:", error);
//     res.status(500).json({ 
//       message: "Server error", 
//       success: false 
//     });
//   }
// });

// // Signup endpoint with email validation
// router.post("/signup", async (req, res) => {
//   try {
//     const {
//       name,
//       email,
//       phoneNumber,
//       profilePicture,
//       referralCode,
//       referredByCode,
//       firebaseUid,
//       password,
//     } = req.body;

//     // Validate required fields
//     if (!name || !email || !firebaseUid) {
//       return res
//         .status(400)
//         .json({ message: "Name, email, and Firebase UID are required" });
//     }

//     // Email validation using regex
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(email)) {
//       return res.status(400).json({ message: "Invalid email format" });
//     }

//     // Check if user already exists (by email or firebaseUid)
//     let existingUser = await User.findOne({
//       $or: [{ email }, { firebaseUid }],
//     });
//     if (existingUser) {
//       // Return existing user details instead of error
//       return res.status(200).json({
//         user: existingUser._id,
//         message: "User already exists",
//         exists: true,
//       });
//     }

//     // Create new user
//     let user = new User({
//       name,
//       email,
//       firebaseUid,
//       profilePicture: profilePicture || "",
//       phoneNumber: phoneNumber || "",
//     });

//     // Process referral code if provided (support both referralCode and referredByCode)
//     const codeToUse = referralCode || referredByCode;
//     let referrer = null;
    
//     if (codeToUse) {
//       console.log(`Attempting to use referral code: ${codeToUse}`);
      
//       // Find the referrer
//       referrer = await User.findOne({ referralCode: codeToUse });

//       if (referrer) {
//         // Set referrer
//         user.referredBy = referrer._id;

//         // Save user first to get the _id
//         await user.save();

//         // Add current user to referrer's referred users
//         await User.findByIdAndUpdate(referrer._id, {
//           $push: { referredUsers: user._id },
//         });

//         console.log(`User ${user._id} signed up with referral code from ${referrer._id}`);
//       } else {
//         // No valid referrer found, just save the user
//         await user.save();
//         return res.status(201).json({
//           user: user._id,
//           message: "User created successfully, but referral code was invalid",
//           referralApplied: false,
//           exists: false,
//         });
//       }
//     } else {
//       // No referral code provided, just save the user
//       await user.save();
//     }

//     res.status(201).json({
//       user: user._id,
//       message: "Signup successful",
//       referralApplied: referrer ? true : false,
//       exists: false,
//     });
//   } catch (error) {
//     console.error("Signup error:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // Signup endpoint with email validation
// router.post("/checkUserExists", async (req, res) => {
//   try {
//     const { email } = req.body;

//     // Validate required fields
//     if (!email) {
//       return res.status(400).json({ message: "Email is required" });
//     }

//     // Check if user already exists (by email or firebaseUid)
//     let existingUser = await User.findOne({
//       $or: [{ email }],
//     });
//     if (existingUser) {
//       // Return existing user details instead of error
//       return res.status(200).json({
//         userId: existingUser._id,
//         message: "User already exists",
//         exists: true,
//       });
//     } else {
//       return res.status(200).json({
//         message: "User does not exist",
//         exists: false,
//       });
//     }
//   } catch (error) {
//     console.error("Error checking user existence:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // Update user details (name, phone, profile pic, referral ID)
// router.post("/store-user-details", async (req, res) => {
//   try {
//     const {
//       name,
//       phoneNumber,
//       profilePicture,
//       referralCode,
//       firebaseUid,
//       email,
//     } = req.body;

//     if (!firebaseUid) {
//       return res.status(400).json({ message: "Firebase UID is required" });
//     }

//     // Find user by firebaseUid
//     let user = await User.findOne({ firebaseUid });

//     // Create new user if not exists
//     if (!user) {
//       user = new User({
//         name: name || "New User",
//         email: email || "",
//         firebaseUid,
//         profilePicture: profilePicture || "",
//         phoneNumber: phoneNumber || "",
//       });
//       await user.save();
//     } else {
//       // Update existing user
//       const updates = {};

//       // Add fields if provided
//       if (name) updates.name = name;
//       if (phoneNumber) updates.phoneNumber = phoneNumber;
//       if (profilePicture) updates.profilePicture = profilePicture;
//       if (email) updates.email = email;

//       // Apply referral code if provided and user doesn't already have a referrer
//       if (referralCode && !user.referredBy) {
//         // Find the referrer
//         const referrer = await User.findOne({ referralCode });

//         if (referrer) {
//           if (referrer._id.toString() === user._id.toString()) {
//             return res
//               .status(400)
//               .json({ message: "You cannot refer yourself" });
//           }

//           // Set referrer
//           updates.referredBy = referrer._id;

//           // Add current user to referrer's referred users
//           await User.findByIdAndUpdate(referrer._id, {
//             $push: { referredUsers: user._id },
//           });

//           // Add bonus to referrer's wallet (example: 100)
//           await User.findByIdAndUpdate(referrer._id, {
//             $inc: { "wallet.balance": 100 },
//           });
//         } else if (referralCode) {
//           return res.status(400).json({ message: "Invalid referral code" });
//         }
//       }

//       if (Object.keys(updates).length > 0) {
//         user = await User.findByIdAndUpdate(
//           user._id,
//           { $set: updates },
//           { new: true }
//         ).select("-__v");
//       }
//     }

//     res.status(200).json(user);
//   } catch (error) {
//     console.error("Error updating user details:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // Update profile picture
// router.post("/update-profile-picture", async (req, res) => {
//   try {
//     const { profilePicture, firebaseUid, email } = req.body;

//     if (!profilePicture) {
//       return res
//         .status(400)
//         .json({ message: "Profile picture URL is required" });
//     }

//     if (!firebaseUid) {
//       return res.status(400).json({ message: "Firebase UID is required" });
//     }

//     // Find user by firebaseUid
//     let user = await User.findOne({ firebaseUid });

//     // Create new user if not exists
//     if (!user) {
//       user = new User({
//         name: "New User",
//         email: email || "",
//         firebaseUid,
//         profilePicture: profilePicture,
//       });
//       await user.save();
//     } else {
//       // Update existing user
//       user = await User.findByIdAndUpdate(
//         user._id,
//         { $set: { profilePicture } },
//         { new: true }
//       ).select("-__v");
//     }

//     res.status(200).json(user);
//   } catch (error) {
//     console.error("Error updating profile picture:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// module.exports = router;


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

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    let user = await User.findOne({ firebaseUid: uid });

    if (!user) {
      const userData = {
        firebaseUid: uid,
        name: decodedToken.name || decodedToken.phone_number || decodedToken.email?.split('@')[0] || 'User',
        profilePicture: decodedToken.picture || '',
      };
      
      if (decodedToken.email) {
        userData.email = decodedToken.email;
      } else if (decodedToken.phone_number) {
        userData.email = `${uid}@phone.user`;
        userData.phoneNumber = decodedToken.phone_number;
      } else {
        userData.email = `${uid}@temp.user`;
      }
      
      user = new User(userData);
      await user.save();
    }

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found",
        code: "USER_NOT_FOUND"
      });
    }

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
    const { name, phoneNumber } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (phoneNumber) updates.phoneNumber = phoneNumber;

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