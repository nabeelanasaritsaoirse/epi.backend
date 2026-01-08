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

    // Check if email is already registered as admin
    const existingAdmin = await User.findOne({
      email: email.toLowerCase(),
      role: { $in: ["admin", "super_admin"] },
    });

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: "Email already registered as admin",
        code: "EMAIL_EXISTS",
      });
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
 * @desc    Approve registration request and create admin user
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

    // Double-check email is not already registered
    const existingAdmin = await User.findOne({
      email: request.email,
      role: { $in: ["admin", "super_admin"] },
    }).session(session);

    if (existingAdmin) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Email already registered as admin",
        code: "EMAIL_EXISTS",
      });
    }

    // Ensure dashboard is included in moduleAccess
    const modulesWithDashboard = moduleAccess.includes("dashboard")
      ? moduleAccess
      : ["dashboard", ...moduleAccess];

    // Generate unique firebaseUid for admin
    const adminFirebaseUid = `admin_${crypto.randomBytes(8).toString("hex")}`;

    // Create the admin user
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

    // Update the request
    request.status = "approved";
    request.reviewedAt = new Date();
    request.reviewedBy = req.user._id;
    request.approvedAdminId = newAdmin._id;

    await request.save({ session });

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: "Registration request approved and admin created successfully",
      data: {
        adminId: newAdmin._id,
        email: newAdmin.email,
        name: newAdmin.name,
        moduleAccess: newAdmin.moduleAccess,
        createdAt: newAdmin.createdAt,
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
