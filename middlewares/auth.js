// // const admin = require('firebase-admin');
// // const User = require('../models/User');

// // exports.verifyToken = async (req, res, next) => {
// //   try {
// //     const token = req.headers.authorization?.split('Bearer ')[1];
    
// //     if (!token) {
// //       return res.status(401).json({ message: 'No token provided' });
// //     }
    
// //     const decodedToken = await admin.auth().verifyIdToken(token);
// //     const uid = decodedToken.uid;
    
// //     // Check if user exists in our database
// //     let user = await User.findOne({ firebaseUid: uid });
    
// //     // If user doesn't exist in our database but exists in Firebase, create a new user
// //     if (!user && decodedToken.email) {
// //       user = new User({
// //         name: decodedToken.name || decodedToken.email.split('@')[0],
// //         email: decodedToken.email,
// //         profilePicture: decodedToken.picture || '',
// //         firebaseUid: uid
// //       });
// //       await user.save();
// //     }
    
// //     if (!user) {
// //       return res.status(404).json({ message: 'User not found' });
// //     }
    
// //     req.user = user;
// //     next();
// //   } catch (error) {
// //     console.error('Authentication error:', error);
// //     return res.status(401).json({ message: 'Invalid token' });
// //   }
// // };

// // exports.isAdmin = (req, res, next) => {
// //   if (req.user && req.user.role === 'admin') {
// //     next();
// //   } else {
// //     return res.status(403).json({ message: 'Access denied. Admin role required.' });
// //   }
// // }; 

// const admin = require('firebase-admin');
// const jwt = require('jsonwebtoken');
// const User = require('../models/User');

// const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
// const JWT_EXPIRY = '7d';
// const REFRESH_TOKEN_EXPIRY = '30d';

// const generateAccessToken = (userId, role) => {
//   return jwt.sign(
//     { userId, role },
//     JWT_SECRET,
//     { expiresIn: JWT_EXPIRY }
//   );
// };

// const generateRefreshToken = (userId) => {
//   return jwt.sign(
//     { userId, type: 'refresh' },
//     JWT_SECRET,
//     { expiresIn: REFRESH_TOKEN_EXPIRY }
//   );
// };

// exports.verifyFirebaseToken = async (req, res, next) => {
//   try {
//     const token = req.headers.authorization?.split('Bearer ')[1];
    
//     if (!token) {
//       return res.status(401).json({ 
//         success: false,
//         message: 'Authentication token required' 
//       });
//     }
    
//     const decodedToken = await admin.auth().verifyIdToken(token);
//     const uid = decodedToken.uid;
    
//     let user = await User.findOne({ firebaseUid: uid });
    
//     if (!user) {
//       const userData = {
//         firebaseUid: uid,
//         name: decodedToken.name || decodedToken.phone_number || decodedToken.email?.split('@')[0] || 'User',
//         profilePicture: decodedToken.picture || '',
//       };
      
//       if (decodedToken.email) {
//         userData.email = decodedToken.email;
//       } else if (decodedToken.phone_number) {
//         userData.email = `${uid}@phone.user`;
//         userData.phoneNumber = decodedToken.phone_number;
//       } else {
//         userData.email = `${uid}@temp.user`;
//       }
      
//       user = new User(userData);
//       await user.save();
//     }
    
//     if (!user) {
//       return res.status(404).json({ 
//         success: false,
//         message: 'User not found' 
//       });
//     }
    
//     req.user = user;
//     next();
//   } catch (error) {
//     if (error.code === 'auth/id-token-expired') {
//       return res.status(401).json({ 
//         success: false,
//         message: 'Token expired. Please login again',
//         code: 'TOKEN_EXPIRED'
//       });
//     }
    
//     if (error.code === 'auth/argument-error') {
//       return res.status(401).json({ 
//         success: false,
//         message: 'Invalid token format',
//         code: 'INVALID_TOKEN'
//       });
//     }
    
