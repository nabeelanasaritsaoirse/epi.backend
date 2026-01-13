const Kyc = require("../models/Kyc");
const User = require("../models/User");

/* ============================================================
   📌 USER — SUBMIT KYC
   This expects all uploaded S3 URLs already in req.body.documents
============================================================ */
exports.submitKyc = async (req, res) => {
  try {
    const userId = req.user.id;
    const { documents, aadhaarNumber, panNumber } = req.body;

    // Check if user has verified phone or email before allowing KYC submission
    const user = await User.findById(userId).select('phoneVerified emailVerified');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.phoneVerified && !user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Please verify your phone number or email before submitting KYC",
        code: "VERIFICATION_REQUIRED",
      });
    }

    if (!aadhaarNumber || !/^\d{12}$/.test(aadhaarNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Aadhaar number",
      });
    }

    if (!panNumber || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid PAN number",
      });
    }

    // Validate documents
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Documents array is required",
      });
    }

    // 🔴 FIX: normalize document types (CASE SAFE)
    const normalizedDocuments = documents.map((doc) => ({
      ...doc,
      type: typeof doc.type === "string" ? doc.type.toLowerCase() : doc.type,
    }));

    // Required types for your flow
    const requiredTypes = ["selfie", "aadhaar", "pan"];

    const uploadedTypes = normalizedDocuments.map((d) => d.type);

    // Ensure all required types exist
    for (const t of requiredTypes) {
      if (!uploadedTypes.includes(t)) {
        return res.status(400).json({
          success: false,
          message: `Missing required document type: ${t}`,
        });
      }
    }

    // Validate structure of each document
    for (const doc of normalizedDocuments) {
      if (!doc.type) {
        return res.status(400).json({
          success: false,
          message: "Each document must contain a 'type'",
        });
      }

      // Selfie
      if (doc.type === "selfie") {
        if (!doc.frontUrl) {
          return res.status(400).json({
            success: false,
            message: "Selfie must have frontUrl",
          });
        }
      }

      // Aadhaar → front + back
      if (doc.type === "aadhaar") {
        if (!doc.frontUrl || !doc.backUrl) {
          return res.status(400).json({
            success: false,
            message: "Aadhaar must include frontUrl and backUrl",
          });
        }
      }

      // PAN → ONLY front
      if (doc.type === "pan") {
        if (!doc.frontUrl) {
          return res.status(400).json({
            success: false,
            message: "PAN must include frontUrl",
          });
        }
      }
    }

    // Check existing KYC
    let existing = await Kyc.findOne({ userId });

    if (existing) {
      if (["approved", "auto_approved"].includes(existing.status)) {
        return res.status(400).json({
          success: false,
          message: "KYC already approved. Cannot resubmit.",
        });
      }

      if (existing.status === "pending") {
        return res.status(400).json({
          success: false,
          message: "KYC already pending. Please wait.",
        });
      }

      // Rejected => wipe old data
      if (existing.status === "rejected") {
        await Kyc.deleteOne({ userId });
      }
    }

    // Check for duplicate Aadhaar (already used by another user)
    const duplicateAadhaar = await Kyc.findOne({
      aadhaarNumber,
      userId: { $ne: userId },
      status: { $in: ['approved', 'auto_approved', 'pending'] }
    });

    // Check for duplicate PAN (already used by another user)
    const duplicatePan = await Kyc.findOne({
      panNumber,
      userId: { $ne: userId },
      status: { $in: ['approved', 'auto_approved', 'pending'] }
    });

    // Flag as duplicate if Aadhaar or PAN already exists
    let isDuplicate = false;
    let duplicateNote = null;
    let duplicateOf = null;

    if (duplicateAadhaar) {
      isDuplicate = true;
      duplicateOf = duplicateAadhaar._id;
      duplicateNote = 'Aadhaar already registered with another user';
    }

    if (duplicatePan) {
      isDuplicate = true;
      duplicateOf = duplicateOf || duplicatePan._id;
      duplicateNote = duplicateNote
        ? `${duplicateNote}. PAN also registered with another user`
        : 'PAN already registered with another user';
    }

    const newKyc = new Kyc({
      userId,
      documents: normalizedDocuments, // 🔴 use normalized docs
      aadhaarNumber,
      panNumber,
      status: "pending",
      isDuplicate,
      duplicateOf,
      duplicateNote,
      submittedAt: new Date(),
      updatedAt: new Date(),
    });

    await newKyc.save();

    return res.json({
      success: true,
      message: "KYC submitted successfully",
      status: "pending",
    });
  } catch (err) {
    console.error("Submit KYC error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ============================================================
   📌 USER — GET MY KYC STATUS
============================================================ */
exports.getKycStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user verification status
    const user = await User.findById(userId).select('phoneNumber email phoneVerified emailVerified');

    const kyc = await Kyc.findOne({ userId });

    // User info object to return
    const userInfo = {
      phoneNumber: user?.phoneNumber || null,
      email: user?.email || null,
      phoneVerified: user?.phoneVerified || false,
      emailVerified: user?.emailVerified || false,
    };

    if (!kyc) {
      return res.json({
        kycExists: false,
        status: "not_submitted",
        user: userInfo,
      });
    }

    return res.json({
      kycExists: true,
      status: kyc.status,
      rejectionNote: kyc.rejectionNote || null,
      documents: kyc.documents,
      submittedAt: kyc.submittedAt,
      updatedAt: kyc.updatedAt,
      user: userInfo,
    });
  } catch (err) {
    console.log("Get KYC status error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ============================================================
   📌 ADMIN — GET ALL KYC
============================================================ */
exports.getAllKyc = async (req, res) => {
  try {
    let list = await Kyc.find()
      .populate("userId", "name email phoneNumber phoneVerified emailVerified")
      .populate("duplicateOf", "userId aadhaarNumber panNumber")
      .sort({ isDuplicate: -1, submittedAt: -1 }); // Duplicates first

    list = list.map((item) => {
      const doc = item._doc;
      if (!item.userId) {
        return {
          ...doc,
          userId: { name: "-", email: "-", phoneNumber: "-", phoneVerified: false, emailVerified: false },
          isDuplicate: doc.isDuplicate || false,
          duplicateNote: doc.duplicateNote || null,
        };
      }
      return {
        ...doc,
        isDuplicate: doc.isDuplicate || false,
        duplicateNote: doc.duplicateNote || null,
      };
    });

    return res.json({
      success: true,
      count: list.length,
      data: list,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ============================================================
   📌 ADMIN — APPROVE
============================================================ */
exports.adminApprove = async (req, res) => {
  try {
    const { id } = req.params;

    const kyc = await Kyc.findById(id);
    if (!kyc)
      return res.status(404).json({ success: false, message: "KYC not found" });

    kyc.status = "approved";
    kyc.rejectionNote = null; // clear rejection note
    kyc.updatedAt = new Date();
    await kyc.save();

    return res.json({
      success: true,
      message: "KYC approved",
      kyc,
    });
  } catch (err) {
    console.log("Admin approve error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ============================================================
   📌 ADMIN — REJECT KYC WITH NOTE
============================================================ */
exports.adminReject = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const kyc = await Kyc.findById(id);
    if (!kyc)
      return res.status(404).json({ success: false, message: "KYC not found" });

    kyc.status = "rejected";
    kyc.rejectionNote = note || "No reason provided";
    kyc.updatedAt = new Date();
    await kyc.save();

    return res.json({
      success: true,
      message: "KYC rejected",
      kyc,
    });
  } catch (err) {
    console.log("Admin reject error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ============================================================
   📌 ADMIN — SEARCH KYC BY AADHAAR OR PAN
============================================================ */
exports.adminSearch = async (req, res) => {
  try {
    const { aadhaarNumber, panNumber, query } = req.query;

    let searchConditions = [];

    if (aadhaarNumber) {
      searchConditions.push({ aadhaarNumber: { $regex: aadhaarNumber, $options: 'i' } });
    }

    if (panNumber) {
      searchConditions.push({ panNumber: { $regex: panNumber.toUpperCase(), $options: 'i' } });
    }

    // Generic query searches both Aadhaar and PAN
    if (query) {
      searchConditions.push(
        { aadhaarNumber: { $regex: query, $options: 'i' } },
        { panNumber: { $regex: query.toUpperCase(), $options: 'i' } }
      );
    }

    if (searchConditions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide aadhaarNumber, panNumber, or query parameter",
      });
    }

    const results = await Kyc.find({ $or: searchConditions })
      .populate("userId", "name email phoneNumber phoneVerified emailVerified")
      .sort({ submittedAt: -1 });

    return res.json({
      success: true,
      count: results.length,
      data: results.map((kyc) => ({
        kycId: kyc._id,
        status: kyc.status,
        aadhaarNumber: kyc.aadhaarNumber,
        panNumber: kyc.panNumber,
        isDuplicate: kyc.isDuplicate || false,
        duplicateNote: kyc.duplicateNote || null,
        user: kyc.userId
          ? {
              userId: kyc.userId._id,
              name: kyc.userId.name,
              email: kyc.userId.email,
              phoneNumber: kyc.userId.phoneNumber,
              phoneVerified: kyc.userId.phoneVerified || false,
              emailVerified: kyc.userId.emailVerified || false,
            }
          : null,
        submittedAt: kyc.submittedAt,
      })),
    });
  } catch (err) {
    console.error("Admin search error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
