const Kyc = require("../models/Kyc");

/* ============================================================
   USER — SUBMIT KYC
============================================================ */
exports.submitKyc = async (req, res) => {
  try {
    const userId = req.user.id;
    const { documents } = req.body;

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ message: "Documents are required" });
    }

    let existing = await Kyc.findOne({ userId });

    // Already approved
    if (existing) {
      if (["approved", "auto_approved"].includes(existing.status)) {
        return res.status(400).json({
          message: "KYC already approved. You cannot submit again."
        });
      }

      // Already pending
      if (existing.status === "pending") {
        return res.status(400).json({
          message: "KYC is already pending. Please wait for approval."
        });
      }

      // Rejected → allow resubmission
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
    console.log("Submit KYC error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


/* ============================================================
   USER — GET KYC STATUS
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
      documents: kyc.documents,
      submittedAt: kyc.submittedAt,
      updatedAt: kyc.updatedAt
    });

  } catch (err) {
    console.log("Get KYC status error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


/* ============================================================
   ADMIN — GET ALL KYC (with populated user details)
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
    res.status(500).json({ message: "Server error" });
  }
};


/* ============================================================
   ADMIN — APPROVE KYC
============================================================ */
exports.adminApprove = async (req, res) => {
  try {
    const kycId = req.params.id;

    const kyc = await Kyc.findById(kycId);
    if (!kyc) return res.status(404).json({ message: "KYC not found" });

    kyc.status = "approved";
    kyc.updatedAt = new Date();
    await kyc.save();

    return res.json({
      success: true,
      message: "KYC approved manually by admin",
      kyc
    });

  } catch (err) {
    console.log("Admin approve error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


/* ============================================================
   ADMIN — REJECT KYC (with rejection reason)
============================================================ */
exports.adminReject = async (req, res) => {
  try {
    const kycId = req.params.id;
    const { note } = req.body;

    const kyc = await Kyc.findById(kycId);
    if (!kyc) return res.status(404).json({ message: "KYC not found" });

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
    res.status(500).json({ message: "Server error" });
  }
};
