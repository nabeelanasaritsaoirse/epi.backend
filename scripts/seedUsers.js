const mongoose = require("mongoose");
const User = require("../models/User");
require("dotenv").config();

// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/epi_backend", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

async function seedUsers() {
  try {
    const existingCount = await User.countDocuments();
    if (existingCount > 0) {
      console.log(`⚠️ Database already has ${existingCount} users. Skipping seeding.`);
      process.exit(0);
    }

    const users = [
      {
        name: "Aarav Mehta",
        email: "aarav@example.com",
        firebaseUid: "firebase_uid_1",
        phoneNumber: "9876543210",
        isAgree: true,
      },
      {
        name: "Priya Sharma",
        email: "priya@example.com",
        firebaseUid: "firebase_uid_2",
        phoneNumber: "9123456789",
        isAgree: true,
      },
      {
        name: "Rohan Patel",
        email: "rohan@example.com",
        firebaseUid: "firebase_uid_3",
        phoneNumber: "9988776655",
        isAgree: true,
      },
      {
        name: "Sneha Kapoor",
        email: "sneha@example.com",
        firebaseUid: "firebase_uid_4",
        phoneNumber: "9090909090",
        isAgree: true,
      },
      {
        name: "Karan Gupta",
        email: "karan@example.com",
        firebaseUid: "firebase_uid_5",
        phoneNumber: "9812345678",
        isAgree: true,
      },
    ];

    // 1️⃣ Insert users
    const createdUsers = await User.insertMany(users);
    console.log(`✅ Created ${createdUsers.length} dummy users.`);

    // 2️⃣ Create referral relationships
    // user1 → user2 → user3 → user4 → user5
    for (let i = 1; i < createdUsers.length; i++) {
      createdUsers[i].referredBy = createdUsers[i - 1]._id;
      createdUsers[i - 1].referredUsers.push(createdUsers[i]._id);
      await createdUsers[i].save();
      await createdUsers[i - 1].save();
    }

    console.log("🔗 Referral chain created:");
    createdUsers.forEach((user, index) => {
      console.log(
        `${index + 1}. ${user.name} ${
          user.referredBy ? `(Referred by ${createdUsers[index - 1].name})` : "(Root Referrer)"
        }`
      );
    });

    // 3️⃣ Show summary
    console.log("\n📋 User Summary Table:");
    console.table(
      createdUsers.map((u) => ({
        name: u.name,
        email: u.email,
        referralCode: u.referralCode,
        referredBy: u.referredBy ? u.referredBy.toString().slice(-5) : "None",
      }))
    );

    console.log("🎯 Done! Database seeded with 5 users and referral relationships.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding users:", error);
    process.exit(1);
  }
}

seedUsers();
