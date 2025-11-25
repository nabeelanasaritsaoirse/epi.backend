const axios = require('axios');

const BASE_URL = "http://localhost:3000/api";
const USER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFkNjAzNTk2MjU0MmJmNDEyMGYzMGIiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2Mzk1NDU4MywiZXhwIjoxNzY0NTU5MzgzfQ.F-goKWFq0_8QG6yy26W-rjMpiBZqSKVBCzz7QZnDMNI"; // add your token here

async function seedPendingPayments() {
  try {
    console.log("🚀 Seeding fake pending installment payments...");

    const fakeData = [
      {
        orderId: "ORDERTEST01",
        installmentNumber: 5,
        amount: 249,
        status: "PENDING",
        dueDate: "2025-12-01T10:00:00Z"
      },
      {
        orderId: "ORDERTEST02",
        installmentNumber: 3,
        amount: 149,
        status: "PENDING",
        dueDate: "2025-12-02T10:00:00Z"
      }
    ];

    for (const item of fakeData) {
      await axios.post(
        `${BASE_URL}/installments/payments/process`,
        item,
        {
          headers: { Authorization: `Bearer ${USER_TOKEN}` }
        }
      );
    }

    console.log("✅ Dummy pending payments inserted!");
  } catch (err) {
    console.error("❌ Error seeding data:", err.response?.data || err.message);
  }
}

seedPendingPayments();
