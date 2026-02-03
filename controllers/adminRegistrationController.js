const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const AdminRegistrationRequest = require("../models/AdminRegistrationRequest");
const User = require("../models/User");

/**
 * @route   POST /api/admin-auth/register-request
 * @desc    Submit admin registration request (Public endpoint)
 * @access  Public
 */
const submitRegistrationRequest = async (req, res) => {
  try {
    const { name, email, password, requestedModules } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
        code: "MISSING_FIELDS",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
        code: "INVALID_EMAIL",
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
        code: "WEAK_PASSWORD",
      });
    }
    // Validate requestedModules
    if (!Array.isArray(requestedModules) || requestedModules.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one module must be selected",
        code: "MODULES_REQUIRED",
      });
    }

    // Check if email is already registered as admin (either primary role or additionalRoles)
    const existingUser = await User.findOne({
      email: email.toLowerCase(),
    });

    if (existingUser) {
      const { hasRole } = require("../utils/roleHelpers");

      // Check if already has admin role (primary or additional)
      if (hasRole(existingUser, "admin") || hasRole(existingUser, "super_admin")) {
        return res.status(400).json({
          success: false,
          message: "Email already registered as admin",
          code: "EMAIL_EXISTS",
        });
      }
      // User exists but is not admin - they can request to be promoted to admin
      // The approval process will add 'admin' to their additionalRoles
    }

    // Check if there's already a pending request for this email
    const pendingRequest = await AdminRegistrationRequest.findOne({
      email: email.toLowerCase(),
      status: "pending",
    });

    if (pendingRequest) {
      return res.status(400).json({
        success: false,
        message: "Registration request already pending for this email",
        code: "REQUEST_PENDING",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create registration request
    const registrationRequest = new AdminRegistrationRequest({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      requestedModules: requestedModules, // ✅ IMPORTANT
      status: "pending",
    });

    await registrationRequest.save();

    res.status(201).json({
      success: true,
      message:
        "Registration request submitted successfully. Please wait for admin approval.",
      data: {
        requestId: registrationRequest._id,
        email: registrationRequest.email,
        status: registrationRequest.status,
        requestedAt: registrationRequest.requestedAt,
      },
    });
  } catch (error) {
    console.error("Error submitting registration request:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit registration request",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/admin-mgmt/registration-requests
 * @desc    Get all registration requests with filtering and pagination
 * @access  Super Admin only
 */
const getRegistrationRequests = async (req, res) => {
  try {
    const { status = "pending", page = 1, limit = 20 } = req.query;

    // Build query
    let query = {};
    if (status && status !== "all") {
      query.status = status;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get total count
    const total = await AdminRegistrationRequest.countDocuments(query);

    // Fetch requests
    const requests = await AdminRegistrationRequest.find(query)
      .select("-password") // Don't return password hash
      .populate("reviewedBy", "name email")
      .populate("approvedAdminId", "name email")
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching registration requests:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch registration requests",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/admin-mgmt/registration-requests/:requestId
 * @desc    Get single registration request details
 * @access  Super Admin only
 */
const getRegistrationRequestById = async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await AdminRegistrationRequest.findById(requestId)
      .select("-password")
      .populate("reviewedBy", "name email")
      .populate("approvedAdminId", "name email moduleAccess");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Registration request not found",
        code: "REQUEST_NOT_FOUND",
      });
    }

    res.json({
      success: true,
      data: request,
    });
  } catch (error) {
    console.error("Error fetching registration request:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch registration request",
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/admin-mgmt/registration-requests/:requestId/approve
 * @desc    Approve registration request and create admin user (or promote existing user)
 * @access  Super Admin only
 */
const approveRegistrationRequest = async (req, res) => {
  const session = await AdminRegistrationRequest.startSession();
  session.startTransaction();

  try {
    const { requestId } = req.params;
    const { moduleAccess } = req.body;

    // Validate moduleAccess
    if (!moduleAccess || !Array.isArray(moduleAccess)) {
      return res.status(400).json({
        success: false,
        message: "moduleAccess array is required",
        code: "INVALID_MODULE_ACCESS",
      });
    }

    // Find the request
    const request = await AdminRegistrationRequest.findById(requestId).session(
      session
    );

    if (!request) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Registration request not found",
        code: "REQUEST_NOT_FOUND",
      });
    }

    // Check if request is pending
    if (request.status !== "pending") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Request already ${request.status}`,
        code: "REQUEST_ALREADY_PROCESSED",
      });
    }

    // Ensure dashboard is included in moduleAccess
    const modulesWithDashboard = moduleAccess.includes("dashboard")
      ? moduleAccess
      : ["dashboard", ...moduleAccess];

    // Check if email already exists (any role)
    const existingUser = await User.findOne({
      email: request.email,
    }).session(session);

    let adminUser;
    let isPromotedUser = false;

    if (existingUser) {
      // User already exists - check their current roles
      const { hasRole } = require("../utils/roleHelpers");

      // Check if already an admin
      if (hasRole(existingUser, "admin") || hasRole(existingUser, "super_admin")) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Email already registered as admin",
          code: "EMAIL_EXISTS",
        });
      }

      // Add admin role inline to avoid parallel save
      // (addRole() calls .save() internally, which races with the .save({ session }) below)
      if (!existingUser.additionalRoles) {
        existingUser.additionalRoles = [];
      }
      existingUser.additionalRoles.push("admin");

      // Set the password from the request (user might have registered with Firebase, now needs panel password)
      existingUser.password = request.password; // Already hashed

      // Set/update moduleAccess
      existingUser.moduleAccess = modulesWithDashboard;

      // Set createdBy if not already set
      if (!existingUser.createdBy) {
        existingUser.createdBy = req.user._id;
      }

      await existingUser.save({ session });
      adminUser = existingUser;
      isPromotedUser = true;
    } else {
      // No existing user - create new admin user
      const adminFirebaseUid = `admin_${crypto.randomBytes(8).toString("hex")}`;

      const newAdmin = new User({
        name: request.name,
        email: request.email,
        firebaseUid: adminFirebaseUid,
        password: request.password, // Already hashed
        role: "admin",
        moduleAccess: modulesWithDashboard,
        createdBy: req.user._id,
        isActive: true,
      });

      await newAdmin.save({ session });
      adminUser = newAdmin;
    }

    // Update the request
    request.status = "approved";
    request.reviewedAt = new Date();
    request.reviewedBy = req.user._id;
    request.approvedAdminId = adminUser._id;

    await request.save({ session });

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: isPromotedUser
        ? "Registration approved - existing user promoted to admin"
        : "Registration request approved and admin created successfully",
      data: {
        adminId: adminUser._id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        additionalRoles: adminUser.additionalRoles || [],
        isPromotedUser: isPromotedUser,
        moduleAccess: adminUser.moduleAccess,
        createdAt: adminUser.createdAt,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error approving registration request:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve registration request",
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/admin-mgmt/registration-requests/:requestId/reject
 * @desc    Reject registration request
 * @access  Super Admin only
 */
const rejectRegistrationRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;

    // Find the request
    const request = await AdminRegistrationRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Registration request not found",
        code: "REQUEST_NOT_FOUND",
      });
    }

    // Check if request is pending
    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Request already ${request.status}`,
        code: "REQUEST_ALREADY_PROCESSED",
      });
    }

    // Update the request
    request.status = "rejected";
    request.reviewedAt = new Date();
    request.reviewedBy = req.user._id;
    if (reason) {
      request.rejectionReason = reason.trim();
    }

    await request.save();

    res.json({
      success: true,
      message: "Registration request rejected",
      data: {
        requestId: request._id,
        email: request.email,
        status: request.status,
        rejectionReason: request.rejectionReason,
      },
    });
  } catch (error) {
    console.error("Error rejecting registration request:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject registration request",
      error: error.message,
    });
  }
};

module.exports = {
  submitRegistrationRequest,
  getRegistrationRequests,
  getRegistrationRequestById,
  approveRegistrationRequest,
  rejectRegistrationRequest,
};