//     return res.status(401).json({ 
//       success: false,
//       message: 'Authentication failed',
//       error: error.message 
//     });
//   }
// };

// exports.verifyToken = async (req, res, next) => {
//   try {
//     const token = req.headers.authorization?.split('Bearer ')[1];
    
//     if (!token) {
//       return res.status(401).json({ 
//         success: false,
//         message: 'Authentication token required',
//         code: 'NO_TOKEN'
//       });
//     }
    
//     const decoded = jwt.verify(token, JWT_SECRET);
    
//     if (decoded.type === 'refresh') {
//       return res.status(401).json({ 
//         success: false,
//         message: 'Invalid token type. Use access token',
//         code: 'INVALID_TOKEN_TYPE'
//       });
//     }
    
//     const user = await User.findById(decoded.userId);
    
//     if (!user) {
//       return res.status(404).json({ 
//         success: false,
//         message: 'User not found',
//         code: 'USER_NOT_FOUND'
//       });
//     }
    
//     if (!user.isActive) {
//       return res.status(403).json({ 
//         success: false,
//         message: 'Account is disabled',
//         code: 'ACCOUNT_DISABLED'
//       });
//     }
    
//     req.user = user;
//     next();
//   } catch (error) {
//     if (error.name === 'TokenExpiredError') {
//       return res.status(401).json({ 
//         success: false,
//         message: 'Token expired. Please refresh',
//         code: 'TOKEN_EXPIRED'
//       });
//     }
    
//     if (error.name === 'JsonWebTokenError') {
//       return res.status(401).json({ 
//         success: false,
//         message: 'Invalid token',
//         code: 'INVALID_TOKEN'
//       });
//     }
    
//     return res.status(401).json({ 
//       success: false,
//       message: 'Authentication failed',
//       error: error.message 
//     });
//   }
// };

// exports.verifyRefreshToken = async (req, res, next) => {
//   try {
//     const { refreshToken } = req.body;
    
//     if (!refreshToken) {
//       return res.status(401).json({ 
//         success: false,
//         message: 'Refresh token required',
//         code: 'NO_REFRESH_TOKEN'
//       });
//     }
    
//     const decoded = jwt.verify(refreshToken, JWT_SECRET);
    
//     if (decoded.type !== 'refresh') {
//       return res.status(401).json({ 
//         success: false,
//         message: 'Invalid token type',
//         code: 'INVALID_TOKEN_TYPE'
//       });
//     }
    
//     const user = await User.findById(decoded.userId);
    
//     if (!user) {
//       return res.status(404).json({ 
//         success: false,
//         message: 'User not found',
//         code: 'USER_NOT_FOUND'
//       });
//     }
    
//     if (!user.isActive) {
//       return res.status(403).json({ 
//         success: false,
//         message: 'Account is disabled',
//         code: 'ACCOUNT_DISABLED'
//       });
//     }
    
//     req.user = user;
//     next();
//   } catch (error) {
//     if (error.name === 'TokenExpiredError') {
//       return res.status(401).json({ 
//         success: false,
//         message: 'Refresh token expired. Please login again',
//         code: 'REFRESH_TOKEN_EXPIRED'
//       });
//     }
    
//     if (error.name === 'JsonWebTokenError') {
//       return res.status(401).json({ 
//         success: false,
//         message: 'Invalid refresh token',
//         code: 'INVALID_REFRESH_TOKEN'
//       });
//     }
    
//     return res.status(401).json({ 
//       success: false,
//       message: 'Token verification failed',
//       error: error.message 
//     });
//   }
// };

// exports.isAdmin = (req, res, next) => {
//   if (req.user && req.user.role === 'admin') {
//     next();
//   } else {
//     return res.status(403).json({ 
//       success: false,
//       message: 'Access denied. Admin role required.',
//       code: 'ADMIN_REQUIRED'
//     });
//   }
// };

// exports.generateTokens = (userId, role) => {
//   return {


