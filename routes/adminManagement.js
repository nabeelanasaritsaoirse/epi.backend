const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { verifyToken } = require('../middlewares/auth');
const User = require('../models/User');
const {
  getRegistrationRequests,
  getRegistrationRequestById,
  approveRegistrationRequest,
  rejectRegistrationRequest
} = require('../controllers/adminRegistrationController');

/**
 * Middleware: Require Super Admin role
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'NOT_AUTHENTICATED'
    });
  }

  if (req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only Super Admin can perform this action.',
      code: 'SUPER_ADMIN_REQUIRED'
    });
  }

  next();
};

/**
 * NOTE: We don't define AVAILABLE_MODULES here anymore!
 * Frontend has full control over what modules exist.
 * Backend just stores whatever array frontend sends.
 * This gives frontend flexibility to add/remove modules without backend changes.
 */

/**
 * @route   GET /api/admin-mgmt/sub-admins
 * @desc    Get all sub-admins
 * @access  Super Admin only
 */
router.get('/sub-admins', verifyToken, requireSuperAdmin, async (req, res) => {
  try {
    const subAdmins = await User.find({
      role: 'admin',
      _id: { $ne: req.user._id } // Exclude current user
    })
    .select('name email moduleAccess isActive createdAt createdBy lastLogin')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: subAdmins,
      count: subAdmins.length
    });
  } catch (error) {
    console.error('Error fetching sub-admins:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sub-admins',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/admin-mgmt/sub-admins/:adminId
 * @desc    Get single sub-admin details
 * @access  Super Admin only
 */
router.get('/sub-admins/:adminId', verifyToken, requireSuperAdmin, async (req, res) => {
  try {
    const subAdmin = await User.findById(req.params.adminId)
      .select('name email moduleAccess isActive createdAt createdBy lastLogin')
      .populate('createdBy', 'name email');

    if (!subAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Sub-admin not found'
      });
    }

    if (subAdmin.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'This user is not a sub-admin'
      });
    }

    res.json({
      success: true,
      data: subAdmin
    });
  } catch (error) {
    console.error('Error fetching sub-admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sub-admin',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin-mgmt/sub-admins
 * @desc    Create new sub-admin
 * @access  Super Admin only
 */
router.post('/sub-admins', verifyToken, requireSuperAdmin, async (req, res) => {
  try {
    const { name, email, password, moduleAccess } = req.body;

    console.log('Creating sub-admin:', email);

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required',
        code: 'MISSING_FIELDS'
      });
    }

    if (!moduleAccess || !Array.isArray(moduleAccess) || moduleAccess.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one module for access',
        code: 'NO_MODULES_SELECTED'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
        code: 'WEAK_PASSWORD'
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists',
        code: 'EMAIL_EXISTS'
      });
    }

    // No validation of modules - frontend has full control
    // Just ensure dashboard is included (if not already)
    const modulesWithDashboard = moduleAccess.includes('dashboard')
      ? moduleAccess
      : ['dashboard', ...moduleAccess];

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate unique firebaseUid for admin (not used for login, just for uniqueness)
    const crypto = require('crypto');
    const adminFirebaseUid = `admin_${crypto.randomBytes(8).toString('hex')}`;

    // Create sub-admin
    const subAdmin = new User({
      name,
      email,
      firebaseUid: adminFirebaseUid,
      password: hashedPassword,
      role: 'admin',
      moduleAccess: modulesWithDashboard,
      createdBy: req.user._id,
      isActive: true
    });

    await subAdmin.save();

    console.log('Sub-admin created successfully:', email);

    // Return created admin without sensitive fields
    const createdAdmin = await User.findById(subAdmin._id)
      .select('name email role moduleAccess isActive createdAt')
      .populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Sub-admin created successfully',
      data: createdAdmin
    });
  } catch (error) {
    console.error('Error creating sub-admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create sub-admin',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/admin-mgmt/sub-admins/:adminId
 * @desc    Update sub-admin (name, modules, status)
 * @access  Super Admin only
 */
router.put('/sub-admins/:adminId', verifyToken, requireSuperAdmin, async (req, res) => {
  try {
    const { name, moduleAccess, isActive } = req.body;

    const subAdmin = await User.findById(req.params.adminId);

    if (!subAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Sub-admin not found'
      });
    }

    // Prevent modifying super admins
    if (subAdmin.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot modify super admin users',
        code: 'CANNOT_MODIFY_SUPER_ADMIN'
      });
    }

    // Prevent modifying regular users
    if (subAdmin.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'This user is not a sub-admin',
        code: 'NOT_SUB_ADMIN'
      });
    }

    // Update fields
    if (name) subAdmin.name = name;
    if (isActive !== undefined) subAdmin.isActive = isActive;

    if (moduleAccess && Array.isArray(moduleAccess)) {
      // No validation - frontend controls modules
      // Just ensure dashboard is included
      const modulesWithDashboard = moduleAccess.includes('dashboard')
        ? moduleAccess
        : ['dashboard', ...moduleAccess];
      subAdmin.moduleAccess = modulesWithDashboard;
    }

    await subAdmin.save();

    console.log('Sub-admin updated successfully:', subAdmin.email);

    const updatedAdmin = await User.findById(subAdmin._id)
      .select('name email role moduleAccess isActive createdAt lastLogin')
      .populate('createdBy', 'name email');

    res.json({
      success: true,
      message: 'Sub-admin updated successfully',
      data: updatedAdmin
    });
  } catch (error) {
    console.error('Error updating sub-admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update sub-admin',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/admin-mgmt/sub-admins/:adminId
 * @desc    Delete/deactivate sub-admin
 * @access  Super Admin only
 */
router.delete('/sub-admins/:adminId', verifyToken, requireSuperAdmin, async (req, res) => {
  try {
    const subAdmin = await User.findById(req.params.adminId);

    if (!subAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Sub-admin not found'
      });
    }

    // Prevent deleting super admins
    if (subAdmin.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete super admin',
        code: 'CANNOT_DELETE_SUPER_ADMIN'
      });
    }

    // Prevent deleting self
    if (subAdmin._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account',
        code: 'CANNOT_DELETE_SELF'
      });
    }

    // Deactivate instead of delete (soft delete)
    subAdmin.isActive = false;
    await subAdmin.save();

    console.log('Sub-admin deactivated:', subAdmin.email);

    res.json({
      success: true,
      message: 'Sub-admin deactivated successfully'
    });
  } catch (error) {
    console.error('Error deleting sub-admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete sub-admin',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin-mgmt/sub-admins/:adminId/reset-password
 * @desc    Reset sub-admin password
 * @access  Super Admin only
 */
router.post('/sub-admins/:adminId/reset-password', verifyToken, requireSuperAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password is required',
        code: 'NO_PASSWORD'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
        code: 'WEAK_PASSWORD'
      });
    }

    const subAdmin = await User.findById(req.params.adminId);

    if (!subAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Sub-admin not found'
      });
    }

    if (subAdmin.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Can only reset password for sub-admins',
        code: 'NOT_SUB_ADMIN'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    subAdmin.password = hashedPassword;
    await subAdmin.save();

    console.log('Password reset for sub-admin:', subAdmin.email);

    res.json({
      success: true,
      message: 'Password reset successfully',
      data: {
        email: subAdmin.email,
        // Return the plain password so super admin can share it
        newPassword: newPassword
      }
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/admin-mgmt/my-modules
 * @desc    Get current admin user's module access
 * @access  Any authenticated admin
 */
router.get('/my-modules', verifyToken, async (req, res) => {
  try {
    const user = req.user;

    // Only allow admin and super_admin roles
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
        code: 'NOT_ADMIN'
      });
    }

    let modules = [];
    let isSuperAdmin = false;

    if (user.role === 'super_admin') {
      // Super admin gets empty array - frontend will show ALL modules
      // Frontend logic: if isSuperAdmin === true, show everything
      modules = [];
      isSuperAdmin = true;
    } else if (user.role === 'admin') {
      // Sub-admin gets their assigned modules
      modules = user.moduleAccess || [];
    }

    res.json({
      success: true,
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isSuperAdmin,
        modules  // Array of module IDs frontend sent
      }
    });
  } catch (error) {
    console.error('Error fetching modules:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch module access',
      error: error.message
    });
  }
});

