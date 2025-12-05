const cron = require("node-cron");
const Kyc = require("../models/Kyc");

// Runs every minute
cron.schedule("* * * * *", async () => {
  try {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

    const pendingKycs = await Kyc.find({
      status: "pending",
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