//////////// NEW CODE (FIXED & CLEANED) /////////////
const { admin } = require('../config/firebase');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { hasRole, hasAnyRole, isAdmin, isSuperAdmin, isSalesTeam, isSeller, canAccessPanel } = require('../utils/roleHelpers');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set');
const JWT_ISSUER = process.env.JWT_ISSUER || 'https://api.epi-backend.com';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'epi-api';
const JWT_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY = '30d';

// Maps a role to its default permission set (future-proof — extend as needed)
const ROLE_PERMISSIONS = {
  super_admin:  ['read:any', 'write:any', 'delete:any', 'manage:users', 'manage:admins'],
  admin:        ['read:any', 'write:any', 'delete:any', 'manage:users'],
  sales_team:   ['read:users', 'read:sales', 'write:sales'],
  seller:       ['read:profile', 'write:products', 'read:orders'],
  user:         ['read:profile', 'write:profile', 'read:orders'],
};

const getPermissions = (role) => ROLE_PERMISSIONS[role] || ['read:profile'];

const generateAccessToken = (userId, role, tokenVersion = 0) => {
  if (!userId) throw new Error('userId is required to generate access token');
  if (!role) throw new Error('role is required to generate access token');
  return jwt.sign(
    {
      sub: userId,                    // Standard: Subject
      userId,                         // Backward compatibility
      role,
      permissions: getPermissions(role), // Future-proof permission list
      tokenVersion,
      iss: JWT_ISSUER,                // Issuer URL
      aud: JWT_AUDIENCE,              // Audience — prevents token misuse across apps
      jti: crypto.randomUUID()        // Unique token ID — prevents replay attacks
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
};

const generateRefreshToken = (userId, tokenVersion = 0) => {
  if (!userId) throw new Error('userId is required to generate refresh token');
  return jwt.sign(
    {
      sub: userId,
      userId,
      type: 'refresh',
      tokenVersion,
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
      jti: crypto.randomUUID()
    },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
};

const generateTokens = (userId, role, tokenVersion = 0) => {
  if (!userId) throw new Error('userId is required to generate tokens');
  if (!role) throw new Error('role is required to generate tokens');
  return {
    accessToken: generateAccessToken(userId, role, tokenVersion),
    refreshToken: generateRefreshToken(userId, tokenVersion)
  };
};


// 🔥 VERIFY FIREBASE TOKEN (for mobile users)
exports.verifyFirebaseToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication token required' 
      });
    }
    
    const decodedToken = await admin.auth().verifyIdToken(token);
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
    
    req.user = user;
    next();

  } catch (error) {
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    if (error.code === 'auth/argument-error') {
      return res.status(401).json({ success: false, message: 'Invalid token format', code: 'INVALID_TOKEN' });
    }
    console.error('[verifyFirebaseToken] Unexpected error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
};



// 🔥 VERIFY NORMAL JWT TOKEN (Admin + Web Users)
exports.verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required',
        code: 'NO_TOKEN'
      });
    }

    // Verify signature + expiry + issuer + audience in one shot
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE
      });
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expired. Please refresh your token.', code: 'TOKEN_EXPIRED' });
      }
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ success: false, message: 'Invalid token', code: 'INVALID_TOKEN' });
      }
      // Catches invalid issuer / audience
      return res.status(401).json({ success: false, message: 'Token verification failed', code: 'TOKEN_INVALID', error: jwtError.message });
    }

    // Support sub (new standard) + userId (backward compat) + id (admin legacy)
    const userId = decoded.sub || decoded.userId || decoded.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token payload — missing subject',
        code: 'INVALID_PAYLOAD'
      });
    }

    // Strict tokenVersion check — must exist and must be a number
    if (decoded.tokenVersion === undefined || decoded.tokenVersion === null || typeof decoded.tokenVersion !== 'number') {
      return res.status(401).json({
        success: false,
        message: 'Token is outdated. Please login again',
        code: 'TOKEN_OUTDATED'
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is disabled',
        code: 'ACCOUNT_DISABLED'
      });
    }

    // Check tokenVersion against DB — catches force-logout
    if (decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: 'Session has been revoked. Please login again',
        code: 'TOKEN_INVALIDATED'
      });
    }

    // AUTO-LINK: If admin/sales_team has same email/phone as a user account, link them
    if ((user.role === 'admin' || user.role === 'sales_team') && !user.linkedUserId) {
      const linkedUser = await User.findOne({
        _id: { $ne: user._id },
        role: 'user',
        $or: [
          { email: user.email },
          ...(user.phoneNumber ? [{ phoneNumber: user.phoneNumber }] : [])
        ]
      });
      if (linkedUser) {
        user.linkedUserId = linkedUser._id;
        await user.save();
        console.log(`[Auto-Link] Linked admin ${user.email} to user ${linkedUser._id}`);
      }
    }

    // Populate linkedUserId if exists (for sales team to see their user account details)
    if (user.linkedUserId) {
      await user.populate('linkedUserId', '_id name email phoneNumber referralCode');
    }

    req.user = user;
    next();

  } catch (error) {
    console.error('[verifyToken] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication',
      code: 'AUTH_SERVER_ERROR'
    });
  }
};



