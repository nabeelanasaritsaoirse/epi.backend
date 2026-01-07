const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateTokens, verifyToken } = require('../middlewares/auth');
const { submitRegistrationRequest } = require('../controllers/adminRegistrationController');

/**
 * @route   POST /api/admin-auth/register-request
 * @desc    Submit admin registration request
 * @access  Public
 */
router.post('/register-request', submitRegistrationRequest);

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

    // Find admin user (includes sales_team)
    const adminUser = await User.findOne({
      email,
      role: { $in: ['admin', 'super_admin', 'sales_team'] }
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
    let isSalesTeam = false;

    if (adminUser.role === 'super_admin') {
      // Super admin gets empty array - frontend shows ALL modules
      isSuperAdmin = true;
      userModules = [];
    } else if (adminUser.role === 'admin') {
      // Sub-admin gets assigned modules (whatever frontend sent)
      userModules = adminUser.moduleAccess || [];
    } else if (adminUser.role === 'sales_team') {
      // Sales team gets fixed modules
      isSalesTeam = true;
      userModules = ['sales-dashboard', 'users'];
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
        isSalesTeam,
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

/**
 * @route   POST /api/admin-auth/change-password
 * @desc    Change password for logged-in admin (both super_admin and sub-admin)
 * @access  Authenticated Admin/Super Admin
 */
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    console.log('Password change request for user:', req.user.email);

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Verify user is admin or super_admin
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can change password via this endpoint',
        code: 'NOT_ADMIN'
      });
    }

    // Validate new password strength
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long',
        code: 'WEAK_PASSWORD'
      });
    }

    // Don't allow same password
    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password',
        code: 'SAME_PASSWORD'
      });
    }

    // Get user from database
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Verify current password
    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'No password set for this account',
        code: 'NO_PASSWORD'
      });
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      console.log('Invalid current password for:', user.email);
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }

    // Hash and save new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    user.updatedAt = new Date();
    await user.save();

    console.log('Password changed successfully for:', user.email);

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully',
      data: {
        email: user.email,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('Password change error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
});

module.exports = router;
