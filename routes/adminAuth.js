const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateTokens, verifyToken, hasRole, hasAnyRole } = require('../middlewares/auth');
const { submitRegistrationRequest } = require('../controllers/adminRegistrationController');
const { canAccessPanel, getAllRoles } = require('../utils/roleHelpers');

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

    // Find user by email first (supports additionalRoles)
    const adminUser = await User.findOne({ email });

    if (!adminUser) {
      console.log('User not found:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if user can access panel (admin, super_admin, or sales_team in role OR additionalRoles)
    if (!canAccessPanel(adminUser)) {
      console.log('User does not have panel access:', email);
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

    // AUTO-LINK: If admin/sales_team has same email/phone as a user account, link them
    if (!adminUser.linkedUserId) {
      const linkedUser = await User.findOne({
        _id: { $ne: adminUser._id },  // Not the same account
        role: 'user',
        $or: [
          { email: adminUser.email },
          ...(adminUser.phoneNumber ? [{ phoneNumber: adminUser.phoneNumber }] : [])
        ]
      });
      if (linkedUser) {
        adminUser.linkedUserId = linkedUser._id;
        console.log(`[Auto-Link] Linked admin ${adminUser.email} to user ${linkedUser._id}`);
      }
    }

    // Update last login
    adminUser.lastLogin = new Date();
    await adminUser.save();

    // Populate linkedUserId if exists
    if (adminUser.linkedUserId) {
      await adminUser.populate('linkedUserId', '_id name email phoneNumber referralCode');
    }

    // Determine user's modules (supports additionalRoles)
    let userModules = [];
    let isSuperAdminFlag = false;
    let isSalesTeamFlag = false;
    let isAdminFlag = false;

    // Check roles using helper functions (checks both role and additionalRoles)
    if (hasRole(adminUser, 'super_admin')) {
      // Super admin gets empty array - frontend shows ALL modules
      isSuperAdminFlag = true;
      userModules = [];
    } else if (hasRole(adminUser, 'admin')) {
      // Admin gets assigned modules
      isAdminFlag = true;
      userModules = adminUser.moduleAccess || [];
    }

    // Sales team check (can be in addition to other roles)
    if (hasRole(adminUser, 'sales_team')) {
      isSalesTeamFlag = true;
      // Add sales modules if not super admin
      if (!isSuperAdminFlag) {
        const salesModules = ['sales-dashboard', 'sales-users'];
        userModules = [...new Set([...userModules, ...salesModules])];
      }
    }

    // Generate JWT tokens
    const tokens = generateTokens(adminUser._id.toString(), adminUser.role);

    // Get all roles for the user
    const allRoles = getAllRoles(adminUser);
    console.log('Login successful for:', email, '- Roles:', allRoles);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        userId: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,                    // Primary role (backward compatible)
        additionalRoles: adminUser.additionalRoles || [], // Additional roles
        allRoles: allRoles,                      // All roles combined
        profilePicture: adminUser.profilePicture || '',
        isSuperAdmin: isSuperAdminFlag,
        isAdmin: isAdminFlag,
        isSalesTeam: isSalesTeamFlag,
        modules: userModules,
        // Include linked user info for sales team (so frontend knows who they're viewing as)
        linkedUserId: adminUser.linkedUserId ? {
          _id: adminUser.linkedUserId._id,
          name: adminUser.linkedUserId.name,
          email: adminUser.linkedUserId.email,
          phoneNumber: adminUser.linkedUserId.phoneNumber,
          referralCode: adminUser.linkedUserId.referralCode
        } : null,
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
