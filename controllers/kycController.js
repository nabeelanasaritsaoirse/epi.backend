const Kyc = require("../models/Kyc");

exports.submitKyc = async (req, res) => {
  try {
    const userId = req.user.id; // from verifyToken middleware
    const { documents } = req.body; // array of { type, frontUrl, backUrl }

    if (!documents || documents.length === 0) {
      return res.status(400).json({ message: "Documents are required" });
    }

    let existing = await Kyc.findOne({ userId });

    // If already approved → cannot submit again
    if (existing) {
      if (existing.status === "approved" || existing.status === "auto_approved") {
        return res.status(400).json({
          message: "KYC already approved. You cannot submit again."
        });
      }

      if (existing.status === "pending") {
        return res.status(400).json({
          message: "KYC is already pending. Please wait for approval."
        });
      }

      // If rejected → allow resubmission (delete old record)
      if (existing.status === "rejected") {
        await Kyc.deleteOne({ userId });
      }
    }

    const newKyc = new Kyc({
      userId,
      documents,
      status: "pending",
      submittedAt: new Date()
    });

    await newKyc.save();

    return res.json({
      message: "KYC submitted successfully",
      status: "pending"
    });
  } catch (err) {
    console.log("Submit KYC error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

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
      submittedAt: kyc.submittedAt
    });
  } catch (err) {
    console.log("Get KYC status error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.adminApprove = async (req, res) => {
  try {
    const kycId = req.params.id;

    const kyc = await Kyc.findById(kycId);
    if (!kyc) return res.status(404).json({ message: "KYC not found" });

    kyc.status = "approved";
    kyc.updatedAt = new Date();
    await kyc.save();

    return res.json({ message: "KYC approved manually by admin" });
  } catch (err) {
    console.log("Admin approve error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.adminReject = async (req, res) => {
  try {
    const kycId = req.params.id;

    const kyc = await Kyc.findById(kycId);
    if (!kyc) return res.status(404).json({ message: "KYC not found" });

    kyc.status = "rejected";
    kyc.updatedAt = new Date();
    await kyc.save();

    return res.json({ message: "KYC rejected" });
  } catch (err) {
    console.log("Admin reject error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