// 🔥 VERIFY REFRESH TOKEN
exports.verifyRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required',
        code: 'NO_REFRESH_TOKEN'
      });
    }

    // Verify signature + expiry + issuer + audience
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE
      });
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Refresh token expired. Please login again.', code: 'REFRESH_TOKEN_EXPIRED' });
      }
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ success: false, message: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' });
      }
      return res.status(401).json({ success: false, message: 'Refresh token verification failed', code: 'REFRESH_TOKEN_INVALID', error: jwtError.message });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type — access token cannot be used as refresh token',
        code: 'INVALID_TOKEN_TYPE'
      });
    }

    // Strict tokenVersion check — must exist and must be a number
    if (decoded.tokenVersion === undefined || decoded.tokenVersion === null || typeof decoded.tokenVersion !== 'number') {
      return res.status(401).json({
        success: false,
        message: 'Token is outdated. Please login again',
        code: 'TOKEN_OUTDATED'
      });
    }

    const userId = decoded.sub || decoded.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token payload — missing subject',
        code: 'INVALID_PAYLOAD'
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is disabled',
        code: 'ACCOUNT_DISABLED'
      });
    }

    // Check tokenVersion against DB — catches force-logout
    if (decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: 'Session has been revoked. Please login again',
        code: 'TOKEN_INVALIDATED'
      });
    }

    req.user = user;
    next();

  } catch (error) {
    console.error('[verifyRefreshToken] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during token verification',
      code: 'AUTH_SERVER_ERROR'
    });
  }
};



// 🔥 CHECK ADMIN (supports additionalRoles)
exports.isAdmin = (req, res, next) => {
  if (req.user && hasAnyRole(req.user, ['admin', 'super_admin'])) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied',
    code: 'ADMIN_REQUIRED'
  });
};

// 🔥 CHECK SUPER ADMIN ONLY
exports.isSuperAdmin = (req, res, next) => {
  if (req.user && hasRole(req.user, 'super_admin')) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied. Super admin required.',
    code: 'SUPER_ADMIN_REQUIRED'
  });
};

// 🔥 CHECK SALES TEAM (supports additionalRoles)
exports.isSalesTeam = (req, res, next) => {
  if (req.user && hasRole(req.user, 'sales_team')) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied. Sales team access required.',
    code: 'SALES_TEAM_REQUIRED'
  });
};

// 🔥 CHECK CAN ACCESS PANEL (admin, super_admin, or sales_team)
exports.canAccessPanel = (req, res, next) => {
  if (req.user && canAccessPanel(req.user)) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied. Panel access required.',
    code: 'PANEL_ACCESS_REQUIRED'
  });
};

