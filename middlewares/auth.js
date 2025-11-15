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
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY = '30d';

const generateAccessToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
};

const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
};

const generateTokens = (userId, role) => {
  return {
    accessToken: generateAccessToken(userId, role),
    refreshToken: generateRefreshToken(userId)
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
    
    const decoded = jwt.verify(token, JWT_SECRET);

    // ⭐ FIX: ADMIN LOGIN USES "id", not "userId"
    const userId = decoded.userId || decoded.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
        code: "INVALID_PAYLOAD"
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
    
    req.user = user;
    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token', code: 'INVALID_TOKEN' });
    }
    
    return res.status(401).json({ 
      success: false,
      message: 'Authentication failed',
      error: error.message 
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
    
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token type',
        code: 'INVALID_TOKEN_TYPE'
      });
    }
    
    const user = await User.findById(decoded.userId);
    
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
    
    req.user = user;
    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Refresh token expired', code: 'REFRESH_TOKEN_EXPIRED' });
    }

    return res.status(401).json({ 
      success: false,
      message: 'Token verification failed',
      error: error.message 
    });
  }
};



// 🔥 CHECK ADMIN
exports.isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ 
      success: false,
      message: 'Access denied. Admin role required.',
      code: 'ADMIN_REQUIRED'
    });
  }
};


// EXPORT TOKENS
exports.generateTokens = generateTokens;
