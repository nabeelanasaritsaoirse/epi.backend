const Kyc = require("../models/Kyc");

/* ============================================================
   📌 USER — SUBMIT KYC
   This expects all uploaded S3 URLs already in req.body.documents
============================================================ */
exports.submitKyc = async (req, res) => {
  try {
    const userId = req.user.id;
    const { documents } = req.body;

    // Validate documents
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Documents array is required"
      });
    }

    // Required types for your flow
    const requiredTypes = ["selfie", "aadhaar", "pan"];

    const uploadedTypes = documents.map(d => d.type);

    // Ensure all required types exist
    for (const t of requiredTypes) {
      if (!uploadedTypes.includes(t)) {
        return res.status(400).json({
          success: false,
          message: `Missing required document type: ${t}`
        });
      }
    }

    // Validate structure of each document
    for (const doc of documents) {
      if (!doc.type) {
        return res.status(400).json({
          success: false,
          message: "Each document must contain a 'type'"
        });
      }

      // Selfie
      if (doc.type === "selfie") {
        if (!doc.frontUrl) {
          return res.status(400).json({
            success: false,
            message: "Selfie must have frontUrl"
          });
        }
      }

      // Aadhaar / PAN
      if (["aadhaar", "pan"].includes(doc.type)) {
        if (!doc.frontUrl || !doc.backUrl) {
          return res.status(400).json({
            success: false,
            message: `${doc.type} must include both frontUrl and backUrl`
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
          message: "KYC already approved. Cannot resubmit."
        });
      }

      if (existing.status === "pending") {
        return res.status(400).json({
          success: false,
          message: "KYC already pending. Please wait."
        });
      }

      // Rejected => wipe old data
      if (existing.status === "rejected") {
        await Kyc.deleteOne({ userId });
      }
    }

    const newKyc = new Kyc({
      userId,
      documents,
      status: "pending",
      submittedAt: new Date(),
      updatedAt: new Date()
    });

    await newKyc.save();

    return res.json({
      success: true,
      message: "KYC submitted successfully",
      status: "pending"
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
    const kyc = await Kyc.findOne({ userId });

    if (!kyc) {
      return res.json({
        kycExists: false,
        status: "not_submitted"
      });
    }

    return res.json({
      kycExists: true,
      status: kyc.status,
      rejectionNote: kyc.rejectionNote || null,
      documents: kyc.documents,
      submittedAt: kyc.submittedAt,
      updatedAt: kyc.updatedAt
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
    const list = await Kyc.find()
      .populate("userId", "name email phone")
      .sort({ submittedAt: -1 });

    return res.json({
      success: true,
      count: list.length,
      data: list
    });

  } catch (err) {
    console.log("Admin get all KYC error:", err);
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
    if (!kyc) return res.status(404).json({ success: false, message: "KYC not found" });

    kyc.status = "approved";
    kyc.rejectionNote = null; // clear rejection note
    kyc.updatedAt = new Date();
    await kyc.save();

    return res.json({
      success: true,
      message: "KYC approved",
      kyc
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
    if (!kyc) return res.status(404).json({ success: false, message: "KYC not found" });

    kyc.status = "rejected";
    kyc.rejectionNote = note || "No reason provided";
    kyc.updatedAt = new Date();
    await kyc.save();

    return res.json({
      success: true,
      message: "KYC rejected",
      kyc
    });

  } catch (err) {
    console.log("Admin reject error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