/**
 * ADMIN REGISTRATION REQUEST MANAGEMENT ROUTES
 */

/**
 * @route   GET /api/admin-mgmt/registration-requests
 * @desc    Get all registration requests with filtering
 * @access  Super Admin only
 */
router.get('/registration-requests', verifyToken, requireSuperAdmin, getRegistrationRequests);

/**
 * @route   GET /api/admin-mgmt/registration-requests/:requestId
 * @desc    Get single registration request details
 * @access  Super Admin only
 */
router.get('/registration-requests/:requestId', verifyToken, requireSuperAdmin, getRegistrationRequestById);

/**
 * @route   POST /api/admin-mgmt/registration-requests/:requestId/approve
 * @desc    Approve registration request and create admin
 * @access  Super Admin only
 */
router.post('/registration-requests/:requestId/approve', verifyToken, requireSuperAdmin, approveRegistrationRequest);

/**
 * @route   POST /api/admin-mgmt/registration-requests/:requestId/reject
 * @desc    Reject registration request
 * @access  Super Admin only
 */
router.post('/registration-requests/:requestId/reject', verifyToken, requireSuperAdmin, rejectRegistrationRequest);

/**
 * SALES TEAM MANAGEMENT ROUTES
 */

/**
 * @route   GET /api/admin-mgmt/sales-team
 * @desc    Get all sales team members
 * @access  Super Admin only
 */