// 🔥 CHECK SELLER
exports.isSeller = (req, res, next) => {
  if (req.user && isSeller(req.user)) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied. Seller account required.',
    code: 'SELLER_REQUIRED',
  });
};

// 🔥 CHECK SELLER OR ADMIN (seller can act on own resources; admin has full access)
exports.isSellerOrAdmin = (req, res, next) => {
  if (req.user && hasAnyRole(req.user, ['seller', 'admin', 'super_admin'])) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied. Seller or admin required.',
    code: 'SELLER_OR_ADMIN_REQUIRED',
  });
};

// 🔥 CHECK SPECIFIC ROLE (flexible middleware factory)
exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (req.user && hasAnyRole(req.user, roles)) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: `Access denied. Required roles: ${roles.join(' or ')}`,
      code: 'ROLE_REQUIRED'
    });
  };
};



// 🔥 FLEXIBLE AUTH - Accepts BOTH Firebase Token OR JWT Token
exports.verifyAnyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required'
      });
    }

    // Try JWT first (most common for web users)
    // Only JWT signature/expiry/issuer/audience errors fall through to Firebase
    let jwtDecoded = null;
    let jwtVerifyFailed = false;

    try {
      jwtDecoded = jwt.verify(token, JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE
      });
    } catch (jwtError) {
      jwtVerifyFailed = true;
    }

    if (jwtDecoded) {
      // JWT verified — handle all post-verify logic with full error handling
      const userId = jwtDecoded.sub || jwtDecoded.userId || jwtDecoded.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token payload — missing subject',
          code: 'INVALID_PAYLOAD'
        });
      }

      // Strict tokenVersion check — must exist and must be a number
      if (jwtDecoded.tokenVersion === undefined || jwtDecoded.tokenVersion === null || typeof jwtDecoded.tokenVersion !== 'number') {
        return res.status(401).json({
          success: false,
          message: 'Token is outdated. Please login again',
          code: 'TOKEN_OUTDATED'
        });
      }

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account is disabled',
          code: 'ACCOUNT_DISABLED'
        });
      }

      if (jwtDecoded.tokenVersion !== user.tokenVersion) {
        return res.status(401).json({
          success: false,
          message: 'Session has been revoked. Please login again',
          code: 'TOKEN_INVALIDATED'
        });
      }

      req.user = user;
      return next();
    }

    if (jwtVerifyFailed) {
      // JWT failed — try Firebase token
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
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

        req.user = user;
        return next();

      } catch (firebaseError) {
        // Both JWT and Firebase failed
        return res.status(401).json({
          success: false,
          message: 'Authentication failed. Invalid token.',
          code: 'INVALID_TOKEN'
        });
      }
    }

  } catch (error) {
    console.error('[verifyAnyToken] Unexpected error:', error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication',
      code: 'AUTH_SERVER_ERROR'
    });
  }
};


// 🔥 OPTIONAL AUTH - Parses token if present, but doesn't block if missing
// Use this for public routes that need to detect if user is admin
exports.optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE
      });

      const userId = decoded.sub || decoded.userId || decoded.id;

      if (userId && decoded.tokenVersion !== undefined && decoded.tokenVersion !== null && typeof decoded.tokenVersion === 'number') {
        const user = await User.findById(userId);

        if (user && user.isActive && decoded.tokenVersion === user.tokenVersion) {
          req.user = user;
        } else {
          req.user = null;
        }
      } else {
        req.user = null;
      }
    } catch (error) {
      // Token invalid — don't block, just no user
      req.user = null;
    }

    next();
  } catch (error) {
    req.user = null;
    next();
  }
};


// EXPORT TOKENS
exports.generateTokens = generateTokens;

// EXPORT ROLE HELPERS (for convenience)
exports.hasRole = hasRole;
exports.hasAnyRole = hasAnyRole;
exports.isAdminUser = isAdmin;
exports.isSuperAdminUser = isSuperAdmin;
exports.isSalesTeamUser = isSalesTeam;
