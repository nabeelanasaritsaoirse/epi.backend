const cron = require("node-cron");
const Kyc = require("../models/Kyc");

// Runs every minute
cron.schedule("* * * * *", async () => {
  try {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

    // Don't auto-approve duplicates - they need manual admin review
    const pendingKycs = await Kyc.find({
      status: "pending",
      isDuplicate: { $ne: true }, // Skip duplicates (matches false AND undefined)
      submittedAt: { $lte: sixHoursAgo }
    });

    for (let kyc of pendingKycs) {
      kyc.status = "auto_approved";
      kyc.updatedAt = new Date();
      await kyc.save();
    }
  } catch (err) {
    console.log("Auto-approval error:", err);
  }
});

module.exports = {};