router.get('/sales-team', verifyToken, requireSuperAdmin, async (req, res) => {
  try {
    const salesTeam = await User.find({
      role: 'sales_team',
      _id: { $ne: req.user._id }
    })
    .select('name email isActive createdAt createdBy lastLogin')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: salesTeam,
      count: salesTeam.length
    });
  } catch (error) {
    console.error('Error fetching sales team members:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales team members',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin-mgmt/sales-team
 * @desc    Create new sales team member
 * @access  Super Admin only
 */
router.post('/sales-team', verifyToken, requireSuperAdmin, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
        code: 'WEAK_PASSWORD'
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered',
        code: 'EMAIL_EXISTS'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate unique firebaseUid
    const crypto = require('crypto');
    const salesFirebaseUid = `sales_${crypto.randomBytes(8).toString('hex')}`;

    // Create sales team member
    const salesMember = new User({
      name,
      email: email.toLowerCase(),
      firebaseUid: salesFirebaseUid,
      password: hashedPassword,
      role: 'sales_team',
      createdBy: req.user._id,
      isActive: true
    });

    await salesMember.save();

    res.status(201).json({
      success: true,
      message: 'Sales team member created successfully',
      data: {
        salesMemberId: salesMember._id,
        name: salesMember.name,
        email: salesMember.email,
        createdAt: salesMember.createdAt
      }
    });

  } catch (error) {
    console.error('Error creating sales team member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create sales team member',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/admin-mgmt/sales-team/:salesId
 * @desc    Update sales team member
 * @access  Super Admin only
 */
router.put('/sales-team/:salesId', verifyToken, requireSuperAdmin, async (req, res) => {
  try {
    const { salesId } = req.params;
    const { name, isActive } = req.body;

    const salesMember = await User.findById(salesId);

    if (!salesMember || salesMember.role !== 'sales_team') {
      return res.status(404).json({
        success: false,
        message: 'Sales team member not found'
      });
    }

    // Update fields
    if (name) salesMember.name = name;
    if (typeof isActive === 'boolean') salesMember.isActive = isActive;

    await salesMember.save();

    res.json({
      success: true,
      message: 'Sales team member updated successfully',
      data: {
        salesMemberId: salesMember._id,
        name: salesMember.name,
        email: salesMember.email,
        isActive: salesMember.isActive
      }
    });

  } catch (error) {
    console.error('Error updating sales team member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update sales team member',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/admin-mgmt/sales-team/:salesId
 * @desc    Deactivate sales team member (soft delete)
 * @access  Super Admin only
 */
router.delete('/sales-team/:salesId', verifyToken, requireSuperAdmin, async (req, res) => {
  try {
    const { salesId } = req.params;

    const salesMember = await User.findById(salesId);

    if (!salesMember || salesMember.role !== 'sales_team') {
      return res.status(404).json({
        success: false,
        message: 'Sales team member not found'
      });
    }

    // Soft delete
    salesMember.isActive = false;
    await salesMember.save();

    res.json({
      success: true,
      message: 'Sales team member deactivated successfully'
    });

  } catch (error) {
    console.error('Error deactivating sales team member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate sales team member',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin-mgmt/sales-team/:salesId/reset-password
 * @desc    Reset sales team member password
 * @access  Super Admin only
 */
router.post('/sales-team/:salesId/reset-password', verifyToken, requireSuperAdmin, async (req, res) => {
  try {
    const { salesId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
        code: 'WEAK_PASSWORD'
      });
    }

    const salesMember = await User.findById(salesId);

    if (!salesMember || salesMember.role !== 'sales_team') {
      return res.status(404).json({
        success: false,
        message: 'Sales team member not found'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    salesMember.password = hashedPassword;
    await salesMember.save();

    res.json({
      success: true,
      message: 'Password reset successfully',
      data: {
        email: salesMember.email,
        temporaryPassword: newPassword  // Return plaintext for super admin to share
      }
    });

  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: error.message
    });
  }
});

module.exports = router;
