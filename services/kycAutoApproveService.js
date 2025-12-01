const cron = require("node-cron");
const Kyc = require("../models/Kyc");

// Runs every minute
cron.schedule("* * * * *", async () => {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const pendingKycs = await Kyc.find({
      status: "pending",
      submittedAt: { $lte: tenMinutesAgo }
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
