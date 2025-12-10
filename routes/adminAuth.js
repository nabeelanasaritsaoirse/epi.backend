const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateTokens } = require('../middlewares/auth');

/**
 * @route   POST /api/admin-auth/login
 * @desc    Admin login with email and password (not Firebase)
 * @access  Public
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('Admin password-based login attempt:', email);

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Find admin user
    const adminUser = await User.findOne({
      email,
      role: { $in: ['admin', 'super_admin'] }
    });

    if (!adminUser) {
      console.log('Admin user not found:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if account is active
    if (!adminUser.isActive) {
      console.log('Admin account is inactive:', email);
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact super admin.',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    // Verify password
    if (!adminUser.password) {
      console.log('Admin has no password set:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, adminUser.password);

    if (!isPasswordValid) {
      console.log('Invalid password for admin:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    console.log('Admin authentication successful:', email);

    // Update last login
    adminUser.lastLogin = new Date();
    await adminUser.save();

    // Determine user's modules
    let userModules = [];
    let isSuperAdmin = false;

    if (adminUser.role === 'super_admin') {
      // Super admin gets empty array - frontend shows ALL modules
      isSuperAdmin = true;
      userModules = [];
    } else if (adminUser.role === 'admin') {
      // Sub-admin gets assigned modules (whatever frontend sent)
      userModules = adminUser.moduleAccess || [];
    }

    // Generate JWT tokens
    const tokens = generateTokens(adminUser._id.toString(), adminUser.role);

    console.log('Login successful for:', email, '- Role:', adminUser.role);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        userId: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        profilePicture: adminUser.profilePicture || '',
        isSuperAdmin,
        modules: userModules,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

module.exports = router;
