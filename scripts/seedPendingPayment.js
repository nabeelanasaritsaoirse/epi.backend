const mongoose = require("mongoose");
require("dotenv").config();

const InstallmentOrder = require("../models/InstallmentOrder");

const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/epi_backend";

(async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    console.log("📝 Creating 1 fake pending installment (today)…");

    // TODAY in IST
    const todayIST = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    const order = await InstallmentOrder.create({
      orderId: `TEST-${Date.now()}`,   // FIXED SYNTAX
      user: "691d6035962542bf4120f30b", // PUT YOUR USER ID
      product: "69182fed420789490a734cf5", // PUT VALID PRODUCT ID

      productName: "Test Product",
      productPrice: 1000,
      dailyPaymentAmount: 100,
      totalDays: 10,

      paidInstallments: 0,
      totalPaidAmount: 0,
      remainingAmount: 1000,

      status: "ACTIVE",
      firstPaymentMethod: "WALLET",

      paymentSchedule: [
        {
          installmentNumber: 1,
          amount: 100,
          status: "PENDING",
          dueDate: todayIST,  // IMPORTANT
        }
      ],
    });

    console.log("✅ Inserted Order:", order.orderId);
    process.exit(0);

  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
})();
